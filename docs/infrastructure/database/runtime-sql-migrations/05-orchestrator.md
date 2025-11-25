# Runtime SQL Migrations - Orchestrator

← [Previous: Migration Executor](04-migration-executor.md) | [Back to Navigation](01-start.md) | [Next: Checksum Optimization](06-checksum-optimization.md) →

---

## Purpose

The Orchestrator coordinates the entire runtime migration pipeline by composing three core services:

1. **ChecksumTrackerService** - Detect if config changed
2. **SqlGeneratorService** - Generate SQL DDL from JSON
3. **MigrationExecutorService** - Execute SQL safely

**Location**: `src/infrastructure/database/orchestrator/`

---

## Core Function

```typescript
export const applyRuntimeMigrations = (
  tables: Tables
): Effect.Effect<
  void,
  MigrationError | SqlGeneratorError,
  SqlGeneratorService | MigrationExecutorService | ChecksumTrackerService
> =>
  Effect.gen(function* () {
    yield* Console.log('Checking runtime migrations...')

    // Step 1: Calculate checksum of JSON config
    const checksum = yield* ChecksumTrackerService.calculateChecksum(tables)

    // Step 2: Check if config changed
    const hasChanged = yield* ChecksumTrackerService.hasChanged(checksum)

    if (!hasChanged) {
      yield* Console.log('✅ Schema unchanged, skipping migrations')
      return // Early exit (< 100ms)
    }

    yield* Console.log('Schema changed, generating migrations...')

    // Step 3: Generate SQL DDL for all tables
    const migrations: string[] = []
    for (const table of tables) {
      const sql = yield* SqlGeneratorService.generateCreateTableSQL(table)
      migrations.push(sql)
    }

    yield* Console.log(`Generated ${migrations.length} migration statements`)

    // Step 4: Execute migrations in transaction
    yield* MigrationExecutorService.executeMigrations(migrations)

    // Step 5: Save new checksum
    yield* ChecksumTrackerService.saveChecksum(checksum)

    yield* Console.log('✅ Migrations applied successfully')
  })
```

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  applyRuntimeMigrations(tables)                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Calculate Checksum                                 │
│  • Hash JSON config → checksum (e.g., "abc123...")          │
│  • ChecksumTrackerService.calculateChecksum(tables)         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Check if Changed                                   │
│  • Query DB: SELECT checksum FROM _sovrium_schema_checksum  │
│  • Compare stored vs calculated                             │
│  • ChecksumTrackerService.hasChanged(checksum)              │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    ┌─────────┐
                    │ Changed?│
                    └─────────┘
                      ↙     ↘
               No (Match)   Yes (Different)
                  ↓              ↓
    ┌──────────────────┐   ┌─────────────────────────────────┐
    │ Early Exit       │   │ Step 3: Generate SQL DDL        │
    │ < 100ms          │   │ • For each table in tables:     │
    │ Skip migrations  │   │   - generateCreateTableSQL()    │
    └──────────────────┘   │ • Collect all SQL statements    │
                           └─────────────────────────────────┘
                                       ↓
                           ┌─────────────────────────────────┐
                           │ Step 4: Execute Migrations      │
                           │ • BEGIN transaction             │
                           │ • Execute each SQL statement    │
                           │ • COMMIT (or ROLLBACK on error) │
                           └─────────────────────────────────┘
                                       ↓
                           ┌─────────────────────────────────┐
                           │ Step 5: Save New Checksum       │
                           │ • INSERT/UPDATE checksum in DB  │
                           │ • ChecksumTrackerService.save() │
                           └─────────────────────────────────┘
                                       ↓
                           ┌─────────────────────────────────┐
                           │ ✅ Migrations Applied           │
                           └─────────────────────────────────┘
```

---

## Service Dependencies

### Effect Layer Composition

```typescript
import { Effect, Layer } from 'effect'

// Service Layers
const SqlGeneratorServiceLive = Layer.succeed(
  SqlGeneratorService,
  SqlGeneratorService.of({
    generateCreateTableSQL: (table) => Effect.succeed(`CREATE TABLE "${table.name}" (...)`),
  })
)

