-- Organization structure for admin, teacher, and student workspaces.

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  name text not null,
  code text not null,
  created_at timestamptz not null default now(),
  unique (college_id, code)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  name text not null,
  code text not null,
  teacher_faculty_id text,
  created_at timestamptz not null default now(),
  unique (college_id, code)
);

create table if not exists public.class_students (
  class_id uuid not null references public.classes(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  register_no text not null,
  created_at timestamptz not null default now(),
  primary key (class_id, register_no)
);

alter table public.sessions add column if not exists class_id uuid references public.classes(id) on delete set null;
create index if not exists classes_college_id_idx on public.classes(college_id);
create index if not exists class_students_register_no_idx on public.class_students(college_id, register_no);

alter table public.departments enable row level security;
alter table public.classes enable row level security;
alter table public.class_students enable row level security;

drop policy if exists departments_college_access on public.departments;
create policy departments_college_access on public.departments for all
using (public.is_college_admin(college_id))
with check (public.is_college_admin(college_id));

drop policy if exists classes_college_access on public.classes;
create policy classes_college_access on public.classes for all
using (
  public.is_college_admin(college_id)
  or exists (select 1 from public.teachers t where t.college_id = classes.college_id and t.faculty_id = classes.teacher_faculty_id and lower(t.email) = lower(auth.email()))
)
with check (
  public.is_college_admin(college_id)
  or exists (select 1 from public.teachers t where t.college_id = classes.college_id and t.faculty_id = classes.teacher_faculty_id and lower(t.email) = lower(auth.email()))
);

drop policy if exists class_students_college_access on public.class_students;
create policy class_students_college_access on public.class_students for all
using (
  public.is_college_admin(college_id)
  or exists (select 1 from public.students s where s.college_id = class_students.college_id and s.register_no = class_students.register_no and lower(s.email) = lower(auth.email()))
  or exists (select 1 from public.classes c join public.teachers t on t.college_id = c.college_id and t.faculty_id = c.teacher_faculty_id where c.id = class_students.class_id and lower(t.email) = lower(auth.email()))
)
with check (
  public.is_college_admin(college_id)
  or exists (select 1 from public.classes c join public.teachers t on t.college_id = c.college_id and t.faculty_id = c.teacher_faculty_id where c.id = class_students.class_id and lower(t.email) = lower(auth.email()))
);

drop policy if exists students_teacher_read on public.students;
create policy students_teacher_read on public.students for select using (
  exists (select 1 from public.teachers t where t.college_id = students.college_id and lower(t.email) = lower(auth.email()))
);

drop policy if exists sessions_student_read on public.sessions;
create policy sessions_student_read on public.sessions for select using (
  exists (select 1 from public.students st where st.college_id = sessions.college_id and lower(st.email) = lower(auth.email()))
);
