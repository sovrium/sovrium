# Runtime SQL Migrations - Best Practices

← [Previous: Effect Integration](08-effect-integration.md) | [Back to Navigation](01-start.md)

---

## Purpose

This document provides production-ready guidance for:

- Deployment strategies
- Debugging migration failures
- Testing approaches
- Performance optimization
- Operational monitoring
- Error recovery

---

## Production Deployment

### Pre-Deployment Checklist

```markdown
- [ ] Run full test suite (unit + E2E)
- [ ] Review all schema changes in config
- [ ] Check for breaking changes (field type changes, removed fields)
- [ ] Verify database backups are current
- [ ] Test migrations on staging environment
- [ ] Review migration SQL output (debug mode)
- [ ] Ensure database connection is stable
- [ ] Check disk space for large migrations
- [ ] Plan rollback strategy
```

### Deployment Strategy

**Zero-Downtime Deployment**:

```
1. Deploy new app version (don't start yet)
2. Run migrations manually: bun run migrate
3. Verify migrations succeeded
4. Start new app instances
5. Gradually shift traffic from old → new instances
6. Monitor for errors
7. Shut down old instances
```

**Alternative: Rolling Deployment**:

```
1. Deploy to first instance
2. Migrations run automatically on startup
3. Wait 5 minutes, monitor logs
4. If successful, deploy to remaining instances
5. Migrations skip (checksum match) on subsequent instances
```

**Recommended**: Zero-downtime for major schema changes, rolling for minor changes.

---

### Environment Configuration

```bash
# .env.production
DATABASE_URL=postgresql://user:pass@host:5432/db

# Optional: Force skip migrations (emergency only)
SKIP_MIGRATIONS=false

# Optional: Enable migration debug logging
DEBUG_MIGRATIONS=true

# Optional: Migration timeout (milliseconds)
MIGRATION_TIMEOUT=300000  # 5 minutes
```

**Debug Mode**:

```typescript
export const applyRuntimeMigrations = (tables: Tables) =>
  Effect.gen(function* () {
    const debug = process.env.DEBUG_MIGRATIONS === 'true'

    if (debug) {
      yield* Console.log('=== Migration Debug Mode ===')
      yield* Console.log(`Tables: ${tables.length}`)
    }

    const checksum = yield* calculateChecksum(tables)

    if (debug) {
      yield* Console.log(`Checksum: ${checksum}`)
    }

    // ... rest of logic
  })
```

---

## Debugging Migration Failures

### Common Errors

#### Error 1: SQL Syntax Error

**Symptom**:

```
❌ Migration execution failed
Operation: EXECUTE
SQL: CREATE TABLE "users" (email TEXT NOT NULL UNIQUE,)
Cause: PostgresError { code: '42601', message: 'syntax error at or near ")"' }
```

**Diagnosis**: Trailing comma in column list.

**Fix**: Update SQL generator to remove trailing commas.

```typescript
// ❌ Bad
const columns = table.fields.map((f) => generateColumn(f)).join(',\n  ')
const sql = `CREATE TABLE (${columns},)` // Trailing comma

// ✅ Good
const columns = table.fields.map((f) => generateColumn(f)).join(',\n  ')
const sql = `CREATE TABLE (${columns})` // No trailing comma
```

---

#### Error 2: CHECK Constraint Failure

**Symptom**:

```
❌ Migration execution failed
Operation: EXECUTE
SQL: CREATE TABLE "projects" (status TEXT CHECK (status IN (active, done)))
Cause: PostgresError { code: '42703', message: 'column "active" does not exist' }
```

**Diagnosis**: Missing quotes around string literals in CHECK constraint.

**Fix**: Add single quotes.

```typescript
// ❌ Bad
const values = field.options.join(', ') // active, done
const check = `CHECK ("${field.name}" IN (${values}))`

// ✅ Good
const values = field.options.map((opt) => `'${opt}'`).join(', ') // 'active', 'done'
const check = `CHECK ("${field.name}" IN (${values}))`
```

---