const MigrationExecutorServiceLive = Layer.effect(
  MigrationExecutorService,
  Effect.gen(function* () {
    const db = yield* DatabaseService
    return MigrationExecutorService.of({
      executeMigrations: (migrations) => executeMigrations(migrations),
    })
  })
)

const ChecksumTrackerServiceLive = Layer.effect(
  ChecksumTrackerService,
  Effect.gen(function* () {
    const db = yield* DatabaseService
    return ChecksumTrackerService.of({
      calculateChecksum: (tables) => Effect.succeed(hash(JSON.stringify(tables))),
      hasChanged: (checksum) => hasChecksumChanged(checksum),
      saveChecksum: (checksum) => saveChecksumToDB(checksum),
    })
  })
)

// Compose all layers
export const RuntimeMigrationsLayer = Layer.mergeAll(
  SqlGeneratorServiceLive,
  MigrationExecutorServiceLive,
  ChecksumTrackerServiceLive
)
```

**Usage in App Startup**:

```typescript
// src/index.ts
export const start = async (app: unknown, options: StartOptions = {}): Promise<SimpleServer> => {
  const program = Effect.gen(function* () {
    yield* Console.log('Starting Sovrium server...')

    const validatedApp = yield* validateApp(app)

    // Apply runtime migrations (orchestrator)
    yield* applyRuntimeMigrations(validatedApp.tables)

    const server = yield* startServer(validatedApp, options)
    yield* withGracefulShutdown(server)

    return server
  }).pipe(
    Effect.provide(AppLayer), // Includes RuntimeMigrationsLayer
    Effect.provide(DatabaseServiceLive)
  )

  const server = await Effect.runPromise(program)
  return toSimpleServer(server)
}
```

---

## Checksum Calculation

### Algorithm

```typescript
import { createHash } from 'crypto'

export const calculateChecksum = (tables: Tables): string => {
  // Serialize JSON config deterministically
  const json = JSON.stringify(tables, null, 0) // No whitespace

  // Hash with SHA-256
  const hash = createHash('sha256').update(json).digest('hex')

  return hash // e.g., "a3f5b8c2d1e4f6a7b8c9d0e1f2a3b4c5..."
}
```

**Why SHA-256?**

- Deterministic (same input → same hash)
- Fast (< 1ms for typical configs)
- Collision-resistant (virtually impossible to have two different configs with same hash)

**Example**:

```typescript
const tables1 = [{ id: 1, name: 'users', fields: [{ name: 'email', type: 'email' }] }]
const tables2 = [{ id: 1, name: 'users', fields: [{ name: 'email', type: 'email' }] }]
const tables3 = [{ id: 1, name: 'users', fields: [{ name: 'name', type: 'single-line-text' }] }]

