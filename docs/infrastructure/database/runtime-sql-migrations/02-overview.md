# Runtime SQL Migrations - Overview

← [Back to Navigation](01-start.md) | [Next: SQL Generator](03-sql-generator.md) →

---

## Problem Statement

Sovrium is a configuration-driven platform where developers define database schemas in JSON configuration files rather than TypeScript code. The platform needs to automatically create and update PostgreSQL tables at runtime based on these configurations.

**Requirements**:

- JSON config is the single source of truth (not TypeScript schemas)
- Real PostgreSQL tables (not EAV/JSONB pattern)
- Automatic migrations on app startup (no manual `drizzle-kit migrate` commands)
- Support 30+ field types (text, email, dates, relationships, virtual fields)
- Fail-fast behavior (crash app if migrations fail)
- Reasonable startup time (< 5s for typical schemas)

**Challenge**: How to generate PostgreSQL schemas from JSON at runtime efficiently and safely?

---

## Solution Architecture

### High-Level Pipeline

```
JSON Config (app.tables)
    ↓
Effect Schema Validation
    ↓
Checksum Check (skip if unchanged)
    ↓
SQL Generator (JSON → CREATE TABLE SQL)
    ↓
Migration Executor (bun:sql + transaction)
    ↓
PostgreSQL Tables Ready
    ↓
Server Starts
```

**3 Core Components**:

1. **SQL Generator** - Converts JSON table/field definitions to PostgreSQL DDL statements
2. **Migration Executor** - Executes SQL via bun:sql with transaction rollback
3. **Orchestrator** - Coordinates checksum check → generation → execution

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Developer Workflow                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Edit JSON config (app.tables)                          │
│     └─> Add/remove tables, fields, constraints             │
│                                                             │
│  2. Restart app: bun run start                             │
│     └─> Triggers startup sequence                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  App Startup Sequence (src/index.ts)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Effect.gen:                                                │
│    1. Console.log('Starting Sovrium server...')            │
│    2. validateApp(app) → Effect Schema validation          │
│    3. applyRuntimeMigrations(app.tables) ← NEW             │
│    4. startServer(app, options)                            │
│    5. withGracefulShutdown(server)                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  applyRuntimeMigrations (Orchestrator)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 0: Checksum Check                                    │
│    • Hash JSON config → checksum                           │
│    • Compare with stored checksum in DB                    │
│    • If match: Skip migration (< 100ms) → Exit             │
│    • If different: Continue to Step 1                      │
│                                                             │
│  Step 1: Generate SQL DDL (in-memory)                      │
│    • SqlGeneratorService.generateCreateTableSQL()          │
│    • For each table: Map fields → PostgreSQL columns       │
│    • Output: string[] (CREATE TABLE statements)            │
│                                                             │
│  Step 2: Execute Migrations                                │
│    • MigrationExecutorService.executeMigrations()          │
│    • Open transaction: BEGIN                               │
│    • Execute each SQL statement                            │
│    • On success: COMMIT                                    │
│    • On error: ROLLBACK + crash app                        │
│                                                             │
│  Step 3: Update Checksum                                   │
│    • ChecksumTrackerService.saveChecksum()                 │
│    • Store new checksum in _sovrium_schema_checksum        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL Database                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tables Created:                                            │
│    • users (email TEXT UNIQUE, name TEXT, ...)             │
│    • projects (name TEXT, status TEXT CHECK ..., ...)      │
│    • _sovrium_migrations (history tracking)                │
│    • _sovrium_schema_checksum (optimization)               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Server Ready                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Developer can now:                                         │
│    • Query tables: db.query('SELECT * FROM users')         │
│    • Insert data: db.query('INSERT INTO ...')              │
│    • Use full PostgreSQL features (indexes, FK, etc.)      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Overview

### 1. SQL Generator (`src/infrastructure/database/sql-generator/`)

**Purpose**: Convert JSON table definitions to PostgreSQL CREATE TABLE SQL

**Key Functions**:

```typescript
generateCreateTableSQL(table: Table): Effect.Effect<string, SqlGeneratorError>
generateColumnDefinition(field: Field): string
mapFieldTypeToPostgresType(fieldType: string): string
```

**Example**:

