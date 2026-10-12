-- =====================================================================
-- MAKERSPACE MANAGEMENT SYSTEM - Supabase schema
-- Run once in: Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- Roles:   student (default) | intern | admin
-- Rules:   all writes that touch stock / visits / requests go through
--          RPC functions (atomic, role-checked). Tables are read-only
--          from the browser except ideas + own profile.
--
-- AFTER RUNNING:
--  1. Auth -> Providers -> enable Google. Add your Pages URL to redirect URLs.
--  2. Log in once with your own email, then make yourself admin:
--       update public.profiles set role = 'admin' where email = 'YOU@...';
--  3. Allowed sign-up emails: edit the seed rows in allowed_domains /
--     allowed_emails below (verify the real GITAM domains).
-- =====================================================================

-- ---------- 0. Allow-lists (who may sign up at all) ------------------
create table if not exists public.allowed_domains (domain text primary key);
create table if not exists public.allowed_emails  (email  text primary key);

insert into public.allowed_domains(domain) values ('gitam.in'), ('gitam.edu')
on conflict do nothing;
-- Interns/admins on personal Gmail? Add them individually:
-- insert into public.allowed_emails(email) values ('someone@gmail.com');

-- ---------- 1. Profiles ----------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique,
  full_name   text not null default '',
  reg_no      text,
  branch      text,
  year        text,
  phone       text,
  role        text not null default 'student' check (role in ('student','intern','admin')),
  profile_complete boolean generated always as (
      coalesce(full_name,'') <> '' and coalesce(reg_no,'') <> '' and coalesce(phone,'') <> ''
  ) stored,
  created_at  timestamptz not null default now()
);

-- Role helpers (security definer => no RLS recursion on profiles)
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.app_role() in ('intern','admin'), false) $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.app_role() = 'admin', false) $$;

-- Create profile on first login; block non-allowed emails
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare dom text := lower(split_part(coalesce(new.email,''), '@', 2));
begin
  if not (
       exists (select 1 from public.allowed_domains where domain = dom)
    or exists (select 1 from public.allowed_emails  where email  = lower(new.email))
  ) then
    raise exception 'Email domain not allowed: %', dom;
  end if;

  insert into public.profiles(id, email, full_name)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nobody can promote themselves (SQL editor / service role has auth.uid() = null => allowed)
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  if auth.uid() is not null and not public.is_admin() then
    new.email := old.email;  -- email is not user-editable
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_staff());
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---------- 2. Settings (QR token etc.) ------------------------------
create table if not exists public.settings (
  key   text primary key,
  value text not null
);
insert into public.settings(key, value)
values ('checkin_token', substr(replace(gen_random_uuid()::text,'-',''), 1, 16))
on conflict do nothing;

alter table public.settings enable row level security;
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for all
  using (public.is_admin()) with check (public.is_admin());

-- QR URL format: https://YOUR-SITE/checkin?t=<checkin_token>
create or replace function public.rotate_checkin_token() returns text
language plpgsql security definer set search_path = public as $$
declare t text := substr(replace(gen_random_uuid()::text,'-',''), 1, 16);
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  update public.settings set value = t where key = 'checkin_token';
  return t;
end $$;

-- ---------- 3. Visits (walk-in / walk-out) ---------------------------
create table if not exists public.visits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  checked_in_at  timestamptz not null default now(),
  checked_out_at timestamptz,
  checked_out_by uuid references public.profiles(id),   -- set when staff checks someone out
  auto_closed    boolean not null default false,        -- true = nobody scanned out
  note           text
);
-- one open visit per person, enforced by the database
create unique index if not exists one_open_visit_per_user
  on public.visits(user_id) where checked_out_at is null;
create index if not exists visits_in_idx on public.visits(checked_in_at);

alter table public.visits enable row level security;
drop policy if exists visits_select on public.visits;
create policy visits_select on public.visits for select
  using (user_id = auth.uid() or public.is_staff());
-- no insert/update/delete policies: use the RPCs below

