# Architecture Pattern: Config-Driven Schema Generation

**Status**: Implemented
**Date**: 2025-01-25
**Related ADR**: [003-runtime-sql-migrations.md](../decisions/003-runtime-sql-migrations.md)

---

## Pattern Summary

**Problem**: How to manage database schemas in a configuration-driven platform where developers define tables in JSON config files instead of TypeScript code?

**Solution**: Generate PostgreSQL DDL statements directly from JSON configuration at runtime and execute them automatically on app startup.

**Key Principle**: **JSON config is the single source of truth for user-defined database schemas.**

---

## Context

### Traditional Approach (Static Schemas)

Most applications define database schemas in code:

```typescript
// Drizzle ORM - Static schema
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
})
```

**Workflow**:

1. Developer writes schema in TypeScript
2. Run migration tool: `drizzle-kit generate`
3. Generates SQL migration files
4. Run migrations: `drizzle-kit migrate`
5. Database updated

**Limitation**: Schema is static at build time. Can't be modified without code changes and redeployment.

---

### Config-Driven Approach (Dynamic Schemas)

Sovrium defines schemas in JSON configuration:

```json
{
  "tables": [
    {
      "id": 1,
      "name": "users",
      "fields": [
        { "id": 1, "name": "email", "type": "email", "required": true, "unique": true },
        { "id": 2, "name": "name", "type": "single-line-text", "required": true }
      ]
    }
  ]
}
```

**Workflow**:

1. Developer edits JSON config (no TypeScript code)
2. Restart app: `bun run start`
3. App generates SQL DDL from config
4. App executes SQL via bun:sql
5. Database updated

**Benefit**: Schema can be modified via configuration, no code changes needed.

---

## Pattern Components

### 1. Configuration Schema (Effect Schema)

```typescript
import { Schema } from '@effect/schema'

export const FieldSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  type: Schema.Literal(
    'single-line-text',
    'email',
    'integer',
    'date',
    'checkbox',
    'single-select',
    'linked-record'
    // ... 30+ types
  ),
  required: Schema.optional(Schema.Boolean),
  unique: Schema.optional(Schema.Boolean),
  default: Schema.optional(Schema.Unknown),
  options: Schema.optional(Schema.Array(Schema.String)), // For single-select
  linkedTable: Schema.optional(Schema.String), // For linked-record
})

export const TableSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  fields: Schema.Array(FieldSchema),
})

export const TablesSchema = Schema.Array(TableSchema)
```

**Purpose**: Validate JSON config at startup (type safety + runtime validation).

---

### 2. SQL Generator (Pure Transformation)

```typescript
export const generateCreateTableSQL = (table: Table): Effect.Effect<string, SqlGeneratorError> =>
  Effect.gen(function* () {
    // Map field types to PostgreSQL column types
    const columns = table.fields
      .filter((field) => !isVirtualField(field.type))
      .map((field) => {
        const pgType = mapFieldTypeToPostgresType(field.type)
        const nullable = field.required ? 'NOT NULL' : 'NULL'
        const unique = field.unique ? 'UNIQUE' : ''
        return `"${field.name}" ${pgType} ${nullable} ${unique}`.trim()
      })
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
  })
```

**Key Mappings**:

| Config Type         | PostgreSQL Type            | Constraints            |
| ------------------- | -------------------------- | ---------------------- |
| `email`             | `TEXT`                     | `UNIQUE`               |
| `integer`           | `INTEGER`                  | -                      |
| `date`              | `TIMESTAMP WITH TIME ZONE` | -                      |
| `checkbox`          | `BOOLEAN`                  | `DEFAULT false`        |
| `single-select`     | `TEXT`                     | `CHECK (IN options)`   |
| `linked-record`     | `INTEGER`                  | `REFERENCES table(id)` |
| `formula` (virtual) | N/A                        | No column (computed)   |

**See**: [Field Type Mapping Reference](../../infrastructure/database/runtime-sql-migrations/07-field-type-mapping.md)

---

