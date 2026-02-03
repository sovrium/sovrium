# Migrations Specification

> Schema evolution and database migration system for Sovrium applications

## Overview

The Migrations system provides safe, versioned schema evolution for Sovrium tables. It includes checksum optimization, automatic rollback, audit logging, and comprehensive support for all schema modification operations.

**Vision Alignment**: Migrations enable Sovrium's configuration-driven approach to extend to schema management, allowing teams to evolve their data models through configuration changes.

## Architecture

### System Tables

| Table                      | Purpose                                               |
| -------------------------- | ----------------------------------------------------- |
| `system.schema_checksum`   | Stores SHA-256 hash of current schema (singleton row) |
| `system.migration_history` | Version tracking for applied migrations               |
| `system.migration_log`     | Audit trail of all migration operations               |

### Migration Flow

```
App Schema (YAML/JSON)
    ↓
Schema Checksum Calculation (SHA-256)
    ↓
Compare with stored checksum
    ↓
[Match] → Skip migrations (< 100ms startup)
[Mismatch] → Execute migrations (5-10s+ for full)
    ↓
Validate migrated schema
    ↓
[Success] → Update checksum, commit
[Failure] → Rollback, restore previous checksum
```

---

## Checksum Optimization

**Location**: `specs/migrations/migration-system/checksum.spec.ts`

The checksum system enables fast application startup by skipping unchanged migrations.

### How It Works

1. **Calculate**: Compute SHA-256 hash of entire app schema (tables, fields, indexes)
2. **Compare**: Check against stored checksum in `system.schema_checksum`
3. **Decide**: Skip migrations if checksums match, run if different

### Test Coverage

| Scenario             | Description                           | Status |
| -------------------- | ------------------------------------- | ------ |
| Skip unchanged       | Checksum match → no migration queries | 🟢     |
| Detect changes       | Any schema change → new checksum      | 🟢     |
| First run            | No stored checksum → full migration   | 🟢     |
| Re-migrate on change | Modified schema → re-run migrations   | 🟢     |

### Performance Impact

| Scenario              | Startup Time                    |
| --------------------- | ------------------------------- |
| Checksum match (skip) | < 100ms                         |
| Full migration        | 5-10s+ (depends on schema size) |

---

## Rollback System

**Location**: `specs/migrations/migration-system/rollback.spec.ts`

Automatic rollback ensures database integrity when migrations fail.

### Rollback Triggers

| Trigger               | Behavior                                         |
| --------------------- | ------------------------------------------------ |
| Checksum mismatch     | Detect unexpected schema state, trigger rollback |
| Validation failure    | Schema validation fails post-migration           |
| Constraint violation  | Database constraint errors during migration      |
| Data conversion error | Type casting failures during field modification  |

### Rollback Behaviors

| Behavior                          | Description                                                    |
| --------------------------------- | -------------------------------------------------------------- |
| **Cascading rollback**            | Dependent tables rolled back in reverse order                  |
| **Audit logging**                 | All rollback operations logged to `migration_log`              |
| **Data loss prevention**          | Destructive operations blocked without `allowDestructive` flag |
| **Previous checksum restoration** | Restores last known good checksum                              |

### Test Coverage

| Scenario                            | Description                                   | Status |
| ----------------------------------- | --------------------------------------------- | ------ |
| Detect checksum mismatch            | Identify unexpected schema state              | 🟢     |
| Auto-rollback on validation failure | Revert when post-migration validation fails   | 🟢     |
| Cascading rollback                  | Rollback dependent tables in correct order    | 🟢     |
| Audit rollback operations           | Log all rollback actions                      | 🟢     |
| Data loss prevention                | Require explicit flag for destructive ops     | 🟢     |
| Restore previous checksum           | Return to last known good state               | 🟢     |
| Partial rollback                    | Rollback specific operations within migration | 🟢     |
| Rollback notification               | Alert when rollback occurs                    | 🟢     |

### Data Loss Prevention

Destructive operations require explicit `allowDestructive` flag:

```yaml
migrations:
  allowDestructive: true # Required for: DROP TABLE, DROP COLUMN, truncation
```

**Protected Operations**:

- Dropping tables
- Removing columns
- Truncating data during type narrowing
- Removing constraints that could affect data integrity

---

## Schema Evolution Operations

### Add Field

**Location**: `specs/migrations/schema-evolution/add-field.spec.ts`

