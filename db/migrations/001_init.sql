-- Parking Agency: initial schema (PostgreSQL 16 + PostGIS)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- enums ----------
CREATE TYPE user_role      AS ENUM ('user', 'admin');
CREATE TYPE listing_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE vehicle_type   AS ENUM ('car', 'motorcycle');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled');

-- ---------- users ----------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name          text NOT NULL,
  role          user_role NOT NULL DEFAULT 'user',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- listings (parking spaces submitted by owners) ----------
CREATE TABLE listings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                 text NOT NULL,
  description           text NOT NULL DEFAULT '',
  address               text NOT NULL,
  location              geography(Point, 4326) NOT NULL,
  area_sqm              numeric(8,2),
  car_capacity          int NOT NULL DEFAULT 0 CHECK (car_capacity >= 0),
  motorcycle_capacity   int NOT NULL DEFAULT 0 CHECK (motorcycle_capacity >= 0),
  car_price_per_hour    numeric(10,2) NOT NULL DEFAULT 0 CHECK (car_price_per_hour >= 0),
  moto_price_per_hour   numeric(10,2) NOT NULL DEFAULT 0 CHECK (moto_price_per_hour >= 0),
  status                listing_status NOT NULL DEFAULT 'pending',
  reject_reason         text,
  commission_rate       numeric(5,4) NOT NULL DEFAULT 0.1500 CHECK (commission_rate BETWEEN 0 AND 1),
  reviewed_by           uuid REFERENCES users(id),
  reviewed_at           timestamptz,
  -- Reserved for the future AI review step (photo/area/capacity verification).
  ai_review             jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (car_capacity + motorcycle_capacity > 0)
);
CREATE INDEX listings_location_gix ON listings USING gist (location);
CREATE INDEX listings_status_idx   ON listings (status);
CREATE INDEX listings_owner_idx    ON listings (owner_id);

CREATE TABLE listing_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url         text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0
);
CREATE INDEX listing_photos_listing_idx ON listing_photos (listing_id);

-- Weekly opening hours defined by the owner, in Asia/Bangkok local time.
-- day_of_week: 0 = Sunday ... 6 = Saturday (same as EXTRACT(DOW ...)).
CREATE TABLE listing_availability (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  day_of_week  int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_hour   int NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour     int NOT NULL CHECK (end_hour BETWEEN 1 AND 24),
  CHECK (end_hour > start_hour)
);
CREATE INDEX listing_availability_listing_idx ON listing_availability (listing_id);

-- ---------- bookings (hourly) ----------
CREATE TABLE bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type  vehicle_type NOT NULL,
  start_at      timestamptz NOT NULL,
  end_at        timestamptz NOT NULL,
  status        booking_status NOT NULL DEFAULT 'confirmed',
  total_price   numeric(10,2) NOT NULL DEFAULT 0,
  commission    numeric(10,2) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  -- hour-aligned bookings only
  CHECK (date_trunc('hour', start_at) = start_at AND date_trunc('hour', end_at) = end_at)
);
CREATE INDEX bookings_listing_time_idx ON bookings (listing_id, start_at, end_at) WHERE status = 'confirmed';
CREATE INDEX bookings_user_idx ON bookings (user_id, start_at DESC);

-- True when every hour in [p_start, p_end) falls inside the owner's weekly schedule.
CREATE OR REPLACE FUNCTION listing_is_open(p_listing uuid, p_start timestamptz, p_end timestamptz)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM generate_series(p_start, p_end - interval '1 hour', interval '1 hour') AS h
    WHERE NOT EXISTS (
      SELECT 1 FROM listing_availability a
      WHERE a.listing_id = p_listing
        AND a.day_of_week = EXTRACT(DOW  FROM h AT TIME ZONE 'Asia/Bangkok')::int
        AND EXTRACT(HOUR FROM h AT TIME ZONE 'Asia/Bangkok')::int >= a.start_hour
        AND EXTRACT(HOUR FROM h AT TIME ZONE 'Asia/Bangkok')::int <  a.end_hour
    )
  );
$$;

-- Highest number of simultaneous confirmed bookings of one vehicle type
-- in any single hour of [p_start, p_end). Remaining space = capacity - this.
CREATE OR REPLACE FUNCTION listing_peak_usage(
  p_listing uuid, p_start timestamptz, p_end timestamptz, p_vehicle vehicle_type)
RETURNS int
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(MAX(c), 0)::int FROM (
    SELECT count(b.id) AS c
    FROM generate_series(p_start, p_end - interval '1 hour', interval '1 hour') AS h
    LEFT JOIN bookings b
      ON b.listing_id = p_listing
     AND b.vehicle_type = p_vehicle
     AND b.status = 'confirmed'
     AND b.start_at <= h AND b.end_at > h
    GROUP BY h
  ) t;
$$;