#### Error 3: Foreign Key Constraint Violation

**Symptom**:

```
❌ Migration execution failed
Operation: EXECUTE
SQL: ALTER TABLE "tasks" ADD COLUMN author_id INTEGER REFERENCES users(id)
Cause: PostgresError { code: '23503', message: 'insert or update on table "tasks" violates foreign key constraint' }
```

**Diagnosis**: Existing data in `tasks` table has invalid `author_id` values (e.g., NULL, or IDs not in `users` table).

**Fix**: Clean up data before migration or add NOTNULL constraint.

```sql
-- Option 1: Set default value
ALTER TABLE "tasks" ADD COLUMN author_id INTEGER REFERENCES users(id) DEFAULT 1;

-- Option 2: Allow NULL
ALTER TABLE "tasks" ADD COLUMN author_id INTEGER REFERENCES users(id);
```

---

#### Error 4: Table Already Exists

**Symptom**:

```
❌ Migration execution failed
Operation: EXECUTE
SQL: CREATE TABLE "users" (id SERIAL PRIMARY KEY, ...)
Cause: PostgresError { code: '42P07', message: 'relation "users" already exists' }
```

**Diagnosis**: Table was created in a previous migration but checksum changed (config modified without cleaning up database).

**Fix**: Use `CREATE TABLE IF NOT EXISTS` (already implemented) or drop table manually.

```sql
-- Check if table exists
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users';

-- Drop if needed (careful: data loss)
DROP TABLE users CASCADE;
```

---

### Debugging Workflow

**Step 1: Check Logs**

```bash
# View recent logs
tail -f /var/log/sovrium/app.log

# Search for migration errors
grep "Migration execution failed" /var/log/sovrium/app.log
```

**Step 2: Query Migration History**

```sql
-- Check last 10 migrations
SELECT * FROM _sovrium_migrations ORDER BY applied_at DESC LIMIT 10;

-- Check current checksum
SELECT * FROM _sovrium_schema_checksum;
```

**Step 3: Compare Expected vs Actual Schema**

```sql
-- List all tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Describe table structure
\d users

-- Expected: email TEXT NOT NULL UNIQUE
-- Actual:   email TEXT UNIQUE (missing NOT NULL)
```

**Step 4: Reproduce Locally**

```bash
# Dump production config
echo $SOVRIUM_CONFIG > config.json

# Run locally with same config
DATABASE_URL=postgresql://localhost:5432/test bun run start
```

**Step 5: Fix and Redeploy**

1. Fix SQL generation bug in code
2. Test locally
3. Deploy to staging
4. Verify migrations succeed
5. Deploy to production

---

## Testing Strategies

### Unit Tests (SQL Generator)

```typescript
import { describe, test, expect } from 'bun:test'

describe('generateCreateTableSQL', () => {
  test('generates valid SQL for single-line-text field', () => {
    const table = {
      id: 1,
      name: 'users',
      fields: [{ id: 1, name: 'email', type: 'single-line-text', required: true }],
    }

    const sql = generateCreateTableSQL(table)

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "users"')
    expect(sql).toContain('"email" TEXT NOT NULL')
  })

  test('adds UNIQUE constraint for email fields', () => {
    const table = {
      id: 1,
      name: 'users',
      fields: [{ id: 1, name: 'email', type: 'email', required: true, unique: true }],
    }

    const sql = generateCreateTableSQL(table)

    expect(sql).toContain('"email" TEXT NOT NULL UNIQUE')
  })

  test('generates CHECK constraint for single-select', () => {
    const table = {
      id: 1,
      name: 'tasks',
      fields: [{ id: 1, name: 'status', type: 'single-select', options: ['active', 'done'] }],
    }

    const sql = generateCreateTableSQL(table)

    expect(sql).toContain(`CHECK ("status" IN ('active', 'done'))`)
  })
})
```

**Coverage Goal**: 100% of field type mappings.

---

### Integration Tests (Migration Executor)

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sql'