| Operation               | SQL Generated                                                               | Test Status |
| ----------------------- | --------------------------------------------------------------------------- | ----------- |
| NOT NULL with default   | `ALTER TABLE ADD COLUMN name TEXT NOT NULL DEFAULT 'value'`                 | 🟢          |
| Nullable column         | `ALTER TABLE ADD COLUMN name TEXT NULL`                                     | 🟢          |
| CHECK constraint (enum) | `ALTER TABLE ADD COLUMN status TEXT CHECK (status IN ('a','b','c'))`        | 🟢          |
| Default value           | `ALTER TABLE ADD COLUMN count INTEGER DEFAULT 0`                            | 🟢          |
| Soft delete column      | `ALTER TABLE ADD COLUMN deleted_at TIMESTAMP NULL; CREATE INDEX...`         | 🟢          |
| Indexed column          | `ALTER TABLE ADD COLUMN...; CREATE INDEX idx_table_column ON table(column)` | 🟢          |

### Remove Field

**Location**: `specs/migrations/schema-evolution/remove-field.spec.ts`

| Operation                  | Requirement                              | Test Status |
| -------------------------- | ---------------------------------------- | ----------- |
| Remove column              | `allowDestructive: true`                 | 🟢          |
| Cascade index removal      | Auto-drop indexes on removed column      | 🟢          |
| Cascade constraint removal | Auto-drop constraints referencing column | 🟢          |

### Rename Field

**Location**: `specs/migrations/schema-evolution/rename-field.spec.ts`

| Operation          | SQL Generated                                    | Test Status |
| ------------------ | ------------------------------------------------ | ----------- |
| Rename column      | `ALTER TABLE RENAME COLUMN old_name TO new_name` | 🟢          |
| Update indexes     | Recreate indexes with new column name            | 🟢          |
| Update constraints | Update constraint definitions                    | 🟢          |

### Rename Table

**Location**: `specs/migrations/schema-evolution/rename-table.spec.ts`

| Operation           | SQL Generated                             | Test Status |
| ------------------- | ----------------------------------------- | ----------- |
| Rename table        | `ALTER TABLE old_name RENAME TO new_name` | 🟢          |
| Update foreign keys | Update referencing tables                 | 🟢          |
| Update views        | Recreate dependent views                  | 🟢          |

### Modify Field Type

**Location**: `specs/migrations/schema-evolution/modify-field-type.spec.ts`

| Operation                      | SQL Generated                                                              | Test Status |
| ------------------------------ | -------------------------------------------------------------------------- | ----------- |
| Widen (TEXT → VARCHAR(500))    | `ALTER TABLE ALTER COLUMN type TYPE VARCHAR(500)`                          | 🟢          |
| Narrow with truncation         | `ALTER TABLE ALTER COLUMN...` + `allowDestructive`                         | 🟢          |
| INTEGER → DECIMAL              | `ALTER TABLE ALTER COLUMN type TYPE DECIMAL USING column::DECIMAL`         | 🟢          |
| TEXT → INTEGER                 | `ALTER TABLE ALTER COLUMN type TYPE INTEGER USING column::INTEGER`         | 🟢          |
| TEXT → TIMESTAMPTZ             | `ALTER TABLE ALTER COLUMN type TYPE TIMESTAMPTZ USING column::TIMESTAMPTZ` | 🟢          |
| Rollback on conversion failure | Auto-rollback if USING cast fails                                          | 🟢          |

### Modify Field Required

**Location**: `specs/migrations/schema-evolution/modify-field-required.spec.ts`

| Operation                 | SQL Generated                             | Test Status |
| ------------------------- | ----------------------------------------- | ----------- |
| Add NOT NULL              | `ALTER TABLE ALTER COLUMN SET NOT NULL`   | 🟢          |
| Remove NOT NULL           | `ALTER TABLE ALTER COLUMN DROP NOT NULL`  | 🟢          |
| Add NOT NULL with default | Set default, update nulls, add constraint | 🟢          |

### Modify Field Constraints

**Location**: `specs/migrations/schema-evolution/modify-field-constraints.spec.ts`

| Operation    | SQL Generated                                | Test Status |
| ------------ | -------------------------------------------- | ----------- |
| Add CHECK    | `ALTER TABLE ADD CONSTRAINT ... CHECK (...)` | 🟢          |
| Remove CHECK | `ALTER TABLE DROP CONSTRAINT ...`            | 🟢          |
| Modify CHECK | Drop old, add new constraint                 | 🟢          |

### Modify Field Default

**Location**: `specs/migrations/schema-evolution/modify-field-default.spec.ts`

| Operation      | SQL Generated                                      | Test Status |
| -------------- | -------------------------------------------------- | ----------- |
| Set default    | `ALTER TABLE ALTER COLUMN SET DEFAULT 'value'`     | 🟢          |
| Remove default | `ALTER TABLE ALTER COLUMN DROP DEFAULT`            | 🟢          |
| Change default | `ALTER TABLE ALTER COLUMN SET DEFAULT 'new_value'` | 🟢          |

### Modify Field Options (Enum)

**Location**: `specs/migrations/schema-evolution/modify-field-options.spec.ts`

