-- a row is now one act of a visitor's summary: how many times (n) and their share of the visit in seconds
ALTER TABLE nudges ADD COLUMN n INTEGER NOT NULL DEFAULT 1;
ALTER TABLE nudges ADD COLUMN secs INTEGER NOT NULL DEFAULT 0;
