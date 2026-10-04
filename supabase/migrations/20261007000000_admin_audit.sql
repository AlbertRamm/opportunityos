-- Append-only record of who was made / stopped being an OpportunityOS admin, and when.
-- Written only by a trigger on public.admins; no API role can read or write it (inspect it in the SQL editor).
-- Idempotent.
create table if not exists public.admin_audit (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  action     text not null check (action in ('grant','revoke')),
  user_id    uuid not null,
  email      text,                 -- copied at the time, because auth.users rows can be deleted
  done_by    text not null default current_user
);
alter table public.admin_audit enable row level security;   -- no policies, no grants: invisible to anon/authenticated

create or replace function public.audit_admins() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.admin_audit (action, user_id, email)
      values ('grant', new.user_id, (select email from auth.users where id = new.user_id));
    return new;
  else
    insert into public.admin_audit (action, user_id, email)
      values ('revoke', old.user_id, (select email from auth.users where id = old.user_id));
    return old;
  end if;
end $$;
revoke all on function public.audit_admins() from public, anon, authenticated;

drop trigger if exists admins_audit on public.admins;
create trigger admins_audit after insert or delete on public.admins
  for each row execute function public.audit_admins();