| Operation       | Description                                           | Test Status |
| --------------- | ----------------------------------------------------- | ----------- |
| Add option      | Add value to CHECK constraint                         | 🟢          |
| Remove option   | Remove value from CHECK (requires `allowDestructive`) | 🟢          |
| Rename option   | Update values + constraint                            | 🟢          |
| Reorder options | Recreate CHECK with new order                         | 🟢          |

### Modify Field Unique

**Location**: `specs/migrations/schema-evolution/modify-field-unique.spec.ts`

| Operation        | SQL Generated                                        | Test Status |
| ---------------- | ---------------------------------------------------- | ----------- |
| Add UNIQUE       | `ALTER TABLE ADD CONSTRAINT ... UNIQUE (column)`     | 🟢          |
| Remove UNIQUE    | `ALTER TABLE DROP CONSTRAINT ...`                    | 🟢          |
| Composite UNIQUE | `ALTER TABLE ADD CONSTRAINT ... UNIQUE (col1, col2)` | 🟢          |

### Modify Indexes

**Location**: `specs/migrations/schema-evolution/modify-indexes.spec.ts`

| Operation           | SQL Generated                                          | Test Status |
| ------------------- | ------------------------------------------------------ | ----------- |
| Add index           | `CREATE INDEX idx_name ON table (column)`              | 🟢          |
| Remove index        | `DROP INDEX idx_name`                                  | 🟢          |
| Add composite index | `CREATE INDEX idx_name ON table (col1, col2)`          | 🟢          |
| Add partial index   | `CREATE INDEX idx_name ON table (col) WHERE condition` | 🟢          |

### Modify Unique Constraints

**Location**: `specs/migrations/schema-evolution/modify-unique-constraints.spec.ts`

| Operation                | SQL Generated                                 | Test Status |
| ------------------------ | --------------------------------------------- | ----------- |
| Add unique constraint    | `ALTER TABLE ADD CONSTRAINT ... UNIQUE (...)` | 🟢          |
| Remove unique constraint | `ALTER TABLE DROP CONSTRAINT ...`             | 🟢          |
| Modify unique constraint | Drop + Add (atomic transaction)               | 🟢          |

### Views

**Location**: `specs/migrations/schema-evolution/views.spec.ts`

| Operation                | SQL Generated                          | Test Status |
| ------------------------ | -------------------------------------- | ----------- |
| Create view              | `CREATE VIEW view_name AS SELECT ...`  | 🟢          |
| Drop view                | `DROP VIEW view_name`                  | 🟢          |
| Recreate on table change | Auto-drop and recreate dependent views | 🟢          |

---

## Error Handling

**Location**: `specs/migrations/migration-system/error-handling.spec.ts`

| Error Type           | Behavior                                 |
| -------------------- | ---------------------------------------- |
| Syntax error         | Rollback, log error, abort migration     |
| Constraint violation | Rollback, provide detailed error message |
| Connection failure   | Retry with exponential backoff           |
| Timeout              | Configurable timeout, rollback on exceed |
| Disk space           | Pre-check available space, warn if low   |

---

## Audit Trail

**Location**: `specs/migrations/migration-system/audit-trail.spec.ts`

All migration operations are logged to `system.migration_log`:

| Field           | Type        | Description                                   |
| --------------- | ----------- | --------------------------------------------- |
| `id`            | UUID        | Unique operation identifier                   |
| `migration_id`  | VARCHAR     | Reference to migration version                |
| `operation`     | VARCHAR     | Operation type (ADD_COLUMN, DROP_TABLE, etc.) |
| `table_name`    | VARCHAR     | Affected table                                |
| `column_name`   | VARCHAR     | Affected column (if applicable)               |
| `sql_executed`  | TEXT        | Actual SQL statement                          |
| `status`        | VARCHAR     | SUCCESS, FAILED, ROLLED_BACK                  |
| `error_message` | TEXT        | Error details (if failed)                     |
| `executed_at`   | TIMESTAMPTZ | Timestamp of operation                        |
| `duration_ms`   | INTEGER     | Execution time in milliseconds                |

---

## E2E Test Coverage

| Category         | Spec Files | Tests | Status  |
| ---------------- | ---------- | ----- | ------- |
| Migration System | 4          | ~25   | 🟢 100% |
| Schema Evolution | 13         | ~65   | 🟢 100% |

### Migration System Specs

| Spec File                | Tests | Description           |
| ------------------------ | ----- | --------------------- |
| `checksum.spec.ts`       | ~5    | Checksum optimization |
| `rollback.spec.ts`       | ~9    | Rollback scenarios    |
| `error-handling.spec.ts` | ~6    | Error handling        |
| `audit-trail.spec.ts`    | ~5    | Audit logging         |

