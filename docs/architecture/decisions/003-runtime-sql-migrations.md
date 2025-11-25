# ADR 003: Runtime SQL Migration Generation for Configuration-Driven Schemas

**Status**: Accepted
**Date**: 2025-01-25
**Decision Makers**: Product Architecture Review
**Related**: [Config-Driven Schema Generation Pattern](../patterns/config-driven-schema-generation.md)

---

## Context

Sovrium is a configuration-driven application platform where developers define database schemas in JSON configuration files. The platform needs to automatically create and update PostgreSQL tables at runtime based on these configurations, without requiring manual migration files or build-time code generation.

### Requirements

1. **Configuration as Source of Truth**: JSON config defines all user tables and fields
2. **Automatic Schema Management**: Tables created/updated automatically on app startup
3. **Real PostgreSQL Tables**: Native performance with indexes, constraints, and relationships (not EAV/JSONB)
4. **30+ Field Types**: Support for text, numbers, dates, relationships, and virtual fields
5. **Developer Workflow**: Edit config → Restart app → Tables ready (no manual migration commands)
6. **Fail-Fast**: Migration failures must crash app with clear error messages

### Problem

How should we generate PostgreSQL schemas from JSON config at runtime? Three main approaches were considered:

1. **Generate .ts Drizzle schema files** to `/tmp` folder, run `drizzle-kit` CLI, apply migrations
2. **Generate raw SQL DDL directly** and execute with `bun:sql`
3. **Use Kysely ORM** for runtime schema building

---

## Decision

**We will generate raw SQL DDL statements directly from JSON config and execute them via `bun:sql`.**

### Implementation Summary

