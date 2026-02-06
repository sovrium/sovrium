# Schema Evolution

> **Feature Area**: Migrations - Schema Evolution
> **Schema**: `src/domain/models/migrations/`
> **E2E Specs**: `specs/migrations/schema-evolution/`

---

## Overview

Sovrium provides automatic schema evolution capabilities that detect changes between the application configuration and the database schema. When changes are detected, Sovrium generates and executes the appropriate SQL migrations to update the database schema, all within a transaction for safety.

---

## US-DB-MIGRATION-001: Add Fields

**As a** developer,
**I want to** add new fields to existing tables,
**so that** I can extend my data model without losing existing data.

### Configuration

```yaml
# Before: tables with existing fields
tables:
  - id: 1
    name: users
    fields:
      - id: 1
        name: email
        type: email

# After: add phone field
tables:
  - id: 1
    name: users
    fields:
      - id: 1
        name: email
        type: email
      - id: 2
        name: phone
        type: text
        required: false
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                         | Status |
| ------ | ------------------------------------------------------- | -------------------------------- | ------ |
| AC-001 | Adds NOT NULL column to existing table                  | `MIGRATION-ALTER-ADD-001`        | ✅     |
| AC-002 | Adds nullable column without NOT NULL constraint        | `MIGRATION-ALTER-ADD-002`        | ✅     |
| AC-003 | Adds column with CHECK constraint for enum values       | `MIGRATION-ALTER-ADD-003`        | ✅     |
| AC-004 | Adds column with default value applied to existing rows | `MIGRATION-ALTER-ADD-004`        | ✅     |
| AC-005 | Adds deleted_at TIMESTAMP NULL column with index        | `MIGRATION-ALTER-ADD-005`        | ✅     |
| AC-006 | Preserves existing records as non-deleted (NULL)        | `MIGRATION-ALTER-ADD-006`        | ✅     |
| AC-007 | User can complete full add field workflow (regression)  | `MIGRATION-ALTER-ADD-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/migrations/add-field.ts`
- **E2E Spec**: `specs/migrations/schema-evolution/add-field.spec.ts`

---

## US-DB-MIGRATION-002: Remove Fields

**As a** developer,
**I want to** remove fields from existing tables,
**so that** I can clean up unused data and simplify my schema.

### Acceptance Criteria

| ID     | Criterion                                                 | E2E Spec                            | Status |
| ------ | --------------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | Removes column and preserves other columns                | `MIGRATION-ALTER-REMOVE-001`        | ✅     |
| AC-002 | Preserves column order for remaining fields               | `MIGRATION-ALTER-REMOVE-002`        | ✅     |
| AC-003 | Automatically drops associated index                      | `MIGRATION-ALTER-REMOVE-003`        | ✅     |
| AC-004 | CASCADE drops foreign key constraint                      | `MIGRATION-ALTER-REMOVE-004`        | ✅     |
| AC-005 | User can complete full remove field workflow (regression) | `MIGRATION-ALTER-REMOVE-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/migrations/remove-field.ts`
- **E2E Spec**: `specs/migrations/schema-evolution/remove-field.spec.ts`

---

## US-DB-MIGRATION-003: Rename Fields

**As a** developer,
**I want to** rename fields in existing tables,
**so that** I can improve naming conventions without losing data.

### Acceptance Criteria

| ID     | Criterion                                                 | E2E Spec                            | Status |
| ------ | --------------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | Generates RENAME COLUMN instead of DROP+ADD via field ID  | `MIGRATION-ALTER-RENAME-001`        | ✅     |
| AC-002 | Automatically updates index reference on rename           | `MIGRATION-ALTER-RENAME-002`        | ✅     |
| AC-003 | Preserves foreign key constraint on rename                | `MIGRATION-ALTER-RENAME-003`        | ✅     |
| AC-004 | Handles CHECK constraint references after rename          | `MIGRATION-ALTER-RENAME-004`        | ✅     |
| AC-005 | User can complete full rename field workflow (regression) | `MIGRATION-ALTER-RENAME-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/migrations/rename-field.ts`
- **E2E Spec**: `specs/migrations/schema-evolution/rename-field.spec.ts`

---

## US-DB-MIGRATION-004: Rename Tables

**As a** developer,
**I want to** rename tables,
**so that** I can improve naming conventions across my entire schema.

### Acceptance Criteria

| ID     | Criterion                                                 | E2E Spec                            | Status |
| ------ | --------------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | Preserves data, indexes, and constraints on rename        | `MIGRATION-RENAME-TABLE-001`        | ✅     |
| AC-002 | Automatically updates foreign key references              | `MIGRATION-RENAME-TABLE-002`        | ✅     |
| AC-003 | All indexes and constraints remain functional             | `MIGRATION-RENAME-TABLE-003`        | ✅     |
| AC-004 | Migration fails with error and transaction rolls back     | `MIGRATION-RENAME-TABLE-004`        | ✅     |
| AC-005 | User can complete full rename table workflow (regression) | `MIGRATION-RENAME-TABLE-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/migrations/rename-table.ts`
- **E2E Spec**: `specs/migrations/schema-evolution/rename-table.spec.ts`

---

## US-DB-MIGRATION-005: Modify Field Types

**As a** developer,
**I want to** change field types,
**so that** I can evolve my data model as requirements change.

### Acceptance Criteria

| ID     | Criterion                                                      | E2E Spec                           | Status |
| ------ | -------------------------------------------------------------- | ---------------------------------- | ------ |
| AC-001 | Alters column type to TEXT                                     | `MIGRATION-MODIFY-TYPE-001`        | ✅     |
| AC-002 | Alters column type to VARCHAR with truncation                  | `MIGRATION-MODIFY-TYPE-002`        | ✅     |
| AC-003 | Alters column type to NUMERIC with precision                   | `MIGRATION-MODIFY-TYPE-003`        | ✅     |
| AC-004 | Alters column type to INTEGER with casting                     | `MIGRATION-MODIFY-TYPE-004`        | ✅     |
| AC-005 | Alters column type to TIMESTAMPTZ with casting                 | `MIGRATION-MODIFY-TYPE-005`        | ✅     |
| AC-006 | Migration fails with data conversion error, rolls back         | `MIGRATION-MODIFY-TYPE-006`        | ✅     |
| AC-007 | User can complete full modify field type workflow (regression) | `MIGRATION-MODIFY-TYPE-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/migrations/modify-type.ts`
- **E2E Spec**: `specs/migrations/schema-evolution/modify-field-type.spec.ts`

---

## US-DB-MIGRATION-006: Modify Field Constraints

**As a** developer,
**I want to** add or modify field constraints,
**so that** I can enforce data integrity rules.

### Acceptance Criteria

| ID     | Criterion                                                             | E2E Spec                                  | Status |
| ------ | --------------------------------------------------------------------- | ----------------------------------------- | ------ |
| AC-001 | Adds CHECK constraint with range validation                           | `MIGRATION-MODIFY-CONSTRAINTS-001`        | ✅     |
| AC-002 | Drops old and adds new CHECK with updated max                         | `MIGRATION-MODIFY-CONSTRAINTS-002`        | ✅     |
| AC-003 | Migration fails with invalid existing data                            | `MIGRATION-MODIFY-CONSTRAINTS-003`        | ✅     |
| AC-004 | Drops constraint to remove validation                                 | `MIGRATION-MODIFY-CONSTRAINTS-004`        | ✅     |
| AC-005 | User can complete full constraints modification workflow (regression) | `MIGRATION-MODIFY-CONSTRAINTS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/migrations/modify-constraints.ts`
- **E2E Spec**: `specs/migrations/schema-evolution/modify-field-constraints.spec.ts`

---

## US-DB-MIGRATION-007: Modify Field Defaults

**As a** developer,
**I want to** change field default values,
**so that** new records have appropriate initial values.

### Acceptance Criteria

| ID     | Criterion                                                          | E2E Spec                              | Status |
| ------ | ------------------------------------------------------------------ | ------------------------------------- | ------ |
| AC-001 | Sets default value on column                                       | `MIGRATION-MODIFY-DEFAULT-001`        | ✅     |
| AC-002 | Changes default value on column                                    | `MIGRATION-MODIFY-DEFAULT-002`        | ✅     |
| AC-003 | Drops default from column                                          | `MIGRATION-MODIFY-DEFAULT-003`        | ✅     |
| AC-004 | User can complete full defaults modification workflow (regression) | `MIGRATION-MODIFY-DEFAULT-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/migrations/modify-default.ts`
- **E2E Spec**: `specs/migrations/schema-evolution/modify-field-default.spec.ts`

---

## US-DB-MIGRATION-008: Modify Field Options

**As a** developer,
**I want to** change enum/select field options,
**so that** I can add, remove, or modify available values.

### Acceptance Criteria

| ID     | Criterion                                                         | E2E Spec                              | Status |
| ------ | ----------------------------------------------------------------- | ------------------------------------- | ------ |
| AC-001 | Drops old CHECK and adds new with additional value                | `MIGRATION-MODIFY-OPTIONS-001`        | ✅     |
| AC-002 | Drops old CHECK and adds new without removed value                | `MIGRATION-MODIFY-OPTIONS-002`        | ✅     |
| AC-003 | Migration fails when existing data uses removed option            | `MIGRATION-MODIFY-OPTIONS-003`        | ✅     |
| AC-004 | Adds CHECK constraint with JSONB validation                       | `MIGRATION-MODIFY-OPTIONS-004`        | ✅     |
| AC-005 | User can complete full options modification workflow (regression) | `MIGRATION-MODIFY-OPTIONS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/migrations/modify-options.ts`
- **E2E Spec**: `specs/migrations/schema-evolution/modify-field-options.spec.ts`

---

## US-DB-MIGRATION-009: Modify Field Required

**As a** developer,
**I want to** change whether a field is required,
**so that** I can enforce or relax data requirements.

### Acceptance Criteria

| ID     | Criterion                                                          | E2E Spec                               | Status |
| ------ | ------------------------------------------------------------------ | -------------------------------------- | ------ |
| AC-001 | Sets NOT NULL on column                                            | `MIGRATION-MODIFY-REQUIRED-001`        | ✅     |
| AC-002 | Migration fails without default when data exists                   | `MIGRATION-MODIFY-REQUIRED-002`        | ✅     |
| AC-003 | Sets default, backfills NULL values, then sets NOT NULL            | `MIGRATION-MODIFY-REQUIRED-003`        | ✅     |
| AC-004 | Drops NOT NULL from column                                         | `MIGRATION-MODIFY-REQUIRED-004`        | ✅     |
| AC-005 | User can complete full required modification workflow (regression) | `MIGRATION-MODIFY-REQUIRED-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/migrations/modify-required.ts`
- **E2E Spec**: `specs/migrations/schema-evolution/modify-field-required.spec.ts`

---

## US-DB-MIGRATION-010: Modify Field Unique Constraint

**As a** developer,
**I want to** add or remove unique constraints on fields,
**so that** I can enforce uniqueness where needed.

### Acceptance Criteria

| ID     | Criterion                                                              | E2E Spec                                   | Status |
| ------ | ---------------------------------------------------------------------- | ------------------------------------------ | ------ |
| AC-001 | Adds unique constraint on column                                       | `MIGRATION-MODIFY-FIELD-UNIQUE-001`        | ✅     |
| AC-002 | Migration fails with unique violation, rolls back                      | `MIGRATION-MODIFY-FIELD-UNIQUE-002`        | ✅     |
| AC-003 | Drops unique constraint from column                                    | `MIGRATION-MODIFY-FIELD-UNIQUE-003`        | ✅     |
| AC-004 | User can complete full field unique modification workflow (regression) | `MIGRATION-MODIFY-FIELD-UNIQUE-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/migrations/modify-unique.ts`
- **E2E Spec**: `specs/migrations/schema-evolution/modify-field-unique.spec.ts`

---

## US-DB-MIGRATION-011: Modify Indexes

**As a** developer,
**I want to** add, modify, or remove indexes,
**so that** I can optimize query performance.

### Acceptance Criteria

| ID     | Criterion                                                   | E2E Spec                            | Status |
| ------ | ----------------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | Creates btree index on specified field                      | `MIGRATION-MODIFY-INDEX-001`        | ✅     |
| AC-002 | Creates multi-column btree index                            | `MIGRATION-MODIFY-INDEX-002`        | ✅     |
| AC-003 | Drops index from table                                      | `MIGRATION-MODIFY-INDEX-003`        | ✅     |
| AC-004 | Drops old index and creates new composite index             | `MIGRATION-MODIFY-INDEX-004`        | ✅     |
| AC-005 | Drops regular index and creates unique index                | `MIGRATION-MODIFY-INDEX-005`        | ✅     |
| AC-006 | Creates index concurrently to allow reads/writes            | `MIGRATION-MODIFY-INDEX-006`        | ✅     |
| AC-007 | User can complete full modify indexes workflow (regression) | `MIGRATION-MODIFY-INDEX-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/migrations/modify-index.ts`
- **E2E Spec**: `specs/migrations/schema-evolution/modify-indexes.spec.ts`

---

## US-DB-MIGRATION-012: Modify Unique Constraints (Table-Level)

**As a** developer,
**I want to** manage composite unique constraints,
**so that** I can enforce uniqueness across multiple columns.

### Acceptance Criteria

| ID     | Criterion                                                              | E2E Spec                             | Status |
| ------ | ---------------------------------------------------------------------- | ------------------------------------ | ------ |
| AC-001 | Creates unique constraint on table                                     | `MIGRATION-MODIFY-UNIQUE-001`        | ✅     |
| AC-002 | Drops unique constraint from table                                     | `MIGRATION-MODIFY-UNIQUE-002`        | ✅     |
| AC-003 | Creates multi-column unique constraint                                 | `MIGRATION-MODIFY-UNIQUE-003`        | ✅     |
| AC-004 | Migration fails with data validation error, rolls back                 | `MIGRATION-MODIFY-UNIQUE-004`        | ✅     |
| AC-005 | Drops old and adds new composite constraint                            | `MIGRATION-MODIFY-UNIQUE-005`        | ✅     |
| AC-006 | User can complete full modify unique constraints workflow (regression) | `MIGRATION-MODIFY-UNIQUE-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/migrations/modify-unique-constraints.ts`
- **E2E Spec**: `specs/migrations/schema-evolution/modify-unique-constraints.spec.ts`

---

## US-DB-MIGRATION-013: Views

**As a** developer,
**I want to** create and manage database views,
**so that** I can provide read-only access to derived data.

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                    | Status |
| ------ | -------------------------------------------------- | --------------------------- | ------ |
| AC-001 | Creates view for read-only access                  | `MIGRATION-VIEW-001`        | ✅     |
| AC-002 | Drops view when removed                            | `MIGRATION-VIEW-002`        | ✅     |
| AC-003 | Alters view via drop and create                    | `MIGRATION-VIEW-003`        | ✅     |
| AC-004 | Creates materialized view                          | `MIGRATION-VIEW-004`        | ✅     |
| AC-005 | Refreshes materialized view                        | `MIGRATION-VIEW-005`        | ✅     |
| AC-006 | Drops view cascade                                 | `MIGRATION-VIEW-006`        | ✅     |
| AC-007 | User can complete full views workflow (regression) | `MIGRATION-VIEW-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/migrations/views.ts`
- **E2E Spec**: `specs/migrations/schema-evolution/views.spec.ts`

---

## Regression Tests

| Spec ID                                    | Workflow                                 | Status |
| ------------------------------------------ | ---------------------------------------- | ------ |
| `MIGRATION-ALTER-ADD-REGRESSION`           | Developer adds field to existing table   | `[x]`  |
| `MIGRATION-ALTER-REMOVE-REGRESSION`        | Developer removes field from table       | `[x]`  |
| `MIGRATION-ALTER-RENAME-REGRESSION`        | Developer renames field                  | `[x]`  |
| `MIGRATION-RENAME-TABLE-REGRESSION`        | Developer renames table                  | `[x]`  |
| `MIGRATION-MODIFY-TYPE-REGRESSION`         | Developer changes field type             | `[x]`  |
| `MIGRATION-MODIFY-CONSTRAINTS-REGRESSION`  | Developer modifies constraints           | `[x]`  |
| `MIGRATION-MODIFY-DEFAULT-REGRESSION`      | Developer modifies default value         | `[x]`  |
| `MIGRATION-MODIFY-OPTIONS-REGRESSION`      | Developer modifies enum options          | `[x]`  |
| `MIGRATION-MODIFY-REQUIRED-REGRESSION`     | Developer changes required status        | `[x]`  |
| `MIGRATION-MODIFY-FIELD-UNIQUE-REGRESSION` | Developer modifies unique constraint     | `[x]`  |
| `MIGRATION-MODIFY-INDEX-REGRESSION`        | Developer manages indexes                | `[x]`  |
| `MIGRATION-MODIFY-UNIQUE-REGRESSION`       | Developer manages table-level uniqueness | `[x]`  |
| `MIGRATION-VIEW-REGRESSION`                | Developer manages views                  | `[x]`  |

---

## Coverage Summary

| User Story          | Title                     | Spec Count             | Status   |
| ------------------- | ------------------------- | ---------------------- | -------- |
| US-DB-MIGRATION-001 | Add Fields                | 6                      | Complete |
| US-DB-MIGRATION-002 | Remove Fields             | 4                      | Complete |
| US-DB-MIGRATION-003 | Rename Fields             | 4                      | Complete |
| US-DB-MIGRATION-004 | Rename Tables             | 4                      | Complete |
| US-DB-MIGRATION-005 | Modify Field Types        | 6                      | Complete |
| US-DB-MIGRATION-006 | Modify Field Constraints  | 4                      | Complete |
| US-DB-MIGRATION-007 | Modify Field Defaults     | 3                      | Complete |
| US-DB-MIGRATION-008 | Modify Field Options      | 4                      | Complete |
| US-DB-MIGRATION-009 | Modify Field Required     | 4                      | Complete |
| US-DB-MIGRATION-010 | Modify Field Unique       | 3                      | Complete |
| US-DB-MIGRATION-011 | Modify Indexes            | 6                      | Complete |
| US-DB-MIGRATION-012 | Modify Unique Constraints | 5                      | Complete |
| US-DB-MIGRATION-013 | Views                     | 6                      | Complete |
| **Total**           |                           | **59 + 13 regression** |          |