describe('MigrationExecutor', () => {
  let db: Database

  beforeEach(() => {
    db = new Database('postgresql://localhost:5432/test')
    // Clean database
    db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  })

  afterEach(() => {
    db.close()
  })

  test('executes CREATE TABLE migration', async () => {
    const sql = 'CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE);'

    await executeMigrations([sql])

    // Verify table exists
    const tables = await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users'"
    )
    expect(tables).toHaveLength(1)
  })

  test('rolls back on error', async () => {
    const migrations = [
      'CREATE TABLE table1 (id SERIAL PRIMARY KEY);',
      'CREATE TABLE table2 (invalid syntax);', // Error
    ]

    await expect(executeMigrations(migrations)).rejects.toThrow()

    // Verify first table was NOT created (rollback)
    const tables = await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'table1'"
    )
    expect(tables).toHaveLength(0)
  })
})
```

**Coverage Goal**: Happy path + error scenarios (syntax error, constraint violation, rollback).

---

### E2E Tests (Full Pipeline)

```typescript
// specs/app/tables/migrations/migrations.spec.ts
import { test, expect } from '@playwright/test'

test('applies migrations on app startup', async ({ page }) => {
  // GIVEN: App config with 2 tables
  const config = {
    tables: [
      { id: 1, name: 'users', fields: [{ id: 1, name: 'email', type: 'email', required: true }] },
      {
        id: 2,
        name: 'projects',
        fields: [{ id: 1, name: 'name', type: 'single-line-text', required: true }],
      },
    ],
  }

  // WHEN: Start app
  await startApp(config)

  // THEN: Tables should exist
  const tables = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'projects')"
  )
  expect(tables).toHaveLength(2)

  // AND: Checksum should be saved
  const checksum = await db.query('SELECT * FROM _sovrium_schema_checksum')
  expect(checksum).toHaveLength(1)
})

test('skips migrations when config unchanged', async ({ page }) => {
  // GIVEN: App with migrations already applied
  await startApp(config)
  const initialChecksum = await db.query('SELECT checksum FROM _sovrium_schema_checksum')

  // WHEN: Restart app with same config
  await restartApp(config)

  // THEN: Checksum should be unchanged
  const newChecksum = await db.query('SELECT checksum FROM _sovrium_schema_checksum')
  expect(newChecksum[0].checksum).toBe(initialChecksum[0].checksum)
})
```

**Coverage Goal**: See `specs/migrations/` for migration E2E test scenarios.

---

## Performance Optimization

### 1. Checksum-Based Skip (Already Implemented)

**Benefit**: 93-95% reduction in startup time for unchanged configs.

**Monitoring**:

```typescript
// Track checksum match rate
metrics.increment('migrations.checksum.matched')
metrics.increment('migrations.checksum.changed')

// Alert if too many checksum mismatches
if (checksumMatchRate < 0.9) {
  alertOps('High checksum mismatch rate - investigate config changes')
}
```

---

### 2. Parallel SQL Generation (Future)

**Current**: Sequential generation (one table at a time).

```typescript
for (const table of tables) {
  const sql = yield * generateSQL(table) // Blocking
}
```

**Optimized**: Parallel generation (all tables at once).

```typescript
const sqls =
  yield *
  Effect.all(
    tables.map((table) => generateSQL(table)),
    {
      concurrency: 'unbounded',
    }
  )
```

**Benefit**: ~50% reduction in generation time (if CPU-bound).

**Limitation**: DDL execution must remain sequential (dependencies).

---

### 3. Incremental Migrations (Future)

**Current**: Regenerate SQL for all tables on config change.

**Optimized**: Detect which tables changed, only generate SQL for those.

```typescript
const changedTables = detectChangedTables(tables, previousTables)
for (const table of changedTables) {
  const sql = yield * generateSQL(table) // 95% fewer iterations
}
```

**Benefit**: ~95% reduction in generation time for small config changes (e.g., add 1 field).

**Complexity**: Need to store previous table definitions, implement diff algorithm.

---

### 4. Connection Pooling (Already Implemented)

**Bun SQL Driver**: Built-in connection pooling (no configuration needed).

**Benefit**: Reuses database connections across queries (no reconnect overhead).

---

## Monitoring & Alerts

### Metrics to Track

```typescript
// Startup time
metrics.timing('migrations.total_time', totalTime)