-- Scan the QR: first scan = check in, next scan = check out
create or replace function public.toggle_visit(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v public.visits; prof public.profiles; tok text;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select value into tok from public.settings where key = 'checkin_token';
  if p_token is distinct from tok then raise exception 'Invalid or expired QR code'; end if;

  select * into prof from public.profiles where id = uid;
  if not prof.profile_complete then raise exception 'Complete your profile first'; end if;

  select * into v from public.visits where user_id = uid and checked_out_at is null for update;
  if found then
    update public.visits set checked_out_at = now() where id = v.id;
    return jsonb_build_object('action','checked_out','at',now());
  else
    insert into public.visits(user_id) values (uid);
    return jsonb_build_object('action','checked_in','at',now());
  end if;
end $$;

-- For the UI: am I currently inside? (show a confirm button instead of blind toggling)
create or replace function public.my_visit_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('inside', true, 'since', checked_in_at)
       from public.visits where user_id = auth.uid() and checked_out_at is null),
    jsonb_build_object('inside', false));
$$;

-- Staff: check someone out
create or replace function public.staff_checkout(p_visit_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  update public.visits
     set checked_out_at = now(), checked_out_by = auth.uid()
   where id = p_visit_id and checked_out_at is null;
end $$;

-- Staff: check someone in (e.g. no phone / forgot to scan)
create or replace function public.staff_checkin(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  if exists (select 1 from public.visits where user_id = p_user_id and checked_out_at is null) then
    raise exception 'Already checked in';
  end if;
  insert into public.visits(user_id, note) values (p_user_id, 'manual check-in by staff');
end $$;

-- Nightly: close anyone still "inside" (called by cron, see bottom)
create or replace function public.auto_close_visits() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.visits set checked_out_at = now(), auto_closed = true
   where checked_out_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.auto_close_visits() from public, anon, authenticated;

-- ---------- 4. Ideas / project pool ----------------------------------
create table if not exists public.ideas (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  description  text not null,
  domain       text,                 -- e.g. robotics, IoT, biotech, software
  team_members text,                 -- free text: names / reg nos
  status       text not null default 'submitted'
               check (status in ('submitted','in_progress','completed','dropped')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create or replace function public.ideas_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_staff() then
    new.owner_id := old.owner_id;
    if new.status is distinct from old.status then
      raise exception 'Only staff can change idea status';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_ideas_touch on public.ideas;
create trigger trg_ideas_touch before update on public.ideas
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_ideas_guard on public.ideas;
create trigger trg_ideas_guard before update on public.ideas
  for each row execute function public.ideas_guard();

alter table public.ideas enable row level security;
drop policy if exists ideas_select on public.ideas;
drop policy if exists ideas_insert on public.ideas;
drop policy if exists ideas_update on public.ideas;
drop policy if exists ideas_delete on public.ideas;
create policy ideas_select on public.ideas for select
  using (owner_id = auth.uid() or public.is_staff());
create policy ideas_insert on public.ideas for insert
  with check ((owner_id = auth.uid() and status = 'submitted') or public.is_staff());
create policy ideas_update on public.ideas for update
  using (owner_id = auth.uid() or public.is_staff());
create policy ideas_delete on public.ideas for delete
  using (public.is_admin());

-- ---------- 5. Projects (admin-managed) ------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  idea_id     uuid references public.ideas(id) on delete set null,
  name        text not null,
  description text,
  status      text not null default 'planned'
              check (status in ('planned','active','on_hold','completed','cancelled')),
  lead_id     uuid references public.profiles(id),
  start_date  date,
  end_date    date,
  notes       text,
  created_at  timestamptz not null default now()
);
alter table public.projects enable row level security;
drop policy if exists projects_select on public.projects;
drop policy if exists projects_write  on public.projects;
create policy projects_select on public.projects for select using (public.is_staff());
create policy projects_write  on public.projects for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- 6. Inventory ---------------------------------------------
create table if not exists public.components (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text,
  part_no       text,
  description   text,
  location      text,                       -- shelf / bin
  stock         integer not null default 0 check (stock >= 0),
  min_stock     integer not null default 0, -- low-stock alert threshold
  is_consumable boolean not null default false,  -- resistors etc.: never returned
  created_at    timestamptz not null default now()
);
create index if not exists components_name_idx on public.components(name);

create table if not exists public.stock_movements (
  id           uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.components(id) on delete cascade,
  delta        integer not null,
  reason       text not null,               -- issue | return | restock | correction
  request_id   uuid,
  by_user      uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

alter table public.components enable row level security;
alter table public.stock_movements enable row level security;
drop policy if exists components_select on public.components;
drop policy if exists components_write  on public.components;
drop policy if exists movements_select  on public.stock_movements;
create policy components_select on public.components for select
  using (auth.uid() is not null);                       -- students browse the catalogue
create policy components_write on public.components for all
  using (public.is_admin()) with check (public.is_admin());
create policy movements_select on public.stock_movements for select
  using (public.is_staff());

-- Admin: restock / correct stock, with an audit row
create or replace function public.adjust_stock(p_component_id uuid, p_delta integer, p_reason text default 'restock')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  update public.components set stock = stock + p_delta where id = p_component_id;
  insert into public.stock_movements(component_id, delta, reason, by_user)
  values (p_component_id, p_delta, p_reason, auth.uid());
end $$;

-- ---------- 7. Component requests ------------------------------------
create table if not exists public.requests (
  id           uuid primary key default gen_random_uuid(),
  idea_id      uuid not null references public.ideas(id) on delete cascade,  -- idea first, always
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending','approved','rejected','issued','closed','cancelled')),
  note         text,
  review_note  text,
  reviewed_by  uuid references public.profiles(id),
  reviewed_at  timestamptz,
  issued_by    uuid references public.profiles(id),
  issued_at    timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.request_items (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.requests(id) on delete cascade,
  component_id uuid not null references public.components(id),
  qty          integer not null check (qty > 0),
  qty_issued   integer not null default 0,
  qty_returned integer not null default 0,
  unique (request_id, component_id)
);

alter table public.requests enable row level security;
alter table public.request_items enable row level security;
drop policy if exists requests_select on public.requests;
drop policy if exists items_select    on public.request_items;
create policy requests_select on public.requests for select
  using (requester_id = auth.uid() or public.is_staff());
create policy items_select on public.request_items for select
  using (exists (select 1 from public.requests r
                  where r.id = request_id
                    and (r.requester_id = auth.uid() or public.is_staff())));
-- no write policies: everything goes through RPCs

-- Student: submit a request against one of their own ideas
-- p_items example: [{"component_id":"<uuid>","qty":2},{"component_id":"<uuid>","qty":1}]
create or replace function public.create_request(p_idea_id uuid, p_items jsonb, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); rid uuid; it jsonb;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.ideas
                  where id = p_idea_id and owner_id = uid
                    and status in ('submitted','in_progress')) then
    raise exception 'Register an active idea first (idea not found, not yours, or closed)';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one component';
  end if;

  insert into public.requests(idea_id, requester_id, note)
  values (p_idea_id, uid, p_note) returning id into rid;

  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.request_items(request_id, component_id, qty)
    values (rid, (it->>'component_id')::uuid, (it->>'qty')::integer);
  end loop;
  return rid;
end $$;

create or replace function public.cancel_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.requests set status = 'cancelled'
   where id = p_request_id and requester_id = auth.uid() and status = 'pending';
end $$;

-- Staff: accept / reject
create or replace function public.review_request(p_request_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  update public.requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_request_id and status = 'pending';
  if not found then raise exception 'Request is not pending'; end if;
end $$;

-- Staff: hand over the parts (decrements stock atomically; all-or-nothing)
create or replace function public.issue_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare it record; cname text; has_returnable boolean;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  if not exists (select 1 from public.requests where id = p_request_id and status = 'approved') then
    raise exception 'Request must be approved first';
  end if;

  for it in select id, component_id, qty from public.request_items
             where request_id = p_request_id order by component_id loop
    update public.components set stock = stock - it.qty
     where id = it.component_id and stock >= it.qty;
    if not found then
      select name into cname from public.components where id = it.component_id;
      raise exception 'Not enough stock for: %', cname;
    end if;
    update public.request_items set qty_issued = it.qty where id = it.id;
    insert into public.stock_movements(component_id, delta, reason, request_id, by_user)
    values (it.component_id, -it.qty, 'issue', p_request_id, auth.uid());
  end loop;

  select exists (select 1 from public.request_items ri
                   join public.components c on c.id = ri.component_id
                  where ri.request_id = p_request_id and not c.is_consumable)
    into has_returnable;

  update public.requests
     set status = case when has_returnable then 'issued' else 'closed' end,
         issued_by = auth.uid(), issued_at = now()
   where id = p_request_id;
end $$;

-- Staff: take back a returnable item (partial returns allowed)
create or replace function public.return_item(p_request_item_id uuid, p_qty integer) returns void
language plpgsql security definer set search_path = public as $$
declare ri public.request_items; comp public.components;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  select * into ri from public.request_items where id = p_request_item_id for update;
  if not found then raise exception 'Item not found'; end if;
  select * into comp from public.components where id = ri.component_id;
  if comp.is_consumable then raise exception 'Consumables are not returned'; end if;
  if p_qty <= 0 or ri.qty_returned + p_qty > ri.qty_issued then
    raise exception 'Invalid return quantity';
  end if;

  update public.request_items set qty_returned = qty_returned + p_qty where id = ri.id;
  update public.components set stock = stock + p_qty where id = ri.component_id;
  insert into public.stock_movements(component_id, delta, reason, request_id, by_user)
  values (ri.component_id, p_qty, 'return', ri.request_id, auth.uid());

  if not exists (select 1 from public.request_items x
                   join public.components c on c.id = x.component_id
                  where x.request_id = ri.request_id and not c.is_consumable
                    and x.qty_returned < x.qty_issued) then
    update public.requests set status = 'closed' where id = ri.request_id;
  end if;
end $$;

-- ---------- 8. Dashboard views (respect RLS of the caller) ------------
create or replace view public.v_inside_now with (security_invoker = true) as
select v.id as visit_id, p.full_name, p.reg_no, p.branch, p.phone, v.checked_in_at
  from public.visits v join public.profiles p on p.id = v.user_id
 where v.checked_out_at is null
 order by v.checked_in_at;

create or replace view public.v_daily_footfall with (security_invoker = true) as
select (checked_in_at at time zone 'Asia/Kolkata')::date as day,
       count(*) as visits,
       count(distinct user_id) as unique_visitors,
       round((avg(extract(epoch from (checked_out_at - checked_in_at)) / 60)
              filter (where checked_out_at is not null and not auto_closed))::numeric) as avg_minutes
  from public.visits
 group by 1 order by 1 desc;

create or replace view public.v_outstanding_items with (security_invoker = true) as
select ri.id as request_item_id, r.id as request_id, p.full_name, p.reg_no, p.phone,
       i.title as idea, c.name as component,
       (ri.qty_issued - ri.qty_returned) as outstanding, r.issued_at
  from public.request_items ri
  join public.requests r   on r.id = ri.request_id
  join public.components c on c.id = ri.component_id
  join public.profiles p   on p.id = r.requester_id
  join public.ideas i      on i.id = r.idea_id
 where not c.is_consumable and ri.qty_issued > ri.qty_returned;

create or replace view public.v_low_stock with (security_invoker = true) as
select id, name, category, location, stock, min_stock
  from public.components where stock <= min_stock order by stock;

-- Flat view for the Google Sheets mirror (IST timestamps)
create or replace view public.v_sheet_visits with (security_invoker = true) as
select v.id,
       p.full_name, p.reg_no, p.branch, p.phone,
       to_char(v.checked_in_at  at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as check_in_ist,
       to_char(v.checked_out_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as check_out_ist,
       v.auto_closed
  from public.visits v join public.profiles p on p.id = v.user_id;

-- =====================================================================
-- OPTIONAL - run SEPARATELY (enable pg_cron in Dashboard -> Database ->
-- Extensions first). Auto-closes open visits nightly at 20:00 IST
-- (= 14:30 UTC). Change the cron string to match your closing time.
--
--   select cron.schedule('close-lab-nightly', '30 14 * * *',
--                        'select public.auto_close_visits()');
-- =====================================================================
