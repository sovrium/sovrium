# Migration System

> **Feature Area**: Migrations - System Infrastructure
> **Schema**: `src/domain/models/migrations/`
> **E2E Specs**: `specs/migrations/migration-system/`

---

## Overview

Sovrium includes a robust migration system that manages schema changes safely. The system provides checksum validation to detect schema drift, rollback capabilities to recover from failed migrations, a comprehensive audit trail for tracking changes, and proper error handling with transaction rollback.

---

## US-MIGRATION-SYSTEM-001: Checksum Validation

**As a** developer,
**I want to** have the system validate schema checksums,
**so that** I can detect unauthorized schema changes and prevent drift.

### How It Works

1. When a migration runs for the first time, Sovrium computes a SHA-256 checksum of the schema
2. On subsequent startups, Sovrium compares the current schema checksum with the stored one
3. If unchanged, the server starts quickly without running migrations
4. If changed, Sovrium executes the necessary migrations and saves the new checksum

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                        | Status |
| ------ | ------------------------------------------------------- | ------------------------------- | ------ |
| AC-001 | Saves SHA-256 checksum to system.schema_checksum table  | `MIGRATION-CHECKSUM-001`        | ✅     |
| AC-002 | Skips migration when schema unchanged (startup <100ms)  | `MIGRATION-CHECKSUM-002`        | ✅     |
| AC-003 | Executes migration and saves new checksum when modified | `MIGRATION-CHECKSUM-003`        | ✅     |
| AC-004 | Minor schema changes trigger re-migration               | `MIGRATION-CHECKSUM-004`        | ✅     |
| AC-005 | User can complete full checksum workflow (regression)   | `MIGRATION-CHECKSUM-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/migrations/migration-system/checksum.spec.ts`

---

## US-MIGRATION-SYSTEM-002: Rollback

**As a** developer,
**I want to** be able to rollback failed migrations,
**so that** I can recover from errors without data loss.

### CLI Usage

```bash
# Rollback to previous version
sovrium migrate:rollback

# Rollback to specific version
sovrium migrate:rollback --to 5

# Rollback with confirmation (when data loss possible)
sovrium migrate:rollback --force
```

### Acceptance Criteria

| ID     | Criterion                                                     | E2E Spec                        | Status |
| ------ | ------------------------------------------------------------- | ------------------------------- | ------ |
| AC-001 | Detects checksum mismatch and prevents migration              | `MIGRATION-ROLLBACK-001`        | ✅     |
| AC-002 | Rollbacks to last known good state on validation failure      | `MIGRATION-ROLLBACK-002`        | ✅     |
| AC-003 | Provides manual rollback command to restore previous version  | `MIGRATION-ROLLBACK-003`        | ✅     |
| AC-004 | Restores data integrity after failed migration rollback       | `MIGRATION-ROLLBACK-004`        | ✅     |
| AC-005 | Handles cascading rollback for dependent tables               | `MIGRATION-ROLLBACK-005`        | ✅     |
| AC-006 | Logs rollback operations for audit trail                      | `MIGRATION-ROLLBACK-006`        | ✅     |
| AC-007 | Supports schema downgrade from version N to N-1               | `MIGRATION-ROLLBACK-007`        | ✅     |
| AC-008 | Prevents rollback if it would cause data loss without --force | `MIGRATION-ROLLBACK-008`        | ✅     |
| AC-009 | User can complete full rollback workflow (regression)         | `MIGRATION-ROLLBACK-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/migrations/migration-system/rollback.spec.ts`

---

## US-MIGRATION-SYSTEM-003: Audit Trail

**As a** developer,
**I want to** have a complete audit trail of all migrations,
**so that** I can track schema changes over time and troubleshoot issues.

### Audit Information

The migration system records:

