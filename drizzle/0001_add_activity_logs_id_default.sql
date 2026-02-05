-- Add default values for activity_logs columns
-- This allows raw SQL INSERTs (bypassing Drizzle ORM) to work correctly in tests

-- Default UUID for id column
ALTER TABLE system.activity_logs
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- Default empty string for table_id column (required field but not always known in tests)
ALTER TABLE system.activity_logs
  ALTER COLUMN table_id SET DEFAULT '';