### Schema Evolution Specs

| Spec File                           | Tests | Description                  |
| ----------------------------------- | ----- | ---------------------------- |
| `add-field.spec.ts`                 | ~7    | Add columns                  |
| `remove-field.spec.ts`              | ~4    | Remove columns               |
| `rename-field.spec.ts`              | ~4    | Rename columns               |
| `rename-table.spec.ts`              | ~4    | Rename tables                |
| `modify-field-type.spec.ts`         | ~7    | Type changes                 |
| `modify-field-required.spec.ts`     | ~4    | NULL/NOT NULL                |
| `modify-field-constraints.spec.ts`  | ~4    | CHECK constraints            |
| `modify-field-default.spec.ts`      | ~4    | Default values               |
| `modify-field-options.spec.ts`      | ~5    | Enum options                 |
| `modify-field-unique.spec.ts`       | ~4    | Unique constraints           |
| `modify-indexes.spec.ts`            | ~5    | Index management             |
| `modify-unique-constraints.spec.ts` | ~4    | Unique constraint management |
| `views.spec.ts`                     | ~4    | View management              |

**Total**: 17 spec files, ~90 tests

---

## Implementation Status

**Overall**: 🟢 100%

| Component             | Status | Notes                               |
| --------------------- | ------ | ----------------------------------- |
| Checksum Optimization | ✅     | SHA-256 hashing, skip unchanged     |
| Rollback System       | ✅     | Auto-rollback, cascading, audit     |
| Add Field             | ✅     | All variants supported              |
| Remove Field          | ✅     | With data loss prevention           |
| Rename Field          | ✅     | Index/constraint updates            |
| Rename Table          | ✅     | FK/view updates                     |
| Modify Field Type     | ✅     | Type conversions, rollback          |
| Modify Field Required | ✅     | NULL/NOT NULL changes               |
| Modify Constraints    | ✅     | CHECK, DEFAULT, UNIQUE              |
| Index Management      | ✅     | Create, drop, modify                |
| View Management       | ✅     | Auto-recreate on dependency changes |
| Error Handling        | ✅     | Comprehensive error recovery        |
| Audit Trail           | ✅     | Full operation logging              |

---

## Use Cases

### Example 1: Adding a Soft Delete Column

```yaml
tables:
  - name: posts
    fields:
      - name: id
        type: number
        primaryKey: true
      - name: title
        type: text
        required: true
      - name: deleted_at # Add soft delete column
        type: timestamp
        required: false # Nullable for soft delete pattern
```

**Generated SQL**:

```sql
ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMP NULL;
CREATE INDEX idx_posts_deleted_at ON posts (deleted_at);
```

### Example 2: Changing Field Type with Conversion

```yaml
tables:
  - name: orders
    fields:
      - name: amount
        type: decimal # Changed from integer to decimal
        precision: 10
        scale: 2
```

**Generated SQL**:

```sql
ALTER TABLE orders
  ALTER COLUMN amount TYPE DECIMAL(10,2)
  USING amount::DECIMAL(10,2);
```

### Example 3: Adding Enum Field with Options

```yaml
tables:
  - name: tasks
    fields:
      - name: status
        type: singleSelect
        options:
          - pending
          - in_progress
          - completed
        required: true
        default: pending
```

**Generated SQL**:

```sql
ALTER TABLE tasks
  ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'in_progress', 'completed'));
```

### Example 4: Safe Destructive Migration

```yaml
migrations:
  allowDestructive: true # Required for column removal

tables:
  - name: users
    fields:
      - name: id
        type: number
        primaryKey: true
      - name: email
        type: text
        required: true
      # legacy_field removed
```

**Generated SQL**:

```sql
-- Backed up and logged before execution
ALTER TABLE users DROP COLUMN legacy_field;
```

---

## Configuration Options

| Option                        | Type    | Default  | Description                          |
| ----------------------------- | ------- | -------- | ------------------------------------ |
| `migrations.allowDestructive` | boolean | `false`  | Allow destructive operations         |
| `migrations.timeout`          | number  | `300000` | Migration timeout (ms)               |
| `migrations.retryCount`       | number  | `3`      | Retry count for transient failures   |
| `migrations.retryDelay`       | number  | `1000`   | Delay between retries (ms)           |
| `migrations.dryRun`           | boolean | `false`  | Preview migrations without executing |

---

## Related Features

- [Tables](./tables.md) - Table schema definitions that trigger migrations
- [API](./api.md) - API endpoints affected by schema changes

## Related Documentation

- [Drizzle ORM](../infrastructure/database/drizzle.md) - Database operations
- [Effect Schema](../infrastructure/framework/effect.md) - Schema validation
- [Soft Delete Pattern](../architecture/patterns/soft-delete-by-default.md) - Soft delete implementation
