-- chat errands: what he does for the stream's chat, scheduled by the server so every site plays it at the same moment
CREATE TABLE IF NOT EXISTS chatq (seq INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, t0 INTEGER NOT NULL, secs INTEGER NOT NULL, cmd TEXT NOT NULL, name TEXT NOT NULL, arg TEXT NOT NULL DEFAULT '', votes INTEGER NOT NULL DEFAULT 1, self INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS chatq_t0 ON chatq (t0);
