-- Shared pricing drafts. Only provisioned projects exist; there is no anonymous create/list API.
-- A 256-bit access key lives in the URL fragment, never in this repository or a query URL.
begin;
create schema if not exists pricing_private;
revoke all on schema pricing_private from public, anon, authenticated;
create table if not exists pricing_private.projects (
  id uuid primary key,
  key_hash bytea not null,
  title text not null,
  revision bigint not null default 0,
  state jsonb not null default '{}'::jsonb,
  mutation_id uuid,
  updated_at timestamptz not null default now()
);
create table if not exists pricing_private.versions (
  project_id uuid not null references pricing_private.projects(id),
  revision bigint not null,
  state jsonb not null,
  mutation_id uuid,
  reason text not null default 'save',
  saved_at timestamptz not null default now(),
  primary key(project_id, revision)
);
alter table pricing_private.projects enable row level security;
alter table pricing_private.versions enable row level security;
revoke all on all tables in schema pricing_private from public, anon, authenticated;

create or replace function pricing_private.authorize(p_id uuid, p_key text)
returns pricing_private.projects language plpgsql security definer set search_path = '' as $$
declare p pricing_private.projects;
begin
  if p_key is null or p_key !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'Project unavailable' using errcode = '42501';
  end if;
  select * into p from pricing_private.projects
  where id = p_id and key_hash = pg_catalog.sha256(pg_catalog.convert_to(p_key, 'UTF8'));
  if not found then raise exception 'Project unavailable' using errcode = '42501'; end if;
  return p;
end $$;
revoke all on function pricing_private.authorize(uuid,text) from public, anon, authenticated;

create or replace function pricing_private.result(p pricing_private.projects)
returns jsonb language sql stable set search_path = '' as $$
  select pg_catalog.jsonb_build_object('id',p.id,'title',p.title,'revision',p.revision,
    'state',p.state,'updatedAt',p.updated_at)
$$;
revoke all on function pricing_private.result(pricing_private.projects) from public, anon, authenticated;

create or replace function public.pricing_project_read(p_id uuid,p_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p pricing_private.projects;
begin
  p := pricing_private.authorize(p_id,p_key);
  return pricing_private.result(p);
end $$;

create or replace function public.pricing_project_save(
  p_id uuid,p_key text,p_revision bigint,p_state jsonb,p_mutation uuid,p_allow_empty boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p pricing_private.projects; previous_count integer; next_count integer;
begin
  p := pricing_private.authorize(p_id,p_key);
  if p_revision is null then raise exception 'Expected revision required' using errcode='22023'; end if;
  select * into p from pricing_private.projects where id=p.id for update;
  if p.mutation_id=p_mutation then
    return pg_catalog.jsonb_build_object('status','saved','project',pricing_private.result(p));
  end if;
  if p.revision<>p_revision then
    return pg_catalog.jsonb_build_object('status','conflict','project',pricing_private.result(p));
  end if;
  if p_mutation is null or p_state is null or pg_catalog.jsonb_typeof(p_state)<>'object'
     or pg_catalog.octet_length(p_state::text)>2097152
     or pg_catalog.jsonb_typeof(p_state->'customSets') is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_state->'ov') is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_state->'sov') is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_state->'customServices') is distinct from 'object'
  then raise exception 'Invalid project snapshot' using errcode='22023'; end if;
  previous_count := coalesce(pg_catalog.jsonb_array_length(p.state->'customSets'),0);
  next_count := pg_catalog.jsonb_array_length(p_state->'customSets');
  if previous_count>0 and next_count=0 and not coalesce(p_allow_empty,false) then
    return pg_catalog.jsonb_build_object('status','empty_guard','project',pricing_private.result(p));
  end if;
  if p.state=p_state then
    return pg_catalog.jsonb_build_object('status','saved','project',pricing_private.result(p));
  end if;
  update pricing_private.projects set state=p_state,revision=revision+1,
    mutation_id=p_mutation,updated_at=now() where id=p_id returning * into p;
  insert into pricing_private.versions(project_id,revision,state,mutation_id,reason)
    values(p.id,p.revision,p.state,p.mutation_id,case when p_allow_empty then 'confirmed-empty' else 'save' end);
  return pg_catalog.jsonb_build_object('status','saved','project',pricing_private.result(p));
end $$;

create or replace function public.pricing_project_history(p_id uuid,p_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p pricing_private.projects; items jsonb;
begin
  p := pricing_private.authorize(p_id,p_key);
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'revision',v.revision,'savedAt',v.saved_at,'sets',coalesce(pg_catalog.jsonb_array_length(v.state->'customSets'),0))
    order by v.revision desc),'[]'::jsonb) into items
  from (select * from pricing_private.versions where project_id=p_id order by revision desc limit 100) v;
  return pg_catalog.jsonb_build_object('project',pricing_private.result(p)-'state','versions',items);
end $$;

create or replace function public.pricing_project_version(p_id uuid,p_key text,p_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p pricing_private.projects; v pricing_private.versions;
begin
  p := pricing_private.authorize(p_id,p_key);
  select * into v from pricing_private.versions where project_id=p_id and revision=p_revision;
  if not found then raise exception 'Version unavailable' using errcode='22023'; end if;
  return pg_catalog.jsonb_build_object('revision',v.revision,'state',v.state,'savedAt',v.saved_at);
end $$;

revoke all on function public.pricing_project_read(uuid,text) from public, anon, authenticated;
revoke all on function public.pricing_project_save(uuid,text,bigint,jsonb,uuid,boolean) from public, anon, authenticated;
revoke all on function public.pricing_project_history(uuid,text) from public, anon, authenticated;
revoke all on function public.pricing_project_version(uuid,text,bigint) from public, anon, authenticated;
grant execute on function public.pricing_project_read(uuid,text) to anon, authenticated;
grant execute on function public.pricing_project_save(uuid,text,bigint,jsonb,uuid,boolean) to anon, authenticated;
grant execute on function public.pricing_project_history(uuid,text) to anon, authenticated;
grant execute on function public.pricing_project_version(uuid,text,bigint) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
