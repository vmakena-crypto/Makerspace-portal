-- =====================================================================
-- MIGRATION 001 - login without email or Google
-- Run once in Supabase SQL Editor, AFTER makerspace_schema.sql.
--
-- Students: no login. Scanning the lab QR creates an anonymous account that
--           the phone remembers. Creating that account REQUIRES the current
--           lab QR token, so nobody can register without the QR.
-- Staff:    email + password accounts created by an admin in the Supabase
--           dashboard. The email must be added to allowed_emails first.
--
-- Also turn on in the dashboard (see README):
--   Authentication -> Sign In / Providers -> Allow anonymous sign-ins
--   Authentication -> Rate Limits -> raise the anonymous sign-ins limit
-- =====================================================================

-- 1. Who may create an account
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  if coalesce(new.is_anonymous, false) then
    -- student registering from the lab QR code
    select value into tok from public.settings where key = 'checkin_token';
    if tok is null or coalesce(new.raw_user_meta_data->>'lab_token', '') <> tok then
      raise exception 'Invalid lab QR code';
    end if;
    insert into public.profiles(id, email, full_name) values (new.id, null, '');
  else
    -- staff: the email must be approved first
    if not exists (select 1 from public.allowed_emails
                    where email = lower(coalesce(new.email, ''))) then
      raise exception 'Email not approved';
    end if;
    insert into public.profiles(id, email, full_name)
    values (new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'full_name', ''));
  end if;
  return new;
end $$;
-- (the on_auth_user_created trigger from makerspace_schema.sql already calls this function)

-- 2. One registration number = one student
create unique index if not exists profiles_reg_no_unique
  on public.profiles (lower(reg_no))
  where reg_no is not null and reg_no <> '';

-- If a student changes phone and is blocked as "already registered", free the old record
-- (keeps their visit history on the old record). Run in the SQL Editor:
--   update public.profiles
--      set reg_no = reg_no || ' (old)'
--    where lower(reg_no) = lower('THEIR-REG-NO');