```typescript
// 1. JSON Config (developer edits this)
const tables = [
  {
    id: 1,
    name: 'users',
    fields: [
      { id: 1, name: 'email', type: 'email', required: true, unique: true },
      { id: 2, name: 'name', type: 'single-line-text', required: true },
    ],
  },
]

// 2. Generate SQL DDL (in-memory)
const sql = `
CREATE TABLE IF NOT EXISTS "users" (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
`

// 3. Execute directly with bun:sql
import { Database } from 'bun:sql'
const db = new Database(process.env.DATABASE_URL!)
await db.query(sql)
```

**Key Pipeline**: JSON Config → SQL Generator → bun:sql Executor → PostgreSQL Tables (3 steps)

---

## Rationale

### Why Raw SQL Generation?

1. **Simplicity** - Direct JSON → SQL mapping with no intermediate files or CLI tools
2. **Performance** - No file I/O overhead, all in-memory processing
3. **Transparency** - SQL strings are easy to inspect, log, and debug
4. **Portability** - Standard PostgreSQL DDL works with any driver
5. **Minimal Dependencies** - Uses Bun's native `bun:sql` driver, no external tools
6. **Full Control** - Custom SQL generation tailored to exact requirements

### Why Not .ts File Generation? (Alternative A)

**Approach**: Generate TypeScript Drizzle schema files to `/tmp/sovrium-schemas/`, run `drizzle-kit generate`, apply migrations.

**Rejected Because**:

- ❌ **Fights framework design** - Drizzle expects static compile-time schemas, not runtime generation
- ❌ **Complex workflow** - 5+ steps (generate .ts → write files → run drizzle-kit → run migrate → dynamic import)
- ❌ **File I/O overhead** - Writing/reading ephemeral files adds latency
- ❌ **CLI dependency** - Relies on `drizzle-kit` working correctly in all environments
- ❌ **Type safety lost anyway** - Dynamic imports break TypeScript inference

**Product Architecture Analysis**: Independent architectural review confirmed raw SQL is better fit for runtime schema generation than .ts file generation.

### Why Not Kysely? (Alternative B)

**Approach**: Replace Drizzle entirely with Kysely for runtime schema building.

**Rejected Because**:

- ❌ **Breaks Better Auth integration** - Better Auth has `drizzleAdapter`, no `kyselyAdapter` exists
- ❌ **No Bun dialect** - Kysely lacks official Bun support, would use slower drivers
- ❌ **Type safety moot** - Runtime schemas can't provide compile-time types regardless of ORM
- ❌ **Migration overhead** - Need to rewrite existing Drizzle code (2-3 hours work for zero gain)

**Architecture Decision**: Keep Drizzle for Better Auth (static schemas), use raw SQL for dynamic user tables (runtime schemas).

### Why Not EAV/JSONB Pattern? (Alternative C)

**Approach**: Store all user data in generic `records` table with JSONB columns.

**Rejected Because**:

- ❌ **Poor query performance** - JSON parsing overhead for every query
- ❌ **No native constraints** - Can't use foreign keys, unique constraints, or indexes properly
- ❌ **Complex queries** - Requires JSONB operators instead of standard SQL
- ❌ **Doesn't scale** - Performance degrades significantly with millions of records

---

## Consequences

### Positive Consequences

✅ **Simple Implementation** - 3-step pipeline (JSON → SQL → Execute) is easy to understand and maintain
✅ **Fast Startup** - In-memory generation with checksum optimization (< 100ms if unchanged)
✅ **Direct Execution** - bun:sql native driver is optimized for Bun runtime
✅ **Debuggable** - SQL strings can be logged before execution for troubleshooting
✅ **Portable** - Standard PostgreSQL DDL works anywhere
✅ **Minimal Integration** - Keeps existing Drizzle code for Better Auth unchanged
✅ **No Build Step** - Runtime generation means no CI/CD compilation required

### Negative Consequences

❌ **No Compile-Time Type Safety** - User-defined tables don't have TypeScript types
→ **Mitigation**: Runtime validation with Effect Schema at boundaries

❌ **Manual SQL Generation** - Need to map 30+ field types to PostgreSQL columns
→ **Mitigation**: Comprehensive unit tests for SQL generator, extensive E2E tests

❌ **Custom Migration Tracking** - Need to build schema change detection logic
→ **Mitigation**: Checksum-based optimization, transaction rollback on errors

❌ **Startup Overhead** - Schema generation adds ~2-5 seconds on first run
→ **Mitigation**: Checksum optimization skips generation if config unchanged (< 100ms)

### Risk Mitigation

**Data Loss Prevention**:

- All migrations run in PostgreSQL transactions (all-or-nothing)
- Migration failures trigger immediate rollback and app crash (fail-fast)
- ID tracking in metadata enables rename detection (prevents DROP+CREATE for renames)

**Error Handling**:

- Effect.ts error types provide structured error information
- SQL errors include full context (operation, SQL statement, cause)
- Migration history tracked in `_sovrium_migrations` table

**Testing Strategy**:

- 27 E2E spec tests for all migration scenarios
- Unit tests for SQL generator and migration executor
- Integration tests with real PostgreSQL (TestContainers)

---

## Alternatives Considered

### Summary Table

| Approach               | Steps | File I/O | CLI Tools      | Type Safety | Drizzle Integration     | Verdict               |
| ---------------------- | ----- | -------- | -------------- | ----------- | ----------------------- | --------------------- |
| **Raw SQL (Selected)** | 3     | ❌ No    | ❌ No          | ❌ No       | ✅ Keep for Better Auth | ✅ **Best**           |
| Drizzle .ts Generation | 5+    | ✅ Yes   | ✅ drizzle-kit | ⚠️ Lost     | ✅ Full integration     | ❌ Too complex        |
| Kysely                 | 4     | ❌ No    | ❌ No          | ⚠️ Limited  | ❌ Need adapter         | ❌ Breaks Better Auth |
| EAV/JSONB              | 2     | ❌ No    | ❌ No          | ❌ No       | ✅ Keep Drizzle         | ❌ Poor performance   |

### Decision Matrix

**Criteria Weights**: Simplicity (30%), Performance (25%), Developer Experience (20%), Type Safety (15%), Integration Cost (10%)

**Scores** (out of 10):

- **Raw SQL**: 9.0 (simplicity: 10, performance: 10, DX: 8, type safety: 5, integration: 10)
- Drizzle .ts: 6.5 (simplicity: 4, performance: 7, DX: 7, type safety: 6, integration: 10)
- Kysely: 6.0 (simplicity: 7, performance: 8, DX: 6, type safety: 6, integration: 3)
- EAV/JSONB: 4.5 (simplicity: 8, performance: 2, DX: 4, type safety: 5, integration: 10)

**Conclusion**: Raw SQL has the highest score primarily due to simplicity and performance.

---

## Implementation Notes

### Field Type Mapping

Map 30+ Sovrium field types to PostgreSQL column types:

| Sovrium Field Type | PostgreSQL Type          | Example SQL                                        |
| ------------------ | ------------------------ | -------------------------------------------------- |
| `single-line-text` | TEXT                     | `name TEXT NOT NULL`                               |
| `email`            | TEXT + UNIQUE            | `email TEXT NOT NULL UNIQUE`                       |
| `integer`          | INTEGER                  | `age INTEGER`                                      |
| `decimal`          | NUMERIC(19,4)            | `price NUMERIC(19,4)`                              |
| `date`             | TIMESTAMP WITH TIME ZONE | `deadline TIMESTAMP WITH TIME ZONE`                |
| `checkbox`         | BOOLEAN                  | `active BOOLEAN NOT NULL DEFAULT true`             |
| `single-select`    | TEXT + CHECK             | `status TEXT CHECK (status IN ('active', 'done'))` |
| `linked-record`    | INTEGER + FK             | `author_id INTEGER REFERENCES users(id)`           |
| `formula`          | **Virtual (no column)**  | Computed at query time                             |

See [Field Type Mapping](../../../specs/app/tables/field-types/) for complete reference.

### Checksum Optimization

```sql
-- Track schema checksum to skip generation when unchanged
CREATE TABLE _sovrium_schema_checksum (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  checksum TEXT NOT NULL,
  last_generated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Algorithm**:

1. Hash JSON config to create checksum
2. Compare with stored checksum
3. If match: Skip generation (< 100ms startup)
4. If different: Generate SQL + execute migrations + update checksum

**Performance**:

- Unchanged config: < 100ms startup overhead
- Changed config: 2-5 seconds for 10-20 tables

---

## Enforcement

This section validates what architectural constraints are automatically enforced via tooling and what requires manual review.

### ESLint Boundaries (Active)

**Rule**: `infrastructure-database` layer enforced via `eslint-plugin-boundaries`

**Configuration** (`eslint/boundaries.config.ts` lines 119-122):

```typescript
{
  type: 'infrastructure-database',
  pattern: 'src/infrastructure/database/**/*',
  mode: 'file'
}
```

**What's Enforced**:

- ✅ Migration code in `src/infrastructure/database/` can only import from Domain layer and application ports
- ✅ Prevents circular dependencies between infrastructure services
- ✅ Enforces dependency inversion (infrastructure implements domain interfaces)
- ✅ Strict isolation: Infrastructure database cannot import from Application use-cases directly (lines 420-459)

**What's NOT Enforced**:

- ❌ No automatic validation that migrations are transactional (manual implementation required)
- ❌ No compile-time check that checksum optimization works (runtime behavior only)
- ❌ No enforcement that virtual fields skip column creation (implementation detail)
- ❌ SQL DDL correctness (PostgreSQL validates at execution time)

**Verification**: Run `bun run lint` to catch boundary violations before commit.

---

### TypeScript Strict Mode (Active)

**Purpose**: Enable type safety for migration pipeline components

**Configuration** (`tsconfig.json`):

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**What's Enforced**:

- ✅ Type safety for JSON config parsing (no implicit `any`)
- ✅ Null safety for database queries (strict null checks)
- ✅ Effect.ts error types (typed error handling)
- ✅ Function signatures must declare return types

**What's NOT Enforced**:

- ⚠️ Dynamic SQL string correctness (no SQL type checking in TypeScript)
- ⚠️ PostgreSQL type compatibility (runtime validation only)
- ⚠️ Field type mapping completeness (developer must handle all 30+ types)

**Verification**: Run `bun run typecheck` to catch type errors before commit.

---

### Effect Schema Validation (Active)

**Purpose**: Runtime validation of JSON config before SQL generation

**Schema Location**: `src/domain/models/app/table/` (Feature-isolated domain models)

**Key Schemas**:

- `FieldSchema` - Validates 30+ field types, required properties, constraints
- `TableSchema` - Validates table structure (name, fields array)
- `TablesSchema` - Validates entire config (array of tables)

**What's Enforced**:

- ✅ Table schema structure validated (Effect Schema at app startup)
- ✅ Field type validation (30+ types must match schema definition)
- ✅ Required field checks (name, type, etc. cannot be missing)
- ✅ Type safety at runtime (invalid config crashes app with clear error)

**What's NOT Enforced**:

- ⚠️ SQL injection prevention (bun:sql handles this via parameterized queries, not Effect Schema)
- ⚠️ PostgreSQL-specific constraints (e.g., max identifier length 63 chars)
- ⚠️ Foreign key target validation (requires database lookup)

**See**: `@docs/infrastructure/framework/effect.md` for Effect Schema patterns.

---

### Manual Review Required

The following aspects of runtime SQL migrations require manual code review and cannot be automatically enforced:

1. **SQL DDL Correctness**: Generated SQL must be valid PostgreSQL syntax
2. **Migration Transactionality**: All DDL must run in PostgreSQL transaction (BEGIN/COMMIT/ROLLBACK)
3. **Checksum Algorithm**: Hash function must be deterministic and collision-resistant
4. **Rename Detection**: ID-based tracking must prevent DROP+CREATE for renames
5. **Virtual Field Handling**: Formula/rollup/lookup fields must skip column generation
6. **Error Messages**: Failure messages must include full context for debugging
7. **Performance**: Startup time must stay under 5 seconds for typical schemas

**Testing Strategy**: 27 E2E spec tests cover all migration scenarios (see `specs/migrations/`).

---

## Implementation Status

**Phase**: Documentation (ADR approved, implementation pending)

**Current State**:

- ✅ ADR documented and approved (2025-01-25)
- ✅ E2E test specifications created (27 specs in `specs/migrations/`)
- ✅ Architecture pattern documented (`patterns/config-driven-schema-generation.md`)
- ✅ Infrastructure documentation created (9-part deep dive)
- ❌ SQL generator implementation (pending)
- ❌ Migration executor implementation (pending)
- ❌ Checksum optimization implementation (pending)
- ❌ Integration with app startup (pending)

**Next Steps**:

1. **Implement SQL Generator** (`src/infrastructure/database/sql-generator/`)
   - Create field type mapping functions (30+ types)
   - Generate CREATE TABLE statements
   - Generate ALTER TABLE statements for schema changes
   - Handle virtual fields (skip column creation)

2. **Implement Migration Executor** (`src/infrastructure/database/migration-executor/`)
   - Transaction handling (BEGIN/COMMIT/ROLLBACK)
   - Error handling with Effect.ts typed errors
   - Migration history tracking (`_sovrium_migrations` table)

3. **Implement Orchestrator** (`src/infrastructure/database/migration-orchestrator/`)
   - Checksum calculation and comparison
   - Rename detection (ID-based tracking)
   - Integration with app startup sequence

4. **Write Tests**:
   - Unit tests for SQL generator (validate DDL correctness)
   - Integration tests for migration executor (transaction handling)
   - E2E tests using Playwright (27 specs already written with `.fixme()`)

5. **Performance Optimization**:
   - Validate checksum optimization (< 100ms if unchanged)
   - Benchmark startup time (target < 5s for typical schemas)
   - Profile memory usage

**Tracking**: See `ROADMAP.md` Phase 0 - Foundation for complete implementation roadmap

**Design Review**: Product Architecture review completed (2025-01-25). Raw SQL generation approach validated as simpler and more performant than Drizzle .ts file generation.

---

## References

- **Architecture Pattern**: [Config-Driven Schema Generation](../patterns/config-driven-schema-generation.md)
- **Technical Deep Dive**: [Runtime SQL Migrations](../../infrastructure/database/runtime-sql-migrations/)
- **Product Architecture Analysis**: Internal review (2025-01-25) comparing Drizzle .ts generation vs raw SQL
- **E2E Specifications**: [Migration Tests](../../../specs/app/tables/migrations/)
- **Similar Systems**: Prisma (schema DSL), TypeORM (decorators), Drizzle (static .ts), **Sovrium (JSON → SQL)**

---

## Review Schedule

**Next Review**: 6 months after implementation (July 2025)

**Review Questions**:

1. Is startup time acceptable in production? (Target: < 5s for typical schemas)
2. Are migration errors clear enough for debugging?
3. Have we encountered edge cases in field type mapping?
4. Would compile-time types provide significant value?
5. Should we reconsider Kysely if Better Auth adds official adapter?

---

**Last Updated**: 2025-01-25
**Authors**: Product Architecture Team
**Status**: Accepted ✅