- Migration timestamp
- Schema version number
- Schema checksum (SHA-256)
- Complete schema snapshot
- Rollback operations with reason

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                     | Status |
| ------ | ----------------------------------------------------- | ---------------------------- | ------ |
| AC-001 | Records migration history with timestamp and checksum | `MIGRATION-AUDIT-001`        | ✅     |
| AC-002 | Stores complete schema snapshot in migration history  | `MIGRATION-AUDIT-002`        | ✅     |
| AC-003 | Tracks incremental version numbers for each migration | `MIGRATION-AUDIT-003`        | ✅     |
| AC-004 | Logs rollback operations with reason and timestamp    | `MIGRATION-AUDIT-004`        | ✅     |
| AC-005 | Provides query interface for migration history        | `MIGRATION-AUDIT-005`        | ✅     |
| AC-006 | Detects and reports schema drift from audit history   | `MIGRATION-AUDIT-006`        | ✅     |
| AC-007 | User can complete full audit workflow (regression)    | `MIGRATION-AUDIT-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/migrations/migration-system/audit-trail.spec.ts`

---

## US-MIGRATION-SYSTEM-004: Error Handling

**As a** developer,
**I want to** have comprehensive error handling during migrations,
**so that** failures don't corrupt my database.

### Error Scenarios

1. **Invalid Schema**: Validation errors before migration starts
2. **Migration Failure**: Errors during SQL execution
3. **Connection Errors**: Database unavailable
4. **Constraint Violations**: Foreign key or unique constraint failures

### Acceptance Criteria

| ID     | Criterion                                                          | E2E Spec                     | Status |
| ------ | ------------------------------------------------------------------ | ---------------------------- | ------ |
| AC-001 | Rollbacks transaction when generating SQL for invalid type         | `MIGRATION-ERROR-001`        | ✅     |
| AC-002 | Rollbacks all changes when migration fails mid-execution           | `MIGRATION-ERROR-002`        | ✅     |
| AC-003 | Rollbacks transaction on constraint violation                      | `MIGRATION-ERROR-003`        | ✅     |
| AC-004 | Fails and rollbacks when foreign key references non-existent table | `MIGRATION-ERROR-004`        | ✅     |
| AC-005 | Aborts application startup on database connection error            | `MIGRATION-ERROR-005`        | ✅     |
| AC-006 | Rejects schema with index on non-existent column                   | `MIGRATION-ERROR-006`        | ✅     |
| AC-007 | Rejects schema with duplicate table IDs                            | `MIGRATION-ERROR-007`        | ✅     |
| AC-008 | Rejects migration with invalid dependency order                    | `MIGRATION-ERROR-008`        | ✅     |
| AC-009 | Rejects destructive operations without confirmation flag           | `MIGRATION-ERROR-009`        | ✅     |
| AC-010 | Rejects empty migration with no schema changes                     | `MIGRATION-ERROR-010`        | ✅     |
| AC-011 | User can complete full error handling workflow (regression)        | `MIGRATION-ERROR-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/migrations/migration-system/error-handling.spec.ts`

---

## Regression Tests

| Spec ID                         | Workflow                                | Status |
| ------------------------------- | --------------------------------------- | ------ |
| `MIGRATION-CHECKSUM-REGRESSION` | Developer uses checksum optimization    | `[x]`  |
| `MIGRATION-ROLLBACK-REGRESSION` | Developer performs migration rollback   | `[x]`  |
| `MIGRATION-AUDIT-REGRESSION`    | Developer reviews migration audit trail | `[x]`  |
| `MIGRATION-ERROR-REGRESSION`    | Developer handles migration errors      | `[x]`  |

---

## Coverage Summary

| User Story              | Title               | Spec Count            | Status   |
| ----------------------- | ------------------- | --------------------- | -------- |
| US-MIGRATION-SYSTEM-001 | Checksum Validation | 4                     | Complete |
| US-MIGRATION-SYSTEM-002 | Rollback            | 8                     | Complete |
| US-MIGRATION-SYSTEM-003 | Audit Trail         | 6                     | Complete |
| US-MIGRATION-SYSTEM-004 | Error Handling      | 10                    | Complete |
| **Total**               |                     | **28 + 4 regression** |          |
