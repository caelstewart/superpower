-- Superpower schema. Portable SQL: runs on SQLite (local mode) and PostgreSQL
-- (hosted mode) with no changes except the AUTOINCREMENT/SERIAL noted below.

CREATE TABLE IF NOT EXISTS voices (
  id             TEXT PRIMARY KEY,              -- kebab-case slug
  name           TEXT NOT NULL,
  description    TEXT NOT NULL,                 -- when-to-use; surfaced to host agents
  identity       TEXT NOT NULL,                 -- system-prompt identity block
  thinking       TEXT NOT NULL DEFAULT '',      -- how this voice thinks (ideation doc)
  guidelines     TEXT NOT NULL DEFAULT '',      -- prose style rules (checkable, short)
  default_type   TEXT NOT NULL DEFAULT 'post',  -- default content_type
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS specimens (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,  -- SERIAL on Postgres
  voice_id       TEXT NOT NULL REFERENCES voices(id) ON DELETE CASCADE,
  content_type   TEXT NOT NULL DEFAULT 'post',  -- post | email | ad | landing-page | ...
  title          TEXT NOT NULL,
  subtitle       TEXT NOT NULL DEFAULT '',
  body           TEXT NOT NULL,
  word_count     INTEGER NOT NULL DEFAULT 0,
  quality        INTEGER NOT NULL DEFAULT 3,    -- 1-5; exemplar selection prefers higher
  source         TEXT NOT NULL DEFAULT 'import',-- import | approved | scraped:<url>
  written_at     TEXT NOT NULL DEFAULT '',      -- original publish date if known
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_specimens_voice_type
  ON specimens(voice_id, content_type, quality);

CREATE TABLE IF NOT EXISTS lint_rules (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,  -- SERIAL on Postgres
  voice_id       TEXT NOT NULL REFERENCES voices(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL,   -- banned_string | banned_pattern | max_sentence_words | required_pattern
  value          TEXT NOT NULL,
  message        TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'error',      -- error | warn
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lint_voice ON lint_rules(voice_id);

CREATE TABLE IF NOT EXISTS generations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,  -- SERIAL on Postgres
  voice_id       TEXT NOT NULL,
  content_type   TEXT NOT NULL,
  brief          TEXT NOT NULL,
  output         TEXT NOT NULL,
  provider       TEXT NOT NULL,
  model          TEXT NOT NULL,
  exemplar_count INTEGER NOT NULL DEFAULT 0,
  lint_failures  INTEGER NOT NULL DEFAULT 0,
  revised        INTEGER NOT NULL DEFAULT 0,        -- 0/1: lint triggered a revision pass
  duration_ms    INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,  -- SERIAL on Postgres
  email          TEXT NOT NULL UNIQUE,
  api_key        TEXT NOT NULL UNIQUE,
  plan           TEXT NOT NULL DEFAULT 'trial',      -- trial | pro
  stripe_status  TEXT NOT NULL DEFAULT 'none',       -- none | active | past_due | canceled
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accounts_key ON accounts(api_key);
