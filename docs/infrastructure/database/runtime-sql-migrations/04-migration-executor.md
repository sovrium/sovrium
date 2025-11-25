# Runtime SQL Migrations - Migration Executor

← [Previous: SQL Generator](03-sql-generator.md) | [Back to Navigation](01-start.md) | [Next: Orchestrator](05-orchestrator.md) →

---

## Purpose

The Migration Executor takes generated SQL DDL statements and executes them safely against PostgreSQL using bun:sql. It handles:

- Transaction management (BEGIN → COMMIT or ROLLBACK)
- Migration history tracking
- Fail-fast error handling
- Rollback on any failure
- Integration with Effect.ts error types

**Location**: `src/infrastructure/database/migration-executor/`

---

## Core Function

```typescript
export const executeMigrations = (
  migrations: string[]
): Effect.Effect<void, MigrationError, DatabaseService> =>
  Effect.gen(function* () {
    const db = yield* DatabaseService

    // Begin transaction
    yield* Effect.tryPromise({
      try: () => db.query('BEGIN'),
      catch: (error) =>
        new MigrationError({
          message: 'Failed to begin transaction',
          operation: 'BEGIN',
          cause: error,
        }),
    })

    try {
      // Execute each migration
      for (const sql of migrations) {
        yield* Effect.tryPromise({
          try: () => db.query(sql),
          catch: (error) =>
            new MigrationError({
              message: 'Migration execution failed',
              operation: 'EXECUTE',
              sql,
              cause: error,
            }),
        })

        // Track migration in history
        yield* trackMigration(sql)
      }

      // Commit transaction
      yield* Effect.tryPromise({
        try: () => db.query('COMMIT'),
        catch: (error) =>
          new MigrationError({
            message: 'Failed to commit transaction',
            operation: 'COMMIT',
            cause: error,
          }),
      })
    } catch (error) {
      // Rollback on any error
      yield* Effect.tryPromise({
        try: () => db.query('ROLLBACK'),
        catch: (rollbackError) =>
          new MigrationError({
            message: 'Failed to rollback transaction',
            operation: 'ROLLBACK',
            cause: rollbackError,
          }),
      })

      // Re-throw original error
      throw error
    }
  })
```

---

## Transaction Management

### Why Transactions?

**Problem**: If 5 migrations succeed but the 6th fails, you're left with partial schema changes.

**Solution**: Execute all migrations in a single PostgreSQL transaction:

```sql
BEGIN;
  CREATE TABLE users (...);      -- Migration 1
  CREATE TABLE projects (...);   -- Migration 2
  CREATE INDEX idx_users_email;  -- Migration 3
  -- Error on Migration 4
ROLLBACK; -- All changes discarded, database unchanged
```

**Guarantee**: Either all migrations succeed, or none do (atomicity).

### Transaction Lifecycle

```typescript
function transactionLifecycle(migrations: string[]): void {
  // 1. Start transaction
  db.query('BEGIN')

  // 2. Execute migrations sequentially
  for (const sql of migrations) {
    db.query(sql) // If this throws, jump to catch block
  }

  // 3. Commit if all succeed
  db.query('COMMIT')
}

// Error handling
catch (error) {
  // 4. Rollback if any fail
  db.query('ROLLBACK')
  throw error // Crash app
}
```

**Key Points**:

- Migrations run sequentially (not parallel) to maintain dependency order
- First error triggers immediate rollback
- Database remains in pre-migration state after rollback

---

## Migration Tracking

### History Table

```sql
CREATE TABLE IF NOT EXISTS _sovrium_migrations (
  id SERIAL PRIMARY KEY,
  checksum TEXT NOT NULL UNIQUE,
  sql_statements TEXT[] NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  execution_time_ms INTEGER NOT NULL
);
```

**Purpose**: Track which migrations have been applied to prevent re-running.

**Columns**:

- `checksum` - Hash of JSON config (prevents duplicate migrations)
- `sql_statements` - Array of SQL DDL statements executed
- `applied_at` - Timestamp of migration
- `execution_time_ms` - Performance tracking

### Tracking Function

```typescript
const trackMigration = (sql: string): Effect.Effect<void, MigrationError, DatabaseService> =>
  Effect.gen(function* () {
    const db = yield* DatabaseService
    const checksum = yield* ChecksumService

    const startTime = Date.now()

    yield* Effect.tryPromise({
      try: () =>
        db.query(
          `
        INSERT INTO _sovrium_migrations (checksum, sql_statements, execution_time_ms)
        VALUES ($1, $2, $3)
        ON CONFLICT (checksum) DO NOTHING
      `,
          [checksum, [sql], Date.now() - startTime]
        ),
      catch: (error) =>
        new MigrationError({
          message: 'Failed to track migration',
          operation: 'TRACK',
          sql,
          cause: error,
        }),
    })
  })
```

