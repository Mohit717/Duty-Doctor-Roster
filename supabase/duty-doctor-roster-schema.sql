create extension if not exists "pgcrypto";

drop table if exists roster_assignments cascade;
drop table if exists roster_leaves cascade;
drop table if exists monthly_rosters cascade;
drop table if exists shift_types cascade;
drop table if exists doctors cascade;

create table doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  gender text not null check (gender in ('female', 'male')),
  weekly_off text not null,
  allowed_shifts text[] not null,
  max_nights_per_month integer not null default 31,
  night_fixed_weekdays text[] not null default '{}',
  exempt_recovery boolean not null default false,
  consecutive_nights_allowed boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table shift_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_time time not null,
  end_time time not null,
  eligible_gender text,
  minimum_doctors integer not null default 1
);

create table monthly_rosters (
  id uuid primary key default gen_random_uuid(),
  month_start date not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table roster_leaves (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(id) on delete cascade,
  leave_date date not null,
  approved boolean not null default true,
  unique (doctor_id, leave_date)
);

create table roster_assignments (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references monthly_rosters(id) on delete cascade,
  assignment_date date not null,
  shift_type_id uuid not null references shift_types(id),
  doctor_id uuid references doctors(id) on delete set null,
  is_active boolean not null default true,
  is_manual_override boolean not null default false,
  source text not null default 'generated' check (source in ('generated', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (roster_id, assignment_date, shift_type_id)
);

insert into doctors (name, gender, weekly_off, allowed_shifts, max_nights_per_month, night_fixed_weekdays, exempt_recovery, consecutive_nights_allowed, notes) values
('Dr. Meera Kapoor', 'female', 'wednesday', '{Morning,Day,OBGYN,Afternoon,Night}', 31, '{}', false, false, 'Subject to post-night recovery rule'),
('Dr. Rohan Khanna', 'male', 'friday', '{Morning,Day,Afternoon,Night}', 31, '{monday,tuesday,wednesday,thursday}', true, true, 'Four fixed Night shifts Monday-Thursday, plus one Morning and one Afternoon weekly'),
('Dr. Aditya Nair', 'male', 'thursday', '{Morning,Day,OBGYN,Afternoon,Night}', 31, '{}', false, false, 'Subject to post-night recovery rule'),
('Dr. Priya Sharma', 'female', 'tuesday', '{Morning,Day,OBGYN,Afternoon,Night}', 31, '{}', false, false, 'Subject to post-night recovery rule'),
('Dr. Imran Siddiqui', 'male', 'sunday', '{Day,Night}', 2, '{}', false, false, 'Day Shift only; maximum 2 Night shifts per month'),
('Dr. Kavya Menon', 'female', 'saturday', '{Morning,Day,OBGYN,Afternoon,Night}', 31, '{}', false, false, 'Subject to post-night recovery rule');

insert into shift_types (name, start_time, end_time, eligible_gender, minimum_doctors) values
('Morning', '08:00', '14:00', null, 1),
('Day', '10:00', '18:00', null, 1),
('OBGYN', '10:00', '18:00', 'female', 1),
('Afternoon', '14:00', '20:00', null, 1),
('Night', '20:00', '08:00', null, 1);

insert into roster_leaves (doctor_id, leave_date)
select id, leave_date::date from doctors join (values
  ('Dr. Meera Kapoor', '2026-06-05'),
  ('Dr. Aditya Nair', '2026-06-12'),
  ('Dr. Priya Sharma', '2026-06-19'),
  ('Dr. Kavya Menon', '2026-06-23')
) as seeded(name, leave_date) using (name);