// Checksum performance
metrics.timing('migrations.checksum.calculation_time', checksumTime)
metrics.increment('migrations.checksum.matched')
metrics.increment('migrations.checksum.changed')

// SQL generation
metrics.timing('migrations.sql_generation_time', generationTime)
metrics.gauge('migrations.sql_statements_count', migrations.length)

// Execution
metrics.timing('migrations.execution_time', executionTime)
metrics.increment('migrations.success')
metrics.increment('migrations.failure')
```

### Alerts

```yaml
# Alert if migrations fail
- name: migration_failure
  condition: migrations.failure > 0
  severity: critical
  message: 'Migrations failed - app may not start'

# Alert if migrations slow
- name: migration_slow
  condition: migrations.execution_time > 10000 # 10 seconds
  severity: warning
  message: 'Migrations taking longer than expected'

# Alert if checksum never matches (non-deterministic serialization?)
- name: checksum_never_matches
  condition: migrations.checksum.matched == 0 AND restarts > 5
  severity: warning
  message: 'Checksum never matches - investigate config serialization'
```

---

## Error Recovery

### Scenario 1: Migration Fails in Production

**Immediate Actions**:

1. Check logs for error message
2. Query `_sovrium_migrations` to see last successful migration
3. If app crashed, restart with `SKIP_MIGRATIONS=true` (emergency flag)
4. Fix config or SQL generation bug
5. Deploy fix
6. Remove `SKIP_MIGRATIONS=true`
7. Restart app

**Emergency Flag**:

```typescript
if (process.env.SKIP_MIGRATIONS === 'true') {
  yield * Console.warn('⚠️ SKIP_MIGRATIONS enabled - migrations bypassed')
  return // Skip migrations
}
```

**Use Case**: Database is corrupted, need to start app to debug without running migrations.

---

### Scenario 2: Partial Migration (Transaction Rollback Failed)

**Symptom**: Some tables created, others missing. App crashes.

**Diagnosis**: PostgreSQL transaction rollback failed (extremely rare, indicates severe database issue).

**Recovery**:

1. Manually inspect database schema

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

2. Compare with expected schema (from config)
3. Manually fix discrepancies

```sql
-- Drop partially-created tables
DROP TABLE users CASCADE;

-- Recreate from SQL generator output
CREATE TABLE users (...);
```

4. Update checksum to match current config

```sql
UPDATE _sovrium_schema_checksum SET checksum = 'new_checksum' WHERE id = 'singleton';
```

5. Restart app

---

### Scenario 3: Checksum Mismatch But Schema Correct

**Symptom**: Migrations run every time, but schema is already correct.

**Diagnosis**: Checksum not being saved, or non-deterministic serialization.

**Fix 1: Check saveChecksum()**:

```sql
-- Verify checksum is being saved
SELECT * FROM _sovrium_schema_checksum;

-- If empty, saveChecksum() is failing
```

**Fix 2: Ensure deterministic serialization**:

```typescript
// Add key sorting
const json = JSON.stringify(tables, (key, value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = value[key]
        return sorted
      }, {})
  }
  return value
})
```

---

## Rollback Strategy

### Version Control

```bash
# Tag each deployment
git tag v1.0.0
git push origin v1.0.0

# Rollback to previous version
git checkout v0.9.0
bun install
bun run start
```

**Database Rollback**:

- ❌ **NOT automatic** - Drizzle-style rollback requires manual SQL
- ✅ **Manual recovery** - Restore from backup or manually DROP/CREATE tables

**Best Practice**: Always backup database before major schema changes.

---

### Backup Before Migration

```bash
# Automated backup script
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore if needed
psql $DATABASE_URL < backup_20250125_143022.sql
```

---

## Security Considerations

### 1. Prevent SQL Injection

**Risk**: Malicious config could inject SQL.

**Mitigation**: Validate all field names with regex.

```typescript
function validateFieldName(name: string): void {
  // Only allow alphanumeric + underscore
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new SqlGeneratorError({
      message: `Invalid field name: ${name}`,
      field: name,
    })
  }
}
```

---

### 2. Restrict Database Access

**Best Practice**: Only allow schema changes via app config, not manual ALTER TABLE.

**Implementation**: Use PostgreSQL roles to restrict DDL.

```sql
-- Create app user with limited permissions
CREATE USER sovrium_app WITH PASSWORD 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sovrium_app;