### 3. Migration Executor (Transactional Execution)

```typescript
export const executeMigrations = (
  migrations: string[]
): Effect.Effect<void, MigrationError, DatabaseService> =>
  Effect.gen(function* () {
    const db = yield* DatabaseService

    yield* Effect.tryPromise({
      try: () => db.query('BEGIN'),
      catch: (error) => new MigrationError({ message: 'Failed to begin transaction' }),
    })

    try {
      for (const sql of migrations) {
        yield* Effect.tryPromise({
          try: () => db.query(sql),
          catch: (error) => new MigrationError({ message: 'Migration failed', sql, cause: error }),
        })
      }

      yield* Effect.tryPromise({
        try: () => db.query('COMMIT'),
        catch: (error) => new MigrationError({ message: 'Failed to commit' }),
      })
    } catch (error) {
      yield* Effect.tryPromise({
        try: () => db.query('ROLLBACK'),
        catch: (rollbackError) => new MigrationError({ message: 'Rollback failed' }),
      })
      throw error
    }
  })
```

**Key Features**:

- All DDL executed in single PostgreSQL transaction
- Any error triggers ROLLBACK (all-or-nothing)
- Fail-fast on errors (crash app immediately)

---

### 4. Checksum Optimization (Performance)

```typescript
export const applyRuntimeMigrations = (tables: Tables) =>
  Effect.gen(function* () {
    // Calculate checksum of JSON config
    const checksum = yield* calculateChecksum(tables)

    // Check if config changed
    const hasChanged = yield* hasChecksumChanged(checksum)

    if (!hasChanged) {
      yield* Console.log('✅ Schema unchanged, skipping migrations')
      return // Early exit (< 100ms)
    }

    // Config changed, run migrations
    const migrations = yield* generateMigrations(tables)
    yield* executeMigrations(migrations)
    yield* saveChecksum(checksum)
  })
```

**Performance**:

- Unchanged config: < 100ms startup overhead (checksum match)
- Changed config: ~500ms-1s startup (SQL generation + execution)

---

## When to Use This Pattern

### ✅ Use Config-Driven Schema Generation When:

1. **End-user defines schemas** - Users create custom tables via UI
2. **Rapid schema iteration** - Schemas change frequently during development
3. **Multi-tenant with custom schemas** - Each tenant has different table structures
4. **Configuration platform** - Application behavior driven by config files
5. **No-code/low-code tools** - Schemas defined visually, not in code

### ❌ Don't Use When:

1. **Static schemas** - Tables rarely change (use Drizzle/TypeORM instead)
2. **Complex migrations** - Need custom data transformations (use migration files)
3. **Compile-time type safety required** - TypeScript types must match DB exactly
4. **Large team collaboration** - Schema changes need review in PRs (prefer migration files in git)

---

## Benefits

### 1. Rapid Development

```
Traditional: Edit schema → Generate migration → Run migration → Test (5 steps)
Config-Driven: Edit JSON → Restart app (2 steps)
```

**Time Saved**: ~80% reduction in schema change workflow.

---

### 2. Self-Service Schema Management

**Use Case**: SaaS platform where tenants create custom fields.

```json
// Tenant A config
{ "tables": [{ "name": "customers", "fields": [...] }] }

// Tenant B config (different schema)
{ "tables": [{ "name": "clients", "fields": [...] }] }
```

**Benefit**: Each tenant gets their own database schema without code changes.

---

### 3. Configuration Versioning

```bash
# Version control for config
git log config.json

# Rollback schema change
git checkout v1.0.0 -- config.json
bun run start  # Migrations regenerate from config
```

**Benefit**: Schema history tracked in git, easy rollback.

---

## Trade-offs

### Lose: Compile-Time Type Safety

**Problem**: TypeScript can't infer types from runtime JSON.

```typescript
// ❌ Can't do this (user-defined table unknown at compile time)
const users = await db.select().from(schema.users)

// ✅ Must use raw SQL or dynamic queries
const users = await db.query('SELECT * FROM users WHERE email = $1', [email])
```

