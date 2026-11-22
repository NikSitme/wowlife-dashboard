-- Separate shared calculator snapshots. Existing pricing project remains unchanged.
-- User approved named calculator cases being common to all dashboard visitors, 22.11.2026.
begin;
insert into pricing_private.projects(id,key_hash,title,public_access,state)
values ('2ad61b72-d95c-4e89-b56a-d9790012d583',pg_catalog.sha256(pg_catalog.convert_to(gen_random_uuid()::text,'UTF8')),'Юнит-экономика — общие кейсы',true,'{"customSets":[],"ov":{},"sov":{},"customServices":{},"unitCases":{}}'::jsonb)
on conflict (id) do nothing;
commit;
select id,title,public_access,revision,(select count(*) from jsonb_object_keys(state->'unitCases')) as cases from pricing_private.projects where id='2ad61b72-d95c-4e89-b56a-d9790012d583';
