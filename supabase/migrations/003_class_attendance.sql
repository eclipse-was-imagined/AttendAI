-- Enforce class membership for class-bound attendance sessions.

create or replace function public.validate_class_attendance()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  session_college uuid;
  session_class uuid;
begin
  select college_id, class_id into session_college, session_class
  from public.sessions where id = new.session_id;

  if session_class is not null and not exists (
    select 1 from public.class_students
    where class_id = session_class
      and college_id = session_college
      and register_no = new.register_no
  ) then
    raise exception 'Student is not enrolled in this class';
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_validate_class on public.attendance;
create trigger attendance_validate_class before insert on public.attendance
for each row execute function public.validate_class_attendance();
