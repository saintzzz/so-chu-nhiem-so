-- CR-114 r1 (codex): the public one-click demo signs visitors into a real
-- auth account. Any visitor could call auth.updateUser({password|email})
-- and permanently break the shared credential for everyone after them.
-- Client-side hiding cannot stop this (the REST call only needs the
-- session). Hard boundary: a trigger on auth.users rejects credential
-- changes for the demo identity.
create or replace function public.block_demo_credential_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email = 'demo.gvcn@nd.scn'
     and (new.encrypted_password is distinct from old.encrypted_password
          or new.email is distinct from old.email) then
    raise exception 'demo account credentials are fixed';
  end if;
  return new;
end;
$$;

drop trigger if exists block_demo_credential_change on auth.users;
create trigger block_demo_credential_change
  before update on auth.users
  for each row execute function public.block_demo_credential_change();
