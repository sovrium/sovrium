# Runtime SQL Migrations - Effect Integration

← [Previous: Field Type Mapping](07-field-type-mapping.md) | [Back to Navigation](01-start.md) | [Next: Best Practices](09-best-practices.md) →

---

## Purpose

This document explains how runtime migrations are built using Effect.ts, including:

- Service definitions and implementations
- Layer composition for dependency injection
- Error handling with tagged errors
- Effect.gen workflow orchestration
- Integration with existing AppLayer

**Prerequisite**: Basic understanding of Effect.ts concepts (Effect, Layer, Context, Error).

---

## Service Architecture

### Three Core Services

```
ChecksumTrackerService → Checksum calculation and storage
SqlGeneratorService → JSON to SQL DDL conversion
MigrationExecutorService → SQL execution with transactions
```

**Composition**:

```typescript
applyRuntimeMigrations()
    ↓ uses
ChecksumTrackerService
    ↓ uses
SqlGeneratorService
    ↓ uses
MigrationExecutorService
    ↓ uses
DatabaseService
```

---

## Service Definitions

### ChecksumTrackerService

```typescript
import { Effect, Context } from 'effect'
import type { Tables } from '../domain/models/app/tables'

export class ChecksumTrackerService extends Context.Tag('ChecksumTrackerService')<
  ChecksumTrackerService,
  {
    calculateChecksum: (tables: Tables) => Effect.Effect<string, never>
    hasChanged: (checksum: string) => Effect.Effect<boolean, ChecksumError, DatabaseService>
    saveChecksum: (checksum: string) => Effect.Effect<void, ChecksumError, DatabaseService>
  }
>() {}
```

**Why Context.Tag?**

- Type-safe service identifier
- Enables dependency injection via Effect.provide()
- Allows mocking in tests

**Methods**:

- `calculateChecksum`: Pure computation (no dependencies, never fails)
- `hasChanged`: Queries database (depends on DatabaseService, can fail with ChecksumError)
- `saveChecksum`: Writes to database (depends on DatabaseService, can fail with ChecksumError)

---

### SqlGeneratorService

```typescript
import { Effect, Context } from 'effect'
import type { Table } from '../domain/models/app/tables'

export class SqlGeneratorService extends Context.Tag('SqlGeneratorService')<
  SqlGeneratorService,
  {
    generateCreateTableSQL: (table: Table) => Effect.Effect<string, SqlGeneratorError>
    generateAlterTableSQL: (
      table: Table,
      previousTable: Table
    ) => Effect.Effect<string[], SqlGeneratorError>
  }
>() {}
```

**Methods**:

- `generateCreateTableSQL`: Pure transformation (JSON → SQL string)
- `generateAlterTableSQL`: Detects schema changes, generates ALTER TABLE statements

**Error Type**:

```typescript
import { Data } from 'effect'

export class SqlGeneratorError extends Data.TaggedError('SqlGeneratorError')<{
  message: string
  field?: string
  table?: string
  cause?: unknown
}> {}
```

---

### MigrationExecutorService

```typescript
import { Effect, Context } from 'effect'

export class MigrationExecutorService extends Context.Tag('MigrationExecutorService')<
  MigrationExecutorService,
  {
    executeMigrations: (
      migrations: string[]
    ) => Effect.Effect<void, MigrationError, DatabaseService>
  }
>() {}
```

**Methods**:

- `executeMigrations`: Executes SQL in transaction (depends on DatabaseService, can fail with MigrationError)

**Error Type**:

```typescript
export class MigrationError extends Data.TaggedError('MigrationError')<{
  message: string
  operation: 'BEGIN' | 'EXECUTE' | 'COMMIT' | 'ROLLBACK' | 'TRACK'
  sql?: string
  cause?: unknown
}> {}
```

---

### DatabaseService

```typescript
import { Database } from 'bun:sql'
import { Effect, Context } from 'effect'

export class DatabaseService extends Context.Tag('DatabaseService')<DatabaseService, Database>() {}
```

**Implementation**: Wraps bun:sql Database instance.

---

## Layer Implementations

### ChecksumTrackerServiceLive

