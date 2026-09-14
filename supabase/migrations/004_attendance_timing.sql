-- Session duration and late attendance status.

alter table public.sessions add column if not exists starts_at timestamptz not null default now();
alter table public.sessions add column if not exists ends_at timestamptz;
alter table public.sessions add column if not exists late_after_minutes integer not null default 10;

alter table public.attendance add column if not exists status text not null default 'present';
alter table public.attendance drop constraint if exists attendance_status_check;
alter table public.attendance add constraint attendance_status_check check (status in ('present', 'late'));
