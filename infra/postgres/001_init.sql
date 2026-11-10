CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS waitlist (
  email TEXT PRIMARY KEY,
  name TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  objective TEXT NOT NULL,
  to_number_hash TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at BIGINT NOT NULL,
  confirmed_at BIGINT
);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  to_number_hash TEXT,
  objective TEXT NOT NULL,
  state TEXT NOT NULL,
  outcome TEXT,
  started_at BIGINT NOT NULL,
  ended_at BIGINT,
  provider_sid TEXT
);

CREATE TABLE IF NOT EXISTS call_events (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  ts BIGINT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  trigger TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transcript_segments (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  ts BIGINT NOT NULL,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  confidence REAL,
  lang TEXT
);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  ts BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  consent_id TEXT NOT NULL REFERENCES consents(id),
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calls_user_started ON calls(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_call_ts ON call_events(call_id, ts);
CREATE INDEX IF NOT EXISTS idx_transcripts_call_ts ON transcript_segments(call_id, ts);
CREATE INDEX IF NOT EXISTS idx_tasks_user_created ON tasks(user_id, created_at DESC);
