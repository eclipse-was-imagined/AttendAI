-- AttendAI multi-college foundation.
-- Run this once in the Supabase SQL editor before using /admin.

create extension if not exists pgcrypto;

create table if not exists public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.college_admins (
  college_id uuid not null references public.colleges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (college_id, user_id)
);

alter table public.students add column if not exists college_id uuid references public.colleges(id) on delete cascade;
alter table public.teachers add column if not exists college_id uuid references public.colleges(id) on delete cascade;
alter table public.sessions add column if not exists college_id uuid references public.colleges(id) on delete cascade;
alter table public.attendance add column if not exists college_id uuid references public.colleges(id) on delete cascade;

create index if not exists students_college_id_idx on public.students(college_id);
create index if not exists teachers_college_id_idx on public.teachers(college_id);
create index if not exists sessions_college_id_idx on public.sessions(college_id);
create index if not exists attendance_college_id_idx on public.attendance(college_id);
create unique index if not exists students_college_register_no_uidx on public.students(college_id, register_no);
create unique index if not exists teachers_college_faculty_id_uidx on public.teachers(college_id, faculty_id);

create or replace function public.is_college_admin(target_college uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.college_admins
    where college_id = target_college and user_id = auth.uid()
  );
$$;

create or replace function public.college_from_session(target_session uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select college_id from public.sessions where id = target_session limit 1;
$$;

create or replace function public.fill_attendance_college()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.college_id is null then
    new.college_id := public.college_from_session(new.session_id);
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_fill_college on public.attendance;
create trigger attendance_fill_college before insert on public.attendance
for each row execute function public.fill_attendance_college();

alter table public.colleges enable row level security;
alter table public.college_admins enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;

drop policy if exists colleges_owner_read on public.colleges;
create policy colleges_owner_read on public.colleges for select using (owner_id = auth.uid() or public.is_college_admin(id));
drop policy if exists colleges_owner_insert on public.colleges;
create policy colleges_owner_insert on public.colleges for insert with check (owner_id = auth.uid());
drop policy if exists colleges_owner_update on public.colleges;
create policy colleges_owner_update on public.colleges for update using (owner_id = auth.uid() or public.is_college_admin(id));

drop policy if exists college_admins_self_read on public.college_admins;
create policy college_admins_self_read on public.college_admins for select using (user_id = auth.uid() or public.is_college_admin(college_id));
drop policy if exists college_admins_owner_insert on public.college_admins;
create policy college_admins_owner_insert on public.college_admins for insert with check (user_id = auth.uid() and exists (select 1 from public.colleges c where c.id = college_id and c.owner_id = auth.uid()));

drop policy if exists students_college_access on public.students;
create policy students_college_access on public.students for all using (
  public.is_college_admin(college_id)
  or (auth.email() is not null and lower(email) = lower(auth.email()))
) with check (public.is_college_admin(college_id));

drop policy if exists teachers_college_access on public.teachers;
create policy teachers_college_access on public.teachers for all using (
  public.is_college_admin(college_id) or (auth.email() is not null and lower(email) = lower(auth.email()))
) with check (public.is_college_admin(college_id) or (auth.email() is not null and lower(email) = lower(auth.email())));

drop policy if exists sessions_college_access on public.sessions;
create policy sessions_college_access on public.sessions for all using (
  public.is_college_admin(college_id)
  or exists (select 1 from public.teachers t where t.college_id = sessions.college_id and t.faculty_id = sessions.faculty_id and lower(t.email) = lower(auth.email()))
) with check (
  public.is_college_admin(college_id)
  or exists (select 1 from public.teachers t where t.college_id = sessions.college_id and t.faculty_id = sessions.faculty_id and lower(t.email) = lower(auth.email()))
);

drop policy if exists attendance_college_access on public.attendance;
create policy attendance_college_access on public.attendance for all using (
  public.is_college_admin(college_id)
  or exists (select 1 from public.sessions s join public.teachers t on t.college_id = s.college_id and t.faculty_id = s.faculty_id where s.id = attendance.session_id and lower(t.email) = lower(auth.email()))
  or exists (select 1 from public.students st where st.college_id = attendance.college_id and st.register_no = attendance.register_no and lower(st.email) = lower(auth.email()))
) with check (
  exists (select 1 from public.students st where st.college_id = attendance.college_id and st.register_no = attendance.register_no and lower(st.email) = lower(auth.email()))
  or public.is_college_admin(college_id)
);