```typescript
import { Layer, Effect } from 'effect'
import { createHash } from 'crypto'

export const ChecksumTrackerServiceLive = Layer.effect(
  ChecksumTrackerService,
  Effect.gen(function* () {
    const db = yield* DatabaseService

    return ChecksumTrackerService.of({
      calculateChecksum: (tables) =>
        Effect.sync(() => {
          const json = JSON.stringify(tables, null, 0)
          const hash = createHash('sha256').update(json, 'utf8').digest('hex')
          return hash
        }),

      hasChanged: (checksum) =>
        Effect.tryPromise({
          try: async () => {
            const result = await db.query(
              'SELECT checksum FROM _sovrium_schema_checksum WHERE id = $1',
              ['singleton']
            )

            if (result.length === 0) {
              return true // First run, no checksum stored
            }

            return result[0].checksum !== checksum
          },
          catch: (error) =>
            new ChecksumError({
              message: 'Failed to check checksum',
              operation: 'CHECK',
              cause: error,
            }),
        }),

      saveChecksum: (checksum) =>
        Effect.tryPromise({
          try: async () => {
            await db.query(
              `
              INSERT INTO _sovrium_schema_checksum (id, checksum, last_generated)
              VALUES ('singleton', $1, NOW())
              ON CONFLICT (id) DO UPDATE SET checksum = $1, last_generated = NOW()
            `,
              [checksum]
            )
          },
          catch: (error) =>
            new ChecksumError({
              message: 'Failed to save checksum',
              operation: 'SAVE',
              cause: error,
            }),
        }),
    })
  })
)
```

**Key Points**:

- `Layer.effect()` allows using other services (DatabaseService) in construction
- `Effect.sync()` for pure computations (calculateChecksum)
- `Effect.tryPromise()` for async operations that can fail (hasChanged, saveChecksum)
- Tagged errors for type-safe error handling

---

### SqlGeneratorServiceLive

```typescript
export const SqlGeneratorServiceLive = Layer.succeed(
  SqlGeneratorService,
  SqlGeneratorService.of({
    generateCreateTableSQL: (table) =>
      Effect.gen(function* () {
        // Validate table
        if (!table.name || table.fields.length === 0) {
          return yield* Effect.fail(
            new SqlGeneratorError({
              message: 'Invalid table definition',
              table: table.name,
            })
          )
        }

        // Generate column definitions
        const columns = table.fields
          .filter((field) => !isVirtualField(field.type))
          .map((field) => generateColumnDefinition(field))
          .join(',\n  ')

        // Build CREATE TABLE statement
        const sql = `
