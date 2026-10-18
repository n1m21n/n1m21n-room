-- per-address cooldown (stored as a short salted hash, not the address)
ALTER TABLE nudges ADD COLUMN ip TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS nudges_ip ON nudges (ip, t);
