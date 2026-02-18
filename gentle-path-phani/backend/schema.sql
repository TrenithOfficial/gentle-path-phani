-- Users (admin/client profile data; auth is in Firebase)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'client', -- 'admin' or 'client'
  start_date    DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily guidance content (phase/day based)
CREATE TABLE IF NOT EXISTS daily_guidance (
  id         UUID PRIMARY KEY,
  phase_id   INT NOT NULL,
  day        INT NOT NULL,
  title      TEXT,
  content    TEXT NOT NULL,
  audio_url  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (phase_id, day)
);

-- Healing sheets (PDFs or resources; can be global to a phase or user-specific)
CREATE TABLE IF NOT EXISTS healing_sheets (
  id          UUID PRIMARY KEY,
  name        TEXT NOT NULL,
  phase_id    INT,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  file_path   TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Protocols (per user)
CREATE TABLE IF NOT EXISTS protocols (
  id        UUID PRIMARY KEY,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  dosage    TEXT,
  timing    TEXT,
  notes     TEXT,
  shop_url  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Check-ins (per user per day)
CREATE TABLE IF NOT EXISTS checkins (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  mood            INT,
  energy          INT,
  notes           TEXT,
  is_travel_day   BOOLEAN NOT NULL DEFAULT false,
  missed_protocol BOOLEAN NOT NULL DEFAULT false,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- Messages (client -> admin + optional admin reply)
CREATE TABLE IF NOT EXISTS messages (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject      TEXT,
  content      TEXT NOT NULL,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read      BOOLEAN NOT NULL DEFAULT false,
  admin_reply  TEXT,
  replied_at   TIMESTAMPTZ
);

-- Chat messages (WhatsApp-style). One thread per user_id.
-- sender_role: 'client' | 'admin'
-- read_at_admin marks when admin viewed client messages
-- read_at_client marks when client viewed admin messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id             UUID PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role    TEXT NOT NULL CHECK (sender_role IN ('client','admin')),
  body           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at_admin  TIMESTAMPTZ,
  read_at_client TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON chat_messages(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread_admin ON chat_messages(user_id) WHERE sender_role='client' AND read_at_admin IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread_client ON chat_messages(user_id) WHERE sender_role='admin' AND read_at_client IS NULL;
