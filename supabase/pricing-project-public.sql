-- 2026-11-12: Nikita explicitly approved viewing and editing for every dashboard visitor.
begin;
alter table pricing_private.projects add column if not exists public_access boolean not null default false;
create or replace function pricing_private.authorize(p_id uuid, p_key text)
returns pricing_private.projects language plpgsql security definer set search_path = '' as $$
declare p pricing_private.projects;
begin
  select * into p from pricing_private.projects where id = p_id;
  if not found then raise exception 'Project unavailable' using errcode = '42501'; end if;
  if not p.public_access and (p_key is null or p_key !~ '^[A-Za-z0-9_-]{43}$'
    or p.key_hash <> pg_catalog.sha256(pg_catalog.convert_to(p_key, 'UTF8'))) then
    raise exception 'Project unavailable' using errcode = '42501';
  end if;
  return p;
end $$;
revoke all on function pricing_private.authorize(uuid,text) from public, anon, authenticated;


update pricing_private.projects set public_access=true, title='Общий прайс — услуги и наборы'
where id='0ff5bd23-e903-460c-8987-a76f30fff0ac';
notify pgrst, 'reload schema';
commit;
select id,title,public_access,revision,jsonb_array_length(state->'customSets') as sets
from pricing_private.projects where id='0ff5bd23-e903-460c-8987-a76f30fff0ac';
