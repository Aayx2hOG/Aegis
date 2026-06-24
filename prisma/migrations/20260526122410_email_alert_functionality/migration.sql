-- Historical no-op migration.
-- Email delivery tables/columns were removed in favor of Discord and Telegram
-- notification channels. Keep this migration executable so existing migration order
-- remains stable without reintroducing removed email functionality.
DO $$
BEGIN
    RAISE NOTICE 'No-op: email alert delivery is not part of the current schema.';
END $$;