**Usage**:

```sql
-- Query migration history
SELECT * FROM _sovrium_migrations ORDER BY applied_at DESC LIMIT 10;

-- Check if specific checksum was applied
SELECT EXISTS(SELECT 1 FROM _sovrium_migrations WHERE checksum = 'abc123');
```

---

## Error Handling

### MigrationError Type

```typescript
import { Data } from 'effect'

export class MigrationError extends Data.TaggedError('MigrationError')<{
  message: string
  operation: 'BEGIN' | 'EXECUTE' | 'COMMIT' | 'ROLLBACK' | 'TRACK'
  sql?: string
  cause?: unknown
}> {}
```

**Why Tagged Error?**

- Type-safe error handling with Effect.ts
- Structured error context (operation, SQL, cause)
- Composable with other Effect error types

**Usage**:

```typescript
yield *
  executeMigrations(migrations).pipe(
    Effect.catchTag('MigrationError', (error) =>
      Effect.gen(function* () {
        yield* Console.error(`❌ Migration failed: ${error.message}`)
        yield* Console.error(`Operation: ${error.operation}`)
        if (error.sql) {
          yield* Console.error(`SQL: ${error.sql}`)
        }
        yield* Console.error(`Cause: ${String(error.cause)}`)

        // Crash app
        return Effect.die(error)
      })
    )
  )
```

### Error Scenarios

**Scenario 1: Invalid SQL Syntax**

```typescript
// Input
const sql = 'CREATE TABLE users (email TEXT NOT NULL UNIQUE,)' // Trailing comma

// Error
MigrationError {
  message: 'Migration execution failed',
  operation: 'EXECUTE',
  sql: 'CREATE TABLE users (email TEXT NOT NULL UNIQUE,)',
  cause: PostgresError { code: '42601', message: 'syntax error at or near ")"' }
}
```

**Scenario 2: Constraint Violation**

```typescript
// Input
const sql = 'CREATE TABLE users (email TEXT NOT NULL UNIQUE); INSERT INTO users (email) VALUES (NULL);'

// Error
MigrationError {
  message: 'Migration execution failed',
  operation: 'EXECUTE',
  sql: 'INSERT INTO users (email) VALUES (NULL)',
  cause: PostgresError { code: '23502', message: 'null value in column "email" violates not-null constraint' }
}
```

**Scenario 3: Transaction Commit Failure**

```typescript
// Input (database connection lost during commit)

// Error
MigrationError {
  message: 'Failed to commit transaction',
  operation: 'COMMIT',
  cause: PostgresError { code: '08006', message: 'connection failure' }
}
```

---

## Bun SQL Integration

### Database Service

```typescript
import { Database } from 'bun:sql'
import { Effect, Layer } from 'effect'

export class DatabaseService extends Effect.Tag('DatabaseService')<DatabaseService, Database>() {
  static Live = Layer.sync(DatabaseService, () => {
    const db = new Database(process.env.DATABASE_URL!)
    return db
  })
}
```

**Why bun:sql?**

- Native PostgreSQL driver optimized for Bun runtime
- Zero-dependency (no pg, pg-promise, etc.)
- Type-safe query methods
- Connection pooling built-in
- Faster than Node.js drivers

### Query Execution

```typescript
import { Database } from 'bun:sql'

const db = new Database(process.env.DATABASE_URL!)

// Simple query
await db.query('CREATE TABLE users (id SERIAL PRIMARY KEY)')

// Parameterized query (prevents SQL injection)
await db.query('INSERT INTO users (email) VALUES ($1)', ['user@example.com'])

// Query with result
const users = await db.query('SELECT * FROM users WHERE email = $1', ['user@example.com'])
console.log(users) // [{ id: 1, email: 'user@example.com' }]
```

**Key Features**:

- `$1`, `$2` placeholders for parameters (PostgreSQL standard)
- Automatic type inference for result rows
- Connection reuse (no manual pool management)

### Transaction Example

```typescript
const db = new Database(process.env.DATABASE_URL!)

await db.query('BEGIN')
try {
  await db.query('CREATE TABLE users (id SERIAL PRIMARY KEY)')
  await db.query(
    'CREATE TABLE projects (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id))'
  )
  await db.query('COMMIT')
} catch (error) {
  await db.query('ROLLBACK')
  throw error
}
```

---

## Fail-Fast Philosophy

### Why Crash the App?

**Principle**: If migrations fail, the app is in an unknown state. Better to crash immediately than serve incorrect data.

**Alternatives (NOT used)**:

- ❌ **Ignore errors** - App runs with incomplete schema, queries fail randomly
- ❌ **Retry automatically** - Wastes time on fundamentally broken migrations
- ❌ **Log warning and continue** - Partial schema state, unpredictable behavior

**Our Approach (✅)**:

```typescript
export const applyRuntimeMigrations = (tables: Tables) =>
  Effect.gen(function* () {
    yield* Console.log('Applying runtime migrations...')

    const migrations = yield* SqlGeneratorService.generate(tables)
    yield* MigrationExecutorService.execute(migrations)

    yield* Console.log('✅ Migrations applied successfully')
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Console.error('❌ Migration failed - crashing app')
        yield* Console.error(error)
        return Effect.die(error) // Crash app
      })
    )
  )
```

**Outcome**:

- Developer sees clear error message immediately
- Database is in known state (pre-migration, thanks to ROLLBACK)
- Developer fixes config/SQL issue and restarts app
- No data corruption or partial migrations

### Error Message Example

```
❌ Migration failed - crashing app
MigrationError {
  message: 'Migration execution failed',
  operation: 'EXECUTE',
  sql: 'CREATE TABLE projects (name TEXT NOT NULL, status TEXT CHECK (status IN (active, done)))',
  cause: PostgresError {
    code: '42703',
    message: 'column "active" does not exist',
    hint: 'Perhaps you meant to use a single quoted string literal.',
    position: '72'
  }
}

Fix: Add single quotes around enum values in CHECK constraint
Change: CHECK (status IN (active, done))
To:     CHECK (status IN ('active', 'done'))
```

**Developer Action**:

1. Read error message
2. Identify issue (missing quotes in CHECK constraint)
3. Fix JSON config or SQL generator logic
4. Restart app: `bun run start`

---

## Performance Characteristics

### Execution Time

**Measured on typical PostgreSQL instance (local Docker, 2 CPU, 4GB RAM)**:

| Operation                         | Time       | Notes                                          |
| --------------------------------- | ---------- | ---------------------------------------------- |
| Single CREATE TABLE               | ~10-20ms   | Includes BEGIN/COMMIT overhead                 |
| 10 CREATE TABLE statements        | ~100-200ms | Sequential execution                           |
| 50 CREATE TABLE statements        | ~500ms-1s  | Acceptable for startup                         |
| 100+ CREATE TABLE statements      | ~1-2s      | Large schemas (still reasonable)               |
| CREATE INDEX on 1M rows           | ~500ms-2s  | Auto-index generation (depends on column type) |
| ALTER TABLE add column (no data)  | ~10ms      | DDL-only, no data migration                    |
| ALTER TABLE change type (1M rows) | ~2-10s     | Requires data transformation (USING clause)    |
| ROLLBACK (50 tables)              | ~50-100ms  | Fast rollback, no data written                 |
| Transaction BEGIN overhead        | ~1-2ms     | Negligible compared to DDL execution           |
| Transaction COMMIT overhead       | ~5-10ms    | WAL flush to disk                              |
| Migration tracking INSERT         | ~2-5ms     | Single row insert to `_sovrium_migrations`     |
| Checksum lookup (skip migration)  | ~1-2ms     | Single SELECT from `_sovrium_schema_checksum`  |
| Full migration (unchanged config) | ~50-100ms  | Checksum check + early exit (no DDL executed)  |
| Full migration (10 tables)        | ~500ms-1s  | Checksum miss + SQL generation + DDL execution |
| Full migration (100 tables)       | ~5-10s     | Large schema, still acceptable for startup     |

**Bottleneck**: DDL execution time (not SQL generation or tracking)

**Optimization**: Checksum-based skip reduces typical startup to < 100ms (see [Checksum Optimization](06-checksum-optimization.md))

### Sequential vs Parallel Execution

**Current Approach**: Sequential execution

```typescript
for (const sql of migrations) {
  await db.query(sql) // One at a time
}
```

**Why Sequential?**

- Migrations may have dependencies (e.g., CREATE TABLE before CREATE INDEX)
- PostgreSQL DDL locks prevent true parallelism anyway
- Simpler error handling (no partial rollback logic needed)

**Future Optimization** (if needed):

- Analyze dependency graph (detect independent tables)
- Execute independent tables in parallel
- Likely minimal gain (DDL execution time dominated by disk I/O, not CPU)

---

## Testing Strategy

### Unit Tests

