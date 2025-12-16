# Database Access Strategy - Drizzle ORM vs Manual SQL

## Overview

**Purpose**: Define when to use Drizzle ORM versus manual SQL for database operations in Sovrium

Sovrium uses a hybrid database access strategy that leverages Drizzle ORM for static, known schemas and manual SQL for dynamic, runtime-generated schemas. This document explains the rationale and guidelines for each approach.

## Strategy Summary

| Use Case                                 | Approach                   | Why                                                 |
| ---------------------------------------- | -------------------------- | --------------------------------------------------- |
| **Auth tables** (users, sessions, etc.)  | Drizzle ORM                | Static schema, type safety, Better Auth integration |
| **Migration audit tables** (_sovrium_\*) | Drizzle ORM                | Static schema, type safety                          |
| **Dynamic app tables**                   | Manual SQL                 | Runtime-generated, can't be statically typed        |
| **RLS policies**                         | Manual SQL                 | PostgreSQL DDL, procedural logic                    |
| **PostgreSQL functions**                 | Manual SQL (in migrations) | Drizzle doesn't support function creation           |

## Drizzle ORM Usage (Internal/Static Tables)

### When to Use Drizzle

Use Drizzle ORM for tables with schemas known at compile time:

1. **Better Auth Tables**
   - `users`, `sessions`, `accounts`, `verifications`
   - `organizations`, `members`, `invitations`
   - `api_keys`, `two_factors`

2. **Migration Audit Tables**
   - `_sovrium_migration_history` - Tracks schema migrations
   - `_sovrium_migration_log` - Tracks rollbacks and operations
   - `_sovrium_schema_checksum` - Stores current schema state

3. **Any Future System Tables**
   - Tables defined by the application itself (not user configuration)

### Schema Definitions

Drizzle schemas are defined in:

```
src/infrastructure/database/drizzle/
├── schema.ts                    # Re-exports all schemas
├── schema/
│   └── migration-audit.ts       # _sovrium_* tables
└── migrate.ts                   # Runs Drizzle migrations
```

Better Auth schemas are defined in:

```
src/infrastructure/auth/better-auth/
└── schema.ts                    # users, sessions, accounts, etc.
```

### Migration Management

Drizzle migrations are stored in the `drizzle/` directory:

```bash
drizzle/
├── 0000_harsh_dazzler.sql       # Initial Better Auth tables
├── 0001_zippy_speed_demon.sql   # Organizations, members, invitations
├── 0002_cool_lady_vermin.sql    # API keys, two-factor
├── 0003_add_auth_schema_and_test_roles.sql  # auth schema + helper functions
├── 0004_grant_test_role_permissions.sql
├── 0005_grant_test_user_role_membership.sql
├── 0006_perpetual_ben_urich.sql # _sovrium_migration_* tables
└── meta/
    └── _journal.json            # Migration tracking
```

**Commands**:

```bash
bun run db:generate  # Generate migration from schema changes
bun run db:migrate   # Apply migrations to database
bun run db:push      # Push schema directly (dev only)
bun run db:studio    # Launch Drizzle Studio GUI
```

### Runtime Migration Execution

At server startup, Drizzle migrations are applied via:

```typescript
// src/infrastructure/database/drizzle/migrate.ts
import { migrate } from 'drizzle-orm/bun-sql/migrator'

export const runMigrations = (databaseUrl: string): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const client = new SQL(databaseUrl)
    const db = drizzle({ client, schema })

    yield* Effect.tryPromise({
      try: () => migrate(db, { migrationsFolder: './drizzle' }),
      catch: (error) => new Error(`Migration failed: ${String(error)}`),
    })

    yield* Effect.promise(() => client.close())
  })
```

This runs **BEFORE** `initializeSchema()` because:

1. User fields (created-by, updated-by) need the `users` table
2. Better Auth tables must exist before app-specific tables
3. Migration audit tables must exist for tracking schema changes

### Type Safety Benefits

Drizzle provides compile-time type inference:

```typescript
// Schema definition
export const sovriumMigrationHistory = pgTable('_sovrium_migration_history', {
  id: serial('id').primaryKey(),
  version: integer('version').notNull(),
  checksum: text('checksum').notNull(),
  schema: jsonb('schema'),
  appliedAt: timestamp('applied_at').defaultNow(),
})

// Type exports
export type SovriumMigrationHistory = typeof sovriumMigrationHistory.$inferSelect
export type NewSovriumMigrationHistory = typeof sovriumMigrationHistory.$inferInsert
```

## Manual SQL Usage (Dynamic Tables)

### When to Use Manual SQL

Use manual SQL for operations that cannot be statically defined:

1. **App-Defined Tables**
   - Tables created from user JSON configuration
   - Fields, constraints, and relationships are runtime-determined

