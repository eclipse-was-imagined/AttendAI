-- Teacher corrections with an immutable audit trail.

create table if not exists public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  changed_by uuid not null references auth.users(id),
  old_status text not null,
  new_status text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.attendance_corrections enable row level security;

drop policy if exists attendance_corrections_access on public.attendance_corrections;
create policy attendance_corrections_access on public.attendance_corrections for all
using (
  public.is_college_admin(college_id)
  or exists (
    select 1 from public.attendance a
    join public.sessions s on s.id = a.session_id
    join public.teachers t on t.college_id = s.college_id and t.faculty_id = s.faculty_id
    where a.id = attendance_corrections.attendance_id and lower(t.email) = lower(auth.email())
  )
)
with check (changed_by = auth.uid() and (
  public.is_college_admin(college_id)
  or exists (
    select 1 from public.attendance a
    join public.sessions s on s.id = a.session_id
    join public.teachers t on t.college_id = s.college_id and t.faculty_id = s.faculty_id
    where a.id = attendance_corrections.attendance_id and lower(t.email) = lower(auth.email())
  )
));

drop policy if exists attendance_teacher_update on public.attendance;
create policy attendance_teacher_update on public.attendance for update
using (exists (
  select 1 from public.sessions s
  join public.teachers t on t.college_id = s.college_id and t.faculty_id = s.faculty_id
  where s.id = attendance.session_id and lower(t.email) = lower(auth.email())
))
with check (exists (
  select 1 from public.sessions s
  join public.teachers t on t.college_id = s.college_id and t.faculty_id = s.faculty_id
  where s.id = attendance.session_id and lower(t.email) = lower(auth.email())
));
