CREATE TABLE users (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  last_active_at TEXT
);
CREATE TABLE habits (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  payload TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  last_operation_id TEXT NOT NULL,
  PRIMARY KEY (owner_id, id)
);
CREATE TABLE completions (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  completion_date TEXT NOT NULL,
  payload TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  last_operation_id TEXT NOT NULL,
  PRIMARY KEY (owner_id, id),
  UNIQUE (owner_id, habit_id, completion_date),
  FOREIGN KEY (owner_id, habit_id) REFERENCES habits(owner_id, id) ON DELETE CASCADE
);
CREATE TABLE changes (
  revision INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('habit', 'completion')),
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  version INTEGER NOT NULL,
  UNIQUE (owner_id, operation_id)
);
CREATE INDEX changes_owner_revision ON changes(owner_id, revision);
CREATE TABLE receipts (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,
  result TEXT NOT NULL,
  PRIMARY KEY (owner_id, operation_id)
);
CREATE TABLE activity_days (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, activity_date)
);
CREATE TABLE registration_limits (
  ip_hash TEXT NOT NULL,
  activity_date TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count BETWEEN 0 AND 20),
  PRIMARY KEY (ip_hash, activity_date)
);