calculateChecksum(tables1) === calculateChecksum(tables2) // true (identical configs)
calculateChecksum(tables1) === calculateChecksum(tables3) // false (different fields)
```

### Checksum Storage

```sql
CREATE TABLE IF NOT EXISTS _sovrium_schema_checksum (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  checksum TEXT NOT NULL,
  last_generated TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

**Key Design**:

- Single row table (id = 'singleton')
- Stores only the latest checksum
- Timestamp for debugging (when was schema last changed?)

**Queries**:

```typescript
// Check if checksum exists and matches
const hasChanged = async (checksum: string): Promise<boolean> => {
  const result = await db.query('SELECT checksum FROM _sovrium_schema_checksum WHERE id = $1', [
    'singleton',
  ])

  if (result.length === 0) {
    return true // No checksum stored, first run
  }

  return result[0].checksum !== checksum // Changed if different
}

// Save new checksum
const saveChecksum = async (checksum: string): Promise<void> => {
  await db.query(
    `
    INSERT INTO _sovrium_schema_checksum (id, checksum, last_generated)
    VALUES ('singleton', $1, NOW())
    ON CONFLICT (id) DO UPDATE SET checksum = $1, last_generated = NOW()
  `,
    [checksum]
  )
}
```

---

## Error Handling

### Composition of Error Types

```typescript
type RuntimeMigrationError = MigrationError | SqlGeneratorError

export const applyRuntimeMigrations = (
  tables: Tables
): Effect.Effect<void, RuntimeMigrationError /* dependencies */> =>
  Effect.gen(function* () {
    // SqlGeneratorService can fail with SqlGeneratorError
    const sql = yield* SqlGeneratorService.generateCreateTableSQL(table)

    // MigrationExecutorService can fail with MigrationError
    yield* MigrationExecutorService.executeMigrations([sql])
  })
```

**Error Handling at App Startup**:

```typescript
const program = Effect.gen(function* () {
  yield* applyRuntimeMigrations(validatedApp.tables)
}).pipe(
  Effect.catchTag('SqlGeneratorError', (error) =>
    Effect.gen(function* () {
      yield* Console.error('❌ SQL generation failed')
      yield* Console.error(`Field: ${error.field}`)
      yield* Console.error(`Message: ${error.message}`)
      return Effect.die(error) // Crash app
    })
  ),
  Effect.catchTag('MigrationError', (error) =>
    Effect.gen(function* () {
      yield* Console.error('❌ Migration execution failed')
      yield* Console.error(`Operation: ${error.operation}`)
      if (error.sql) {
        yield* Console.error(`SQL: ${error.sql}`)
      }
      yield* Console.error(`Cause: ${String(error.cause)}`)
      return Effect.die(error) // Crash app
    })
  )
)
```

### Error Propagation

```
User edits config (invalid field type)
    ↓
applyRuntimeMigrations() starts
    ↓
SqlGeneratorService.generateCreateTableSQL() throws SqlGeneratorError
    ↓
Effect catches SqlGeneratorError
    ↓
Logs error details
    ↓
Effect.die(error) crashes app
    ↓
Developer sees error, fixes config, restarts
```

**Key Point**: Errors propagate up through Effect composition, allowing centralized error handling at the top level (app startup).

---

## Integration with App Startup

### Startup Sequence

```typescript
// src/index.ts
export const start = async (app: unknown, options: StartOptions = {}): Promise<SimpleServer> => {
  const program = Effect.gen(function* () {
    // 1. Log startup
    yield* Console.log('Starting Sovrium server...')

    // 2. Validate app config (Effect Schema)
    const validatedApp = yield* validateApp(app)

    // 3. Apply runtime migrations (NEW - orchestrator)
    yield* applyRuntimeMigrations(validatedApp.tables)

    // 4. Start HTTP server
    const server = yield* startServer(validatedApp, options)

    // 5. Setup graceful shutdown
    yield* withGracefulShutdown(server)

    return server
  }).pipe(
    Effect.provide(AppLayer), // Includes all service layers
    Effect.catchAll(handleStartupError) // Centralized error handling
  )

  const server = await Effect.runPromise(program)
  return toSimpleServer(server)
}
```

**Timeline**:

```
t=0ms    │ Console.log('Starting Sovrium server...')
t=10ms   │ validateApp() completes (Effect Schema validation)
t=20ms   │ applyRuntimeMigrations() starts
         │   - calculateChecksum() → 5ms
         │   - hasChanged() → 2ms (DB query)
         │   - If unchanged: Early exit at t=27ms ✅
         │   - If changed:
         │     - generateSQL() → 50-100ms (10 tables)
         │     - executeMigrations() → 200-500ms (DDL + commit)
         │     - saveChecksum() → 5ms
         │   - Total if changed: ~500ms-1s
t=27ms   │ applyRuntimeMigrations() completes (unchanged config)
         │ OR
t=520ms  │ applyRuntimeMigrations() completes (changed config, 10 tables)
         │
t=550ms  │ startServer() starts HTTP listener
t=600ms  │ Server ready, listening on port 3000
```

**Key Insight**: Unchanged config adds < 100ms overhead. Changed config adds ~500ms-1s for typical schemas.

---

## Performance Optimization Strategies

### 1. Checksum-Based Skip (Current)

**Strategy**: Hash JSON config, compare with stored hash, skip if match.

**Savings**: ~500ms-1s per startup (avoids SQL generation + execution)

**Trade-off**: 2ms checksum query overhead (negligible)

### 2. Incremental Migrations (Future)

**Strategy**: Detect which tables changed, only generate/execute SQL for those.

**Example**:

```typescript
// Current: Generate SQL for all 100 tables
for (const table of tables) {
  const sql = yield * generateSQL(table) // 100 iterations
}

// Future: Generate SQL only for changed tables
const changedTables = yield * detectChangedTables(tables, previousTables)
for (const table of changedTables) {
  const sql = yield * generateSQL(table) // 5 iterations (95% savings)
}
```

**Complexity**: Need to store previous table definitions, diff algorithm.

**Benefit**: ~90-95% reduction in SQL generation time for small config changes.

### 3. Parallel SQL Generation (Future)

**Strategy**: Generate SQL for independent tables in parallel.

**Example**:

```typescript
// Current: Sequential
for (const table of tables) {
  const sql = yield * generateSQL(table)
}

// Future: Parallel
const sqls =
  yield *
  Effect.all(
    tables.map((table) => generateSQL(table)),
    {
      concurrency: 'unbounded',
    }
  )
```

**Benefit**: ~50% reduction in generation time (if I/O-bound).

**Limitation**: DDL execution must remain sequential (dependency order).

### 4. Cached SQL Templates (Future)

**Strategy**: Cache generated SQL templates, only regenerate on field type changes.

**Example**:

```typescript
// Cache key: table structure hash
const cacheKey = hash({ name: table.name, fields: table.fields.map((f) => f.type) })
const cachedSQL = sqlCache.get(cacheKey)

if (cachedSQL) {
  return cachedSQL // Skip generation
}

const sql = generateSQL(table)
sqlCache.set(cacheKey, sql)
return sql
```

**Benefit**: ~80% reduction in generation time for unchanged table structures.

**Limitation**: Requires cache invalidation logic.

---

## Debugging

### Enable Verbose Logging

```typescript
export const applyRuntimeMigrations = (tables: Tables) =>
  Effect.gen(function* () {
    yield* Console.log('=== Runtime Migrations Debug ===')

    const checksum = yield* ChecksumTrackerService.calculateChecksum(tables)
    yield* Console.log(`Calculated checksum: ${checksum}`)

    const hasChanged = yield* ChecksumTrackerService.hasChanged(checksum)
    yield* Console.log(`Config changed: ${hasChanged}`)

    if (!hasChanged) {
      yield* Console.log('Skipping migrations (checksum match)')
      return
    }

    yield* Console.log('Generating SQL for tables:')
    const migrations: string[] = []
    for (const table of tables) {
      yield* Console.log(`  - ${table.name} (${table.fields.length} fields)`)
      const sql = yield* SqlGeneratorService.generateCreateTableSQL(table)
      yield* Console.log(`Generated SQL:\n${sql}\n`)
      migrations.push(sql)
    }

    yield* Console.log(`Executing ${migrations.length} migrations...`)
    yield* MigrationExecutorService.executeMigrations(migrations)

    yield* Console.log('Saving new checksum...')
    yield* ChecksumTrackerService.saveChecksum(checksum)

    yield* Console.log('=== Migrations Complete ===')
  })
```

**Output Example**:

```
=== Runtime Migrations Debug ===
Calculated checksum: a3f5b8c2d1e4f6a7b8c9d0e1f2a3b4c5...
Config changed: true
Generating SQL for tables:
  - users (3 fields)
Generated SQL:
CREATE TABLE IF NOT EXISTS "users" (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

  - projects (2 fields)
Generated SQL:
CREATE TABLE IF NOT EXISTS "projects" (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT CHECK ("status" IN ('active', 'done')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

Executing 2 migrations...
Saving new checksum...
=== Migrations Complete ===
```

### Inspect Checksum State

```sql
-- Check current checksum
SELECT * FROM _sovrium_schema_checksum;

-- Example output:
-- id         | checksum                                                        | last_generated
-- -----------+-----------------------------------------------------------------+-------------------------
-- singleton  | a3f5b8c2d1e4f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8 | 2025-01-25 14:30:22+00

-- Check migration history
SELECT * FROM _sovrium_migrations ORDER BY applied_at DESC LIMIT 5;

-- Example output:
-- id | checksum                                                        | sql_statements                          | applied_at              | execution_time_ms
-- ---+-----------------------------------------------------------------+-----------------------------------------+-------------------------+------------------
-- 3  | a3f5b8c2...                                                     | {"CREATE TABLE users (...)", ...}       | 2025-01-25 14:30:22+00  | 234
-- 2  | f7e9d3c1...                                                     | {"CREATE TABLE projects (...)", ...}    | 2025-01-25 12:15:10+00  | 187
-- 1  | initial...                                                      | {"CREATE TABLE _sovrium_migrations..."} | 2025-01-25 10:00:00+00  | 45
```

### Force Re-Run Migrations

```typescript
// Option 1: Delete checksum (forces re-run on next startup)
await db.query('DELETE FROM _sovrium_schema_checksum WHERE id = $1', ['singleton'])

// Option 2: Manually update checksum to invalid value
await db.query('UPDATE _sovrium_schema_checksum SET checksum = $1 WHERE id = $2', [
  'force-rerun',
  'singleton',
])

// Restart app → Migrations will run
```

---

## Testing

### Unit Test: Checksum Match (Early Exit)

```typescript
import { describe, test, expect } from 'bun:test'
import { Effect } from 'effect'

describe('applyRuntimeMigrations', () => {
  test('skips migrations when checksum matches', async () => {
    const tables = [{ id: 1, name: 'users', fields: [] }]

    // Mock: Checksum already stored in DB
    const mockChecksum = 'abc123'
    const mockChecksumService = {
      calculateChecksum: () => Effect.succeed(mockChecksum),
      hasChanged: () => Effect.succeed(false), // Match
      saveChecksum: () => Effect.succeed(undefined),
    }

    let sqlGenerated = false
    const mockSqlGenerator = {
      generateCreateTableSQL: () => {
        sqlGenerated = true
        return Effect.succeed('CREATE TABLE ...')
      },
    }

    const program = applyRuntimeMigrations(tables).pipe(
      Effect.provide(Layer.succeed(ChecksumTrackerService, mockChecksumService)),
      Effect.provide(Layer.succeed(SqlGeneratorService, mockSqlGenerator))
    )

    await Effect.runPromise(program)

    // Verify SQL generation was skipped
    expect(sqlGenerated).toBe(false)
  })
})
```

### Unit Test: Checksum Mismatch (Execute Migrations)

```typescript
test('executes migrations when checksum changes', async () => {
  const tables = [{ id: 1, name: 'users', fields: [{ name: 'email', type: 'email' }] }]

  const mockChecksum = 'new-checksum'
  const mockChecksumService = {
    calculateChecksum: () => Effect.succeed(mockChecksum),
    hasChanged: () => Effect.succeed(true), // Changed
    saveChecksum: () => Effect.succeed(undefined),
  }

  const generatedSQL: string[] = []
  const mockSqlGenerator = {
    generateCreateTableSQL: (table) => {
      const sql = `CREATE TABLE "${table.name}" (...)`
      generatedSQL.push(sql)
      return Effect.succeed(sql)
    },
  }

  const executedMigrations: string[] = []
  const mockExecutor = {
    executeMigrations: (migrations) => {
      executedMigrations.push(...migrations)
      return Effect.succeed(undefined)
    },
  }

  const program = applyRuntimeMigrations(tables).pipe(
    Effect.provide(Layer.succeed(ChecksumTrackerService, mockChecksum Service)),
    Effect.provide(Layer.succeed(SqlGeneratorService, mockSqlGenerator)),
    Effect.provide(Layer.succeed(MigrationExecutorService, mockExecutor))
  )

  await Effect.runPromise(program)

  // Verify SQL was generated
  expect(generatedSQL).toHaveLength(1)
  expect(generatedSQL[0]).toContain('CREATE TABLE "users"')

  // Verify migrations were executed
  expect(executedMigrations).toEqual(generatedSQL)
})
```

---

## Next Steps

- [Checksum Optimization](06-checksum-optimization.md) - Deep dive into checksum algorithm
- [Field Type Mapping](07-field-type-mapping.md) - Complete field type reference
- [Effect Integration](08-effect-integration.md) - Service composition patterns

---

**Key Takeaway**: The Orchestrator is the "main" function that glues together checksum checking, SQL generation, and migration execution. It's simple by design—all complexity is delegated to specialized services.
