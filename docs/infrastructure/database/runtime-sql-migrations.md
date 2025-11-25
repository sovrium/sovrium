# Runtime SQL Migrations - Quick Reference

> **Documentation Status**: Part of Phase 0 (Foundation)
> **Related ADR**: [003-runtime-sql-migrations.md](../../architecture/decisions/003-runtime-sql-migrations.md)

## Overview

**What**: Automatic PostgreSQL schema generation from JSON configuration at app startup
**Why**: Configuration-driven platform where developers define tables in JSON, not TypeScript
**How**: Generate raw SQL DDL from JSON config → Execute with bun:sql → PostgreSQL tables created

**Key Principle**: JSON config is the single source of truth for user-defined database schemas.

## Quick Start

1. **Developer defines table in JSON config** (`app.tables`):

   ```json
   {
     "tables": [
       {
         "id": 1,
         "name": "projects",
         "fields": [
           { "id": 1, "name": "name", "type": "single-line-text", "required": true },
           { "id": 2, "name": "status", "type": "single-select", "options": ["active", "done"] }
         ]
       }
     ]
   }
   ```

2. **App startup reads config** - Validates JSON against Effect Schema (`TablesSchema`)

3. **SQL DDL generated (in-memory)** - Creates `CREATE TABLE` statement with correct PostgreSQL types

4. **Migrations executed directly** - `bun:sql` runs DDL in transaction, rolls back on error

5. **Server starts** - PostgreSQL table `projects` is ready for queries

6. **Developer can query** - Use raw SQL: `db.query('SELECT * FROM projects WHERE status = $1', ['active'])`

## Key Concepts

- **SQL Generator** - Converts JSON field definitions to PostgreSQL column types (in-memory, no files)
- **Migration Executor** - Executes DDL statements via bun:sql native driver (transactional, fail-fast)
- **Checksum Optimization** - Hashes JSON config; skips migration if unchanged (< 100ms startup)
- **Fail-Fast Behavior** - Any migration error crashes app immediately with full SQL context
- **Virtual Fields** - Fields like `formula`, `rollup`, `lookup` skip column creation (computed at query time)
- **Field Type Mapping** - 30+ Sovrium types → PostgreSQL types (e.g., `email` → `TEXT UNIQUE`)
- **Transaction Rollback** - All DDL executed in single transaction; errors trigger ROLLBACK
- **Migration Tracking** - Applied migrations recorded in `_sovrium_migrations` table
- **ID Tracking** - Table/field IDs in metadata enable rename detection (prevents data loss)

## File Locations

**Generated SQL** (in-memory only, not written to disk):

- SQL DDL strings created during startup, executed immediately, discarded after

**Migration Tracking** (PostgreSQL tables):

- `_sovrium_migrations` - Applied migration history (checksum, SQL statements, timestamp)
- `_sovrium_schema_checksum` - Current config checksum for optimization

**Source Code** (implementation):

- `src/infrastructure/database/sql-generator/` - JSON → SQL DDL conversion
- `src/infrastructure/database/migration-executor/` - bun:sql execution logic
- `src/infrastructure/database/orchestrator/` - Coordinates generation + execution

## Common Operations

**Add a new field**:

1. Edit JSON config: Add field object to `tables[].fields[]`
2. Restart app: `bun run start`
3. Result: `ALTER TABLE` SQL generated and executed (new column added)

**Rename a table** (safe, no data loss):

1. Change `tables[].name` in JSON config (keep same `tables[].id`)
2. Restart app
3. Result: `ALTER TABLE old_name RENAME TO new_name` (data preserved)

**Change field type**:

1. Modify `fields[].type` in JSON config
2. Restart app
3. Result: `ALTER TABLE ... ALTER COLUMN ... TYPE ...` with `USING` clause
4. Warning: May fail if data incompatible (e.g., TEXT → INTEGER with non-numeric data)

**Check migration status**:

```sql
SELECT * FROM _sovrium_migrations ORDER BY applied_at DESC LIMIT 10;
```

**Debug migration failure**:

1. Check app logs for SQL error message (includes full SQL statement)
2. Query `_sovrium_migrations` to see last successful migration
3. Compare JSON config vs actual database schema: `\d table_name` in psql
4. Fix config or data issue, restart app

## Performance Characteristics

- **Unchanged config**: < 100ms startup overhead (checksum match, skip generation)
- **Changed config**: 2-5 seconds for 10-20 tables (SQL generation + execution)
- **Large schemas**: ~10-30 seconds for 100+ tables (still acceptable for startup)

## Links

**Detailed Documentation**:

- [Deep Dive Series](./runtime-sql-migrations/01-start.md) - 9-part technical guide
- [ADR 003](../../architecture/decisions/003-runtime-sql-migrations.md) - Architectural decision rationale
- [Architecture Pattern](../../architecture/patterns/config-driven-schema-generation.md) - Design pattern overview

**Related Specifications**:

- [Field Types](../../../specs/app/tables/field-types/) - All 30+ field type mappings
- [Migration Tests](../../../specs/app/tables/migrations/) - E2E migration scenarios

**External References**:

- [Bun SQL Driver](https://bun.sh/docs/api/sql) - Native PostgreSQL driver documentation
- [PostgreSQL DDL Reference](https://www.postgresql.org/docs/current/ddl.html) - CREATE/ALTER TABLE syntax

---

**Need Help?**

- See [Best Practices](./runtime-sql-migrations/09-best-practices.md) for troubleshooting guide
- Check [E2E Tests](../../../specs/app/tables/migrations/migrations.spec.ts) for usage examples