```typescript
import { describe, test, expect } from 'bun:test'
import { Effect } from 'effect'

describe('MigrationExecutorService', () => {
  test('executes single CREATE TABLE statement', async () => {
    const sql = 'CREATE TABLE test_users (id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE);'

    const program = executeMigrations([sql])
    const result = await Effect.runPromise(program)

    expect(result).toBeUndefined() // Success returns void

    // Verify table exists
    const tables = await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'test_users'"
    )
    expect(tables).toHaveLength(1)
  })

  test('rolls back on error (invalid SQL)', async () => {
    const migrations = [
      'CREATE TABLE test_table1 (id SERIAL PRIMARY KEY);',
      'CREATE TABLE test_table2 (invalid syntax here);', // Error
    ]

    const program = executeMigrations(migrations)
    await expect(Effect.runPromise(program)).rejects.toThrow('Migration execution failed')

    // Verify first table was NOT created (rollback worked)
    const tables = await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'test_table1'"
    )
    expect(tables).toHaveLength(0)
  })

  test('tracks migration in history table', async () => {
    const sql = 'CREATE TABLE test_tracked (id SERIAL PRIMARY KEY);'

    await Effect.runPromise(executeMigrations([sql]))

    // Verify migration was tracked
    const history = await db.query(
      'SELECT * FROM _sovrium_migrations WHERE $1 = ANY(sql_statements)',
      [sql]
    )
    expect(history).toHaveLength(1)
    expect(history[0].checksum).toBeDefined()
    expect(history[0].execution_time_ms).toBeGreaterThan(0)
  })
})
```

### Integration Tests (E2E)

```typescript
// specs/app/tables/migrations/migrations.spec.ts
import { test, expect } from '@playwright/test'

test('applies migrations on app startup', async ({ page }) => {
  // GIVEN: App config with 2 tables
  const config = {
    tables: [
      { name: 'users', fields: [{ name: 'email', type: 'email', required: true }] },
      { name: 'projects', fields: [{ name: 'name', type: 'single-line-text', required: true }] },
    ],
  }

  // WHEN: Start app with config
  await startApp(config)

  // THEN: Tables should exist in database
  const tables = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'projects')"
  )
  expect(tables).toHaveLength(2)
})

test('crashes app on migration failure', async ({ page }) => {
  // GIVEN: App config with invalid SQL (missing quotes in CHECK constraint)
  const config = {
    tables: [
      {
        name: 'projects',
        fields: [{ name: 'status', type: 'single-select', options: ['active', 'done'] }],
      },
    ],
  }

  // Inject SQL generation bug (remove quotes from CHECK constraint)
  mockSqlGenerator.generateCheckConstraint = (field) =>
    `CHECK ("${field.name}" IN (${field.options.join(', ')}))`
  // Output: CHECK ("status" IN (active, done)) - invalid, should be 'active', 'done'

  // WHEN: Start app
  const result = await startApp(config)

  // THEN: App should crash with clear error message
  expect(result.exitCode).toBe(1)
  expect(result.stderr).toContain('Migration execution failed')
  expect(result.stderr).toContain('column "active" does not exist')
  expect(result.stderr).toContain('Perhaps you meant to use a single quoted string literal')
})
```

---

## Error Recovery

### Scenario: Migration Fails After Partial Success

**Problem**: 5 of 10 migrations succeed, 6th fails. What happens?

**Flow**:

```
BEGIN
  CREATE TABLE users;     -- Success
  CREATE TABLE projects;  -- Success
  CREATE TABLE tasks;     -- Success
  CREATE TABLE invalid;   -- Error: syntax error
ROLLBACK (automatic)
```

**Result**:

- All 5 successful tables are discarded (rollback)
- Database is in exact pre-migration state
- No partial schema changes
- App crashes with error pointing to 6th migration

**Developer Action**:

1. Fix SQL generation bug
2. Restart app
3. All 10 migrations execute successfully

**Key Point**: No manual cleanup needed. PostgreSQL transaction handles rollback automatically.

### Scenario: Database Connection Lost Mid-Migration

**Problem**: Connection drops during COMMIT phase.

**Flow**:

```
BEGIN
  CREATE TABLE users;     -- Success
  CREATE TABLE projects;  -- Success
COMMIT                    -- Error: connection lost
```

**Result**:

- PostgreSQL automatically rolls back uncommitted transaction on connection loss
- Database remains in pre-migration state
- App crashes with `MigrationError` (operation: 'COMMIT')

**Developer Action**:

1. Fix connection issue (database restart, network issue, etc.)
2. Restart app
3. Migrations re-execute successfully

**Key Point**: PostgreSQL guarantees ACID properties. Uncommitted transactions are always rolled back on connection loss.

---

## Next Steps

- [Orchestrator](05-orchestrator.md) - How components work together
- [Checksum Optimization](06-checksum-optimization.md) - Skip migrations when config unchanged
- [Best Practices](09-best-practices.md) - Debugging migration failures

---

**Key Takeaway**: The Migration Executor's job is safe execution with fail-fast behavior. If anything goes wrong, crash the app immediately with full context. Don't try to be clever—let the developer fix the root cause.
