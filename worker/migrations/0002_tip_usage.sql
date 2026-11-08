CREATE TABLE tip_usage (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_id, usage_date)
);
CREATE TABLE tip_global_usage (
  usage_date TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
