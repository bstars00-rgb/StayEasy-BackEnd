-- Supabase-compatible bootstrap.
-- This file intentionally does not add foreign keys from app user_id columns to public.users.
-- Some Supabase projects already have public.users.id as uuid, while the current prototype uses text IDs.

CREATE TABLE IF NOT EXISTS app_users (
  id text PRIMARY KEY,
  provider text NOT NULL DEFAULT 'google',
  provider_subject text UNIQUE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL UNIQUE,
  picture_url text,
  role text DEFAULT 'operator',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cities (
  id text PRIMARY KEY,
  country_id text NOT NULL,
  name_en text,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS memberships (
  id text PRIMARY KEY,
  name text NOT NULL,
  brand text NOT NULL,
  country_id text NOT NULL,
  cities jsonb NOT NULL DEFAULT '[]'::jsonb,
  hotels jsonb NOT NULL DEFAULT '[]'::jsonb,
  annual_fee numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'VND',
  sale_price numeric,
  paid_amount numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  dining_discount integer,
  room_discount integer,
  free_night boolean DEFAULT false,
  spa_benefit boolean DEFAULT false,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  best_for jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_savings numeric NOT NULL DEFAULT 0,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  official_url text,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS membership_cities (
  membership_id text NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  city_id text NOT NULL,
  PRIMARY KEY (membership_id, city_id)
);

CREATE TABLE IF NOT EXISTS membership_hotels (
  id text PRIMARY KEY,
  membership_id text NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  city_id text,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS membership_tags (
  membership_id text NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  tag text NOT NULL,
  PRIMARY KEY (membership_id, tag)
);

CREATE TABLE IF NOT EXISTS membership_scores (
  membership_id text PRIMARY KEY REFERENCES memberships(id) ON DELETE CASCADE,
  family_dining integer,
  staycation integer,
  business_travel integer,
  ease_of_use integer,
  overall integer
);

CREATE TABLE IF NOT EXISTS voucher_templates (
  id text PRIMARY KEY,
  membership_id text NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  template_id text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  quantity integer NOT NULL DEFAULT 1,
  valid_until date NOT NULL,
  city_id text,
  hotels jsonb NOT NULL DEFAULT '[]'::jsonb,
  transferable boolean DEFAULT false,
  note text,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, template_id)
);

CREATE TABLE IF NOT EXISTS voucher_template_hotels (
  voucher_template_id text NOT NULL REFERENCES voucher_templates(id) ON DELETE CASCADE,
  hotel_name text NOT NULL,
  PRIMARY KEY (voucher_template_id, hotel_name)
);

CREATE TABLE IF NOT EXISTS voucher_availability (
  template_id text PRIMARY KEY,
  days_of_week jsonb NOT NULL DEFAULT '[0,1,2,3,4,5,6]'::jsonb,
  min_lead_days integer NOT NULL DEFAULT 0,
  max_advance_days integer NOT NULL DEFAULT 120,
  blackouts jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS holidays (
  id text PRIMARY KEY,
  country_id text NOT NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  key text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_memberships (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  membership_id text NOT NULL REFERENCES memberships(id),
  source text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  activated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS user_memberships_active_idx
  ON user_memberships(user_id, membership_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS voucher_usage (
  user_id text NOT NULL,
  membership_id text NOT NULL REFERENCES memberships(id),
  template_id text NOT NULL,
  used_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, membership_id, template_id)
);

CREATE TABLE IF NOT EXISTS reservations (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  membership_id text NOT NULL REFERENCES memberships(id),
  template_id text NOT NULL,
  title text NOT NULL,
  date date,
  adults integer NOT NULL DEFAULT 1,
  children integer NOT NULL DEFAULT 0,
  child_ages jsonb NOT NULL DEFAULT '[]'::jsonb,
  hotel text,
  note text,
  status text NOT NULL DEFAULT 'requested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  membership_id text NOT NULL REFERENCES memberships(id),
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  buyer_phone text,
  city_id text,
  list_price numeric NOT NULL DEFAULT 0,
  sale_price numeric,
  paid_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'VND',
  commission_rate numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'requested',
  invoice_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transfers (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  membership_id text NOT NULL REFERENCES memberships(id),
  template_id text NOT NULL,
  title text NOT NULL,
  recipient_name text,
  recipient_contact text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistance_requests (
  id text PRIMARY KEY,
  user_id text,
  name text,
  contact text,
  city_id text,
  membership_id text,
  preferred_date date,
  adults integer DEFAULT 0,
  children integer DEFAULT 0,
  request_type text,
  message text,
  status text NOT NULL DEFAULT 'new',
  admin_note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  actor_email text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