**Mitigation**: Runtime validation with Effect Schema at API boundaries.

---

### Lose: Migration History in Git

**Problem**: SQL migrations aren't stored in files, only in database.

```
Traditional: migrations/001_create_users.sql (committed to git)
Config-Driven: JSON config (committed) → SQL generated at runtime (not committed)
```

**Mitigation**: Query `_sovrium_migrations` table for history.

```sql
SELECT * FROM _sovrium_migrations ORDER BY applied_at DESC;
```

---

### Gain: Simplified Deployment

**Traditional**:

```
1. Deploy app code
2. Run migration tool separately
3. Restart app
4. Hope migrations succeeded
```

**Config-Driven**:

```
1. Deploy app code (config included)
2. App runs migrations automatically on startup
3. Fail-fast if migrations fail (app doesn't start)
```

**Benefit**: Atomic deployment (app + schema together).

---

## Real-World Examples

### Example 1: Airtable-Style Platform

**Scenario**: Users create custom tables with custom fields via UI.

**Implementation**:

1. User clicks "Add Field" in UI
2. Frontend sends API request: `POST /api/tables/1/fields { name: 'priority', type: 'rating' }`
3. Backend updates JSON config in database
4. Restart app (or hot-reload config)
5. Runtime migrations add column: `ALTER TABLE tasks ADD COLUMN priority INTEGER CHECK (priority >= 1 AND priority <= 5);`

**Benefit**: No code deployment needed for schema changes.

---

### Example 2: Multi-Tenant SaaS

**Scenario**: Each tenant has isolated database with custom schema.

**Implementation**:

```typescript
// Tenant 1 (database: tenant_1)
const config1 = { tables: [{ name: 'customers', fields: [...] }] }
await applyRuntimeMigrations(config1) // Creates 'customers' table

// Tenant 2 (database: tenant_2)
const config2 = { tables: [{ name: 'clients', fields: [...] }] }
await applyRuntimeMigrations(config2) // Creates 'clients' table
```

**Benefit**: Each tenant gets custom schema without code changes.

---

### Example 3: Rapid Prototyping

**Scenario**: Developer iterating on schema during MVP development.

**Workflow**:

```bash
# Iteration 1: Basic schema
echo '{"tables":[{"name":"users","fields":[...]}]}' > config.json
bun run start

# Iteration 2: Add field
jq '.tables[0].fields += [{"name":"phone","type":"phone-number"}]' config.json > config.tmp && mv config.tmp config.json
bun run start  # Migrations add column automatically

# Iteration 3: Rename field
jq '.tables[0].fields[2].name = "phone_number"' config.json > config.tmp && mv config.tmp config.json
bun run start  # Migrations detect rename (via field ID), use RENAME COLUMN
```

**Benefit**: Fast schema iteration without migration file boilerplate.

---

## Implementation Checklist

When implementing this pattern:

- [ ] Define configuration schema with Effect Schema
- [ ] Implement SQL generator for all field types (30+)
- [ ] Implement migration executor with transactions
- [ ] Add checksum optimization for performance
- [ ] Create migration tracking table (`_sovrium_migrations`)
- [ ] Add fail-fast error handling (crash app on migration failure)
- [ ] Implement ID-based rename detection (prevent data loss)
- [ ] Add support for virtual fields (formula, rollup, lookup)
- [ ] Write unit tests for SQL generator
- [ ] Write integration tests for migration executor
- [ ] Write E2E tests for full pipeline
- [ ] Document field type mappings
- [ ] Add production monitoring and alerts
- [ ] Create rollback strategy (database backups)

---

## Enforcement

This section validates what aspects of the config-driven schema generation pattern are automatically enforced and what requires manual implementation.

### ESLint Layer Boundaries (Active)

**Enforces**: Infrastructure database code can only import from domain layer

**Configuration**: `eslint/boundaries.config.ts` defines `infrastructure-database` element (lines 119-122)

**What's Enforced**:

