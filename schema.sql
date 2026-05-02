-- MsDent Postgres schema

create table if not exists users (
  id uuid primary key,
  email text not null unique,
  name text not null,
  hashed_password text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key,
  token uuid not null unique,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id uuid primary key,
  phone text not null,
  plan text null,
  doctor_id text null,
  reason text null,
  status text not null default 'new',
  payment_status text null,
  payment_provider text null,
  payment_session_id text null,
  payment_intent_id text null,
  payment_amount_kzt integer null,
  note text null,
  assigned_to text null,
  assigned_at timestamptz null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key,
  provider text not null,
  status text not null,
  amount_kzt integer not null,
  currency text not null default 'kzt',
  booking_id uuid null references bookings(id) on delete set null,
  stripe_session_id text null,
  stripe_payment_intent_id text null,
  metadata jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists consultations (
  id uuid primary key,
  email text not null,
  status text not null default 'new',
  note text null,
  assigned_to text null,
  assigned_at timestamptz null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Backfill for older DBs
alter table bookings add column if not exists status text not null default 'new';
alter table bookings add column if not exists note text null;
alter table bookings add column if not exists doctor_id text null;
alter table bookings add column if not exists reason text null;
alter table bookings add column if not exists assigned_to text null;
alter table bookings add column if not exists assigned_at timestamptz null;
alter table bookings add column if not exists updated_at timestamptz not null default now();
alter table bookings add column if not exists payment_status text null;
alter table bookings add column if not exists payment_provider text null;
alter table bookings add column if not exists payment_session_id text null;
alter table bookings add column if not exists payment_intent_id text null;
alter table bookings add column if not exists payment_amount_kzt integer null;

-- Payments backfill for older DBs
create table if not exists payments (
  id uuid primary key,
  provider text not null,
  status text not null,
  amount_kzt integer not null,
  currency text not null default 'kzt',
  booking_id uuid null references bookings(id) on delete set null,
  stripe_session_id text null,
  stripe_payment_intent_id text null,
  metadata jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table consultations add column if not exists status text not null default 'new';
alter table consultations add column if not exists note text null;
alter table consultations add column if not exists assigned_to text null;
alter table consultations add column if not exists assigned_at timestamptz null;
alter table consultations add column if not exists updated_at timestamptz not null default now();