-- Prevent manual schema changes
REVOKE CREATE ON SCHEMA public FROM sovrium_app;
```

---

## Next Steps

- [Overview](02-overview.md) - Revisit architecture
- [SQL Generator](03-sql-generator.md) - Implement field type mapping
- [Migration Executor](04-migration-executor.md) - Implement transaction logic

---

## Troubleshooting Quick Reference

| Symptom                                  | Diagnosis                      | Fix                                              |
| ---------------------------------------- | ------------------------------ | ------------------------------------------------ |
| Migrations run every time                | Checksum not saved             | Check `saveChecksum()`, query DB                 |
| SQL syntax error                         | Trailing comma, missing quotes | Update SQL generator                             |
| CHECK constraint failure                 | Missing quotes in values       | Add `'` around string literals                   |
| Foreign key violation                    | Invalid existing data          | Clean up data, use DEFAULT or allow NULL         |
| Table already exists                     | Previous migration failed      | Use `IF NOT EXISTS`, or DROP table manually      |
| Migrations slow (>10s)                   | Large schema                   | Optimize with incremental migrations             |
| App crashes on startup                   | Migration failure              | Check logs, fix config, redeploy                 |
| Checksum mismatch but schema correct     | Non-deterministic JSON         | Add key sorting to serialization                 |
| Partial migration (rollback failed)      | Database corruption            | Manually fix schema, update checksum, restart    |
| Connection timeout during migration      | Network issue                  | Increase `MIGRATION_TIMEOUT`, check DB status    |
| Out of disk space                        | Large migration                | Free up space, increase volume size              |
| PostgreSQL version incompatibility       | DDL syntax difference          | Update SQL generator for specific PG version     |
| Migration succeeds but data missing      | Migration dropped column       | Restore from backup, prevent destructive changes |
| Migration succeeds but app crashes later | Schema mismatch                | Verify generated SQL matches expected schema     |
| Migration hangs indefinitely             | Table lock                     | Kill blocking queries, restart migration         |
| Checksum calculation slow (>1s)          | Extremely large config         | Optimize serialization, limit config size        |
| Database connection refused              | DB not running                 | Start PostgreSQL, check connection string        |
| Permission denied on CREATE TABLE        | Insufficient privileges        | Grant CREATE permission to app user              |
| Migration tracking table doesn't exist   | First run bootstrap issue      | Create `_sovrium_migrations` table manually      |
| Duplicate key error on checksum save     | Concurrent migrations          | Use singleton row pattern, serialize migrations  |
| OOM (out of memory) during migration     | Too many tables                | Increase app memory, batch migrations            |
| Migration succeeded but tests fail       | Schema drift                   | Regenerate test snapshots, verify schema         |
| Migration failed with no error logs      | Silent crash                   | Enable debug logging, check system logs          |
| Checksum matches but schema incomplete   | Manual schema modification     | Force re-run with `DELETE FROM checksum` table   |
| Migration succeeded but API returns 500  | Schema mismatch in code        | Update Effect Schema to match new DB schema      |
| Migration rollback failed                | Transaction already committed  | Manually restore from backup                     |
| Migration timeout exceeded               | Very large migration           | Increase timeout, optimize SQL (batch inserts)   |

---

**Key Takeaway**: Production deployments require careful testing, monitoring, and rollback planning. Always backup before major schema changes. Use debug logging to diagnose issues quickly. Fail-fast behavior ensures errors are caught immediately, not silently corrupted.