- ✅ SQL generator code in `src/infrastructure/database/` cannot import from Application use-cases
- ✅ Prevents infrastructure from depending on higher layers (dependency inversion)
- ✅ Forces use of ports pattern for cross-layer communication

**Verification**: `bun run lint` catches violations

---

### TypeScript Strict Mode (Active)

**Enforces**: Type safety for all config-driven components

**What's Enforced**:

- ✅ JSON config parsing has typed output (no `any` allowed)
- ✅ SQL generator functions have explicit return types
- ✅ Migration executor uses Effect.ts typed errors
- ✅ Null safety throughout pipeline (strictNullChecks)

**Trade-off**: User-defined tables still lack compile-time types (runtime JSON cannot generate TypeScript types)

**Verification**: `bun run typecheck` catches type errors

---

### Effect Schema Validation (Active)

**Enforces**: Runtime config validation before SQL generation

**What's Enforced**:

- ✅ Table/field schemas validated at app startup (fail-fast)
- ✅ 30+ field types must match schema definitions
- ✅ Required properties cannot be missing (name, type, etc.)
- ✅ Invalid config crashes app with clear error message

**Mitigation for Missing Compile-Time Types**: Runtime validation catches configuration errors before SQL execution

**Verification**: Invalid config triggers Effect Schema error with detailed message

---

### Testing Requirements (Manual)

**What's NOT Automatically Enforced**:

The following aspects require manual testing and code review:

1. **SQL DDL Correctness**: Unit tests must verify all field type mappings produce valid PostgreSQL DDL
2. **Transaction Handling**: Integration tests must verify ROLLBACK on migration failure
3. **Checksum Optimization**: E2E tests must verify unchanged config skips generation
4. **Rename Detection**: E2E tests must verify ID-based tracking prevents data loss
5. **Virtual Field Handling**: Unit tests must verify formula/rollup fields skip column creation
6. **Performance Benchmarks**: Load tests must verify startup time under 5 seconds

**Testing Strategy**: 27 E2E spec tests in `specs/migrations/` cover these scenarios

---

### When to Add More Enforcement

Consider adding enforcement tooling if:

1. **Custom SQL Linter**: If SQL injection risks emerge, add sqlint or similar (currently bun:sql handles this)
2. **PostgreSQL Type Checker**: If type mismatches become common, add pg-typegen or custom validator
3. **Config Schema Versioning**: If breaking changes occur, add migration version tracking

---

## Related Patterns

### Similar: EAV (Entity-Attribute-Value)

**Approach**: Store all data in generic table with JSON columns.

```sql
CREATE TABLE records (
  id SERIAL PRIMARY KEY,
  entity_type TEXT,
  attributes JSONB
);
```

**Difference**: EAV stores data generically, config-driven generates real tables.

**Trade-off**: Config-driven has better query performance, EAV has more flexibility.

---

### Similar: Drizzle Schema Generation

**Approach**: Generate TypeScript schema files from config.

```typescript
// Generated schema
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
})
```

**Difference**: Drizzle expects static compile-time schemas, config-driven is runtime.

**See**: [ADR 003 - Why Not Drizzle .ts Generation?](../decisions/003-runtime-sql-migrations.md#why-not-ts-file-generation-alternative-a)

---

## Further Reading

- [ADR 003: Runtime SQL Migrations](../decisions/003-runtime-sql-migrations.md) - Architectural decision rationale
- [Runtime SQL Migrations - Quick Reference](../../infrastructure/database/runtime-sql-migrations.md) - Developer overview
- [Runtime SQL Migrations - Deep Dive](../../infrastructure/database/runtime-sql-migrations/01-start.md) - 9-part technical guide
- [Field Type Mapping Reference](../../infrastructure/database/runtime-sql-migrations/07-field-type-mapping.md) - Complete mapping table

---

**Key Takeaway**: Config-driven schema generation trades compile-time type safety for runtime flexibility. Use it when schemas need to change frequently or are defined by end-users, not developers.