```typescript
// Input
const table = {
  id: 1,
  name: 'users',
  fields: [
    { id: 1, name: 'email', type: 'email', required: true, unique: true },
    { id: 2, name: 'name', type: 'single-line-text', required: true },
  ],
}
// Output
`
CREATE TABLE IF NOT EXISTS "users" (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
`
```

**See**: [SQL Generator Deep Dive](03-sql-generator.md)

### 2. Migration Executor (`src/infrastructure/database/migration-executor/`)

**Purpose**: Execute SQL DDL statements safely via bun:sql

**Key Functions**:

```typescript
executeMigrations(migrations: string[]): Effect.Effect<void, MigrationError>
```

**Features**:

- Transactional execution (BEGIN → SQL → COMMIT or ROLLBACK)
- Fail-fast on any error
- Migration history tracking
- Detailed error context (SQL statement, operation, cause)

**Example**:

```typescript
import { Database } from 'bun:sql'

const db = new Database(process.env.DATABASE_URL!)

await db.query('BEGIN')
try {
  for (const sql of migrations) {
    await db.query(sql) // Execute CREATE TABLE / ALTER TABLE
  }
  await db.query('COMMIT')
} catch (error) {
  await db.query('ROLLBACK')
  throw new MigrationError({ message: 'Migration failed', cause: error })
}
```

**See**: [Migration Executor Deep Dive](04-migration-executor.md)

### 3. Orchestrator (`src/infrastructure/database/orchestrator/`)

**Purpose**: Coordinate checksum check → SQL generation → migration execution

**Main Function**:

```typescript
export const applyRuntimeMigrations = (
  tables: Tables
): Effect.Effect<
  void,
  MigrationError,
  SqlGeneratorService | MigrationExecutorService | ChecksumTrackerService
>
```

**Workflow**:

1. Check if config changed (checksum comparison)
2. If unchanged: Exit early (< 100ms)
3. If changed: Generate SQL, execute migrations, update checksum

**See**: [Orchestrator Deep Dive](05-orchestrator.md)

---

## Integration with Sovrium Startup

### Current Startup (Before Migrations)

```typescript
// src/index.ts
export const start = async (app: unknown, options: StartOptions = {}): Promise<SimpleServer> => {
  const program = Effect.gen(function* () {
    yield* Console.log('Starting Sovrium server...')

    const server = yield* startServer(app, options)
    yield* withGracefulShutdown(server)

    return server
  }).pipe(Effect.provide(AppLayer))

  const server = await Effect.runPromise(program)
  return toSimpleServer(server)
}
```

### New Startup (With Migrations)

```typescript
// src/index.ts
export const start = async (app: unknown, options: StartOptions = {}): Promise<SimpleServer> => {
  const program = Effect.gen(function* () {
    yield* Console.log('Starting Sovrium server...')

    // NEW: Apply runtime migrations before server starts
    const validatedApp = yield* validateApp(app)
    yield* applyRuntimeMigrations(validatedApp.tables)

    const server = yield* startServer(validatedApp, options)
    yield* withGracefulShutdown(server)

    return server
  }).pipe(Effect.provide(AppLayer))

  const server = await Effect.runPromise(program)
  return toSimpleServer(server)
}
```

**Integration Point**: Between validation and server start (ensures tables exist before routes initialize)

---

## Performance Characteristics

### Startup Time

**Scenario 1: Config Unchanged** (most common in production):

- Checksum comparison: ~10ms
- Early exit if match
- **Total**: < 100ms overhead

**Scenario 2: Config Changed** (after developer edits):

- Checksum comparison: ~10ms
- SQL generation: ~5-10ms per table
- Migration execution: ~50-100ms per table
- Checksum update: ~10ms
- **Total**: 2-5 seconds for 10-20 tables

**Scenario 3: Large Schema** (100+ tables):

- SQL generation: ~500ms-1s
- Migration execution: ~5-10s
- **Total**: ~10-30 seconds (acceptable for startup)

### Optimization Strategy

**Checksum-based skip**:

- Most production restarts don't change schemas
- Checksum match = skip entire migration pipeline
- Reduces typical startup overhead to < 100ms

**Future optimizations** (if needed):

- Parallel SQL generation for independent tables
- Incremental migration (only changed tables)
- Cached SQL DDL in memory

---

## Error Handling Philosophy

### Fail-Fast Approach

**Principle**: If migrations fail, crash the app immediately with a clear error message.

**Rationale**:

- Partial migrations are dangerous (inconsistent state)
- Better to crash than serve incorrect data
- Forces developers to fix schema issues immediately
- Clear error messages enable quick debugging

**Implementation**:

```typescript
try {
  await applyRuntimeMigrations(app.tables)
} catch (error) {
  console.error('❌ Migration failed:', error.message)
  console.error('SQL:', error.sql)
  console.error('Operation:', error.operation)
  process.exit(1) // Crash app
}
```

### Transaction Rollback

All DDL executed in a single PostgreSQL transaction:

- If any statement fails → ROLLBACK all changes
- Database remains in pre-migration state
- No partial table updates

---

## Next Steps

Continue reading:

- [SQL Generator](03-sql-generator.md) - How JSON becomes PostgreSQL DDL
- [Migration Executor](04-migration-executor.md) - How SQL is executed safely
- [Orchestrator](05-orchestrator.md) - How components work together

Or jump to:

- [Field Type Mapping](07-field-type-mapping.md) - All 30+ field types explained
- [Best Practices](09-best-practices.md) - Production deployment guide