CREATE TABLE IF NOT EXISTS "${table.name}" (
  id SERIAL PRIMARY KEY,
  ${columns},
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
        `.trim()

        // Generate auto-indexes
        const indexes = generateAutoIndexes(table)

        return [sql, ...indexes].join('\n\n')
      }),

    generateAlterTableSQL: (table, previousTable) =>
      Effect.gen(function* () {
        const alterStatements: string[] = []

        // Detect added fields
        const addedFields = table.fields.filter(
          (field) => !previousTable.fields.find((f) => f.id === field.id)
        )

        for (const field of addedFields) {
          alterStatements.push(
            `ALTER TABLE "${table.name}" ADD COLUMN ${generateColumnDefinition(field)};`
          )
        }

        // Detect removed fields
        const removedFields = previousTable.fields.filter(
          (field) => !table.fields.find((f) => f.id === field.id)
        )

        for (const field of removedFields) {
          alterStatements.push(`ALTER TABLE "${table.name}" DROP COLUMN "${field.name}";`)
        }

        // Detect renamed fields (same ID, different name)
        for (const field of table.fields) {
          const prevField = previousTable.fields.find((f) => f.id === field.id)
          if (prevField && prevField.name !== field.name) {
            alterStatements.push(
              `ALTER TABLE "${table.name}" RENAME COLUMN "${prevField.name}" TO "${field.name}";`
            )
          }
        }

        return alterStatements
      }),
  })
)
```

**Key Points**:

- `Layer.succeed()` for services with no dependencies
- `Effect.fail()` for explicit error cases
- `Effect.gen()` for workflow composition

---

### MigrationExecutorServiceLive

```typescript
export const MigrationExecutorServiceLive = Layer.effect(
  MigrationExecutorService,
  Effect.gen(function* () {
    const db = yield* DatabaseService

    return MigrationExecutorService.of({
      executeMigrations: (migrations) =>
        Effect.gen(function* () {
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
            // Rollback on error
            yield* Effect.tryPromise({
              try: () => db.query('ROLLBACK'),
              catch: (rollbackError) =>
                new MigrationError({
                  message: 'Failed to rollback transaction',
                  operation: 'ROLLBACK',
                  cause: rollbackError,
                }),
            })

            throw error
          }
        }),
    })
  })
)
```

**Key Points**:

- Transaction management with BEGIN/COMMIT/ROLLBACK
- Error propagation with Effect.tryPromise
- Rollback on any failure

---

### DatabaseServiceLive

```typescript
export const DatabaseServiceLive = Layer.sync(DatabaseService, () => {
  const db = new Database(process.env.DATABASE_URL!)
  return db
})
```

**Key Points**:

- `Layer.sync()` for synchronous construction
- Reads DATABASE_URL from environment

---

## Layer Composition

### RuntimeMigrationsLayer

```typescript
export const RuntimeMigrationsLayer = Layer.mergeAll(
  SqlGeneratorServiceLive,
  ChecksumTrackerServiceLive,
  MigrationExecutorServiceLive
).pipe(Layer.provide(DatabaseServiceLive))
```

**Dependency Graph**:

```
RuntimeMigrationsLayer
    ├── SqlGeneratorServiceLive (no dependencies)
    ├── ChecksumTrackerServiceLive → DatabaseServiceLive
    └── MigrationExecutorServiceLive → DatabaseServiceLive
```

**Effect provides DatabaseServiceLive automatically to services that need it.**

---

## Orchestrator Implementation

### applyRuntimeMigrations

```typescript
export const applyRuntimeMigrations = (
  tables: Tables
): Effect.Effect<
  void,
  MigrationError | SqlGeneratorError | ChecksumError,
  SqlGeneratorService | MigrationExecutorService | ChecksumTrackerService
> =>
  Effect.gen(function* () {
    yield* Console.log('Checking runtime migrations...')

    // Step 1: Calculate checksum
    const checksumService = yield* ChecksumTrackerService
    const checksum = yield* checksumService.calculateChecksum(tables)

    // Step 2: Check if changed
    const hasChanged = yield* checksumService.hasChanged(checksum)

    if (!hasChanged) {
      yield* Console.log('✅ Schema unchanged, skipping migrations')
      return
    }

    yield* Console.log('Schema changed, generating migrations...')

    // Step 3: Generate SQL
    const sqlGenerator = yield* SqlGeneratorService
    const migrations: string[] = []
    for (const table of tables) {
      const sql = yield* sqlGenerator.generateCreateTableSQL(table)
      migrations.push(sql)
    }

    yield* Console.log(`Generated ${migrations.length} migration statements`)

    // Step 4: Execute migrations
    const executor = yield* MigrationExecutorService
    yield* executor.executeMigrations(migrations)

    // Step 5: Save checksum
    yield* checksumService.saveChecksum(checksum)

    yield* Console.log('✅ Migrations applied successfully')
  })
```

**Error Type**: Union of all possible errors (`MigrationError | SqlGeneratorError | ChecksumError`)

**Dependencies**: All three services (`SqlGeneratorService | MigrationExecutorService | ChecksumTrackerService`)

---

## Integration with App Startup

### src/index.ts

```typescript
import { Effect, Console } from 'effect'
import { applyRuntimeMigrations } from './infrastructure/database/orchestrator'
import { RuntimeMigrationsLayer } from './infrastructure/database/layers'
import { AppLayer } from './application/layers'

export const start = async (app: unknown, options: StartOptions = {}): Promise<SimpleServer> => {
  const program = Effect.gen(function* () {
    yield* Console.log('Starting Sovrium server...')

    // Validate app config
    const validatedApp = yield* validateApp(app)

    // Apply runtime migrations
    yield* applyRuntimeMigrations(validatedApp.tables)

    // Start server
    const server = yield* startServer(validatedApp, options)
    yield* withGracefulShutdown(server)

    return server
  }).pipe(
    Effect.provide(RuntimeMigrationsLayer), // Provide migration services
    Effect.provide(AppLayer), // Provide app services
    Effect.catchAll(handleStartupError) // Centralized error handling
  )

  const server = await Effect.runPromise(program)
  return toSimpleServer(server)
}
```

**Layer Stack**:

```
program
    ↓ provide
RuntimeMigrationsLayer
    ↓ provide
AppLayer
    ↓ runPromise
Result
```

---

## Error Handling

### Tagged Error Pattern

```typescript
// Define error types
export class SqlGeneratorError extends Data.TaggedError('SqlGeneratorError')<{
  message: string
  field?: string
}> {}

export class MigrationError extends Data.TaggedError('MigrationError')<{
  message: string
  operation: string
  sql?: string
}> {}

// Catch specific error types
const program = applyRuntimeMigrations(tables).pipe(
  Effect.catchTag('SqlGeneratorError', (error) =>
    Effect.gen(function* () {
      yield* Console.error(`❌ SQL generation failed: ${error.message}`)
      if (error.field) {
        yield* Console.error(`Field: ${error.field}`)
      }
      return Effect.die(error)
    })
  ),
  Effect.catchTag('MigrationError', (error) =>
    Effect.gen(function* () {
      yield* Console.error(`❌ Migration failed: ${error.message}`)
      yield* Console.error(`Operation: ${error.operation}`)
      if (error.sql) {
        yield* Console.error(`SQL: ${error.sql}`)
      }
      return Effect.die(error)
    })
  )
)
```

**Benefits**:

- Type-safe error handling (TypeScript knows error shape)
- Granular error recovery (catch specific errors)
- Composable error handling (pipe error handlers)

---

## Testing with Effect

### Unit Test: Service Mocking

```typescript
import { describe, test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'

describe('applyRuntimeMigrations', () => {
  test('skips migrations when checksum matches', async () => {
    // Mock ChecksumTrackerService
    const MockChecksumService = Layer.succeed(
      ChecksumTrackerService,
      ChecksumTrackerService.of({
        calculateChecksum: () => Effect.succeed('abc123'),
        hasChanged: () => Effect.succeed(false), // Checksum match
        saveChecksum: () => Effect.succeed(undefined),
      })
    )

    // Mock SqlGeneratorService (should not be called)
    let sqlGenerated = false
    const MockSqlGenerator = Layer.succeed(
      SqlGeneratorService,
      SqlGeneratorService.of({
        generateCreateTableSQL: () => {
          sqlGenerated = true
          return Effect.succeed('CREATE TABLE ...')
        },
      })
    )

    // Run program with mocks
    const program = applyRuntimeMigrations([]).pipe(
      Effect.provide(MockChecksumService),
      Effect.provide(MockSqlGenerator)
    )

    await Effect.runPromise(program)

    // Verify SQL generation was skipped
    expect(sqlGenerated).toBe(false)
  })
})
```

**Key Points**:

- `Layer.succeed()` for mock implementations
- `Effect.provide()` to inject mocks
- Test services independently

---

## Best Practices

### 1. Keep Services Pure

```typescript
// ✅ Good: Pure function (no side effects)
calculateChecksum: (tables) => Effect.sync(() => hash(JSON.stringify(tables)))

// ❌ Bad: Side effect in implementation
calculateChecksum: (tables) => {
  console.log('Calculating checksum...') // Side effect
  return Effect.sync(() => hash(JSON.stringify(tables)))
}
```

**Rule**: Use `Effect.sync` for pure computations, `Effect.tryPromise` for I/O.

---

### 2. Use Tagged Errors

```typescript
// ✅ Good: Tagged error with context
yield * Effect.fail(new SqlGeneratorError({ message: 'Invalid field type', field: 'email' }))

// ❌ Bad: Throwing generic error
throw new Error('Invalid field type') // Loses type safety
```

**Rule**: Always use `Data.TaggedError` for domain errors.

---

### 3. Compose Layers Explicitly

```typescript
// ✅ Good: Explicit dependency
export const ChecksumServiceLive = Layer.effect(
  ChecksumTrackerService,
  Effect.gen(function* () {
    const db = yield* DatabaseService // Explicit dependency
    // ...
  })
)

// ❌ Bad: Implicit global dependency
export const ChecksumServiceLive = Layer.sync(ChecksumTrackerService, () => {
  const db = globalDatabase // Implicit, untestable
  // ...
})
```

**Rule**: Declare dependencies via `Effect.gen` and service tags.

---

## Next Steps

- [Best Practices](09-best-practices.md) - Production deployment guide
- [Orchestrator](05-orchestrator.md) - How services work together
- [Effect Documentation](https://effect.website/) - Official Effect.ts docs

---

**Key Takeaway**: Effect.ts enables type-safe dependency injection, error handling, and workflow composition. All runtime migration logic is pure, testable, and composable thanks to Effect patterns.
