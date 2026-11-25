-- Clockus: "Delete account" in Settings › Account and data
-- Run this once in Supabase › SQL Editor.
--
-- The page calls  sb.rpc('delete_my_account')  with the signed in person's own session.
-- The function takes the id only from that session (auth.uid()), never from the page,
-- so nobody can delete another person's account. No service key is used in the page.
-- Everything happens in one transaction: if any step fails, nothing is deleted.

-- STEP 1 (check before creating the function): which column of `tasks` holds the owner?
-- The app never sends it, so it is filled by the database (usually: default auth.uid()).
-- The function below assumes it is called `user_id`. If yours has another name,
-- change `user_id` on the line marked  <-- OWNER COLUMN  before running step 2.
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'tasks'
order by ordinal_position;

-- STEP 2: the function
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    uid uuid := auth.uid();
begin
    if uid is null then
        raise exception 'Not signed in' using errcode = '42501';
    end if;

    delete from public.tasks where user_id = uid;           -- <-- OWNER COLUMN
    delete from public.user_settings where user_id = uid;
    delete from auth.users where id = uid;                  -- the login itself (sessions and identities go with it)
end;
$$;

-- Only signed in people may call it (each one only for themselves, see above)
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
