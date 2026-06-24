-- Historical no-op migration.
-- Email alert storage was removed from the current schema before this branch was finalized.
-- Keep this migration executable so existing migration order remains stable without
-- reintroducing removed email columns.
DO $$
BEGIN
    RAISE NOTICE 'No-op: email alert profile fields are not part of the current schema.';
END $$;