2. **RLS Policies**
   - `CREATE POLICY` statements for row-level security
   - Dynamic conditions based on table permissions

3. **PostgreSQL Functions**
   - `auth.is_authenticated()` and `auth.user_has_role()`
   - These are defined in Drizzle migration files but as raw SQL

4. **Schema Introspection**
   - Queries against `information_schema` and `pg_*` tables
   - Table existence checks, column metadata

5. **Complex DDL Operations**
   - `ALTER TABLE` for schema migrations
   - `DO $$ ... $$` blocks for conditional logic
   - Trigger and index creation

### Implementation Location

Manual SQL operations are in:

```
src/infrastructure/database/
├── schema-initializer.ts        # Orchestrates dynamic schema creation
├── table-operations.ts          # CREATE TABLE, ALTER TABLE
├── sql-generators.ts            # Generates DDL from config
├── rls-policy-generators.ts     # Generates RLS policies
├── sql-execution.ts             # executeSQL() utility
├── sql-utils.ts                 # SQL escaping utilities
└── migration-audit-trail.ts     # Query operations (uses raw SQL)
```

### TransactionLike Interface

All manual SQL uses a common interface for transaction safety:

```typescript
export interface TransactionLike {
  readonly unsafe: (sql: string) => Promise<readonly unknown[]>
}
```

This allows code to work with both `bun:sql` transactions and Drizzle transactions.

### Security Considerations

Manual SQL requires careful security handling:

1. **SQL Escaping**: Use `escapeSqlString()` for user-provided strings
2. **Parameterized DDL**: PostgreSQL doesn't support parameters in DDL, so identifiers must come from validated schemas
3. **Transaction Boundaries**: All DDL operations run in transactions for atomicity

```typescript
// SECURITY NOTE: SQL is generated from validated Effect Schema objects, not user input
const escapedSchema = escapeSqlString(JSON.stringify(schemaSnapshot))
const insertSQL = `
  INSERT INTO _sovrium_migration_history (version, checksum, schema)
  VALUES (${nextVersion}, '${checksum}', '${escapedSchema}')
`
yield * executeSQL(tx, insertSQL)
```

## Architecture Flow

```
Server Startup
    │
    ▼
┌─────────────────────────────────┐
│  1. runMigrations()             │  ← Drizzle ORM
│     - Better Auth tables        │    (static schemas)
│     - _sovrium_* tables         │
│     - auth schema + functions   │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  2. initializeSchema()          │  ← Manual SQL
│     - App-defined tables        │    (dynamic schemas)
│     - Junction tables           │
│     - Views, triggers, indexes  │
│     - RLS policies              │
└─────────────────────────────────┘
    │
    ▼
Server Ready
```

## Best Practices

### Adding New Internal Tables

1. **Create Drizzle schema** in `src/infrastructure/database/drizzle/schema/`
2. **Export from schema.ts**: Add `export * from './schema/new-table'`
3. **Generate migration**: Run `bun run db:generate`
4. **Review and commit** the generated migration SQL

### Modifying Auth Tables

Better Auth tables are defined in `src/infrastructure/auth/better-auth/schema.ts`. Modifications should:

1. Update the Drizzle schema
2. Generate a new migration
3. Test with Better Auth integration

### Adding Dynamic Table Features

For new features in app-defined tables:

1. Update `src/domain/models/app/table/` schemas
2. Update `src/infrastructure/database/sql-generators.ts` for DDL generation
3. Add tests for the new feature
4. Update RLS generators if permissions are affected

## Summary

| Aspect          | Drizzle ORM                  | Manual SQL                     |
| --------------- | ---------------------------- | ------------------------------ |
| **When**        | Compile-time known schemas   | Runtime-generated schemas      |
| **Type Safety** | Full TypeScript inference    | Manual type assertions         |
| **Migrations**  | drizzle-kit generate         | Generated SQL strings          |
| **Examples**    | users, sessions, _sovrium_\* | app tables, RLS policies       |
| **Location**    | `drizzle/schema/`            | `database/table-operations.ts` |

This hybrid approach provides the best of both worlds:

- **Type safety and tooling** for internal infrastructure
- **Flexibility and control** for user-defined configurations

---

**Last Updated**: 2025-12-16

**Related Documentation**:

- [ADR 003: Runtime SQL Migrations](../decisions/003-runtime-sql-migrations.md) - Decision rationale for runtime SQL generation
- [Config-Driven Schema Generation](./config-driven-schema-generation.md) - Pattern for generating schemas from JSON config
- [Internal Table Naming Convention](./internal-table-naming-convention.md) - All Drizzle-managed tables use `_sovrium_` prefix
- [Soft Delete by Default](./soft-delete-by-default.md) - Affects schema design for both Drizzle and manual SQL tables
