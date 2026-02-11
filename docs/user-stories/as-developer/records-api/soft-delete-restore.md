# Soft Delete & Restore

> **Feature Area**: Records API - Delete & Recovery
> **Schema**: `src/domain/models/app/table/`
> **API Routes**: `DELETE /api/tables/:tableId/records/:recordId`, `POST /api/tables/:tableId/records/:recordId/restore`
> **E2E Specs**: `specs/api/tables/{tableId}/records/`

---

## Overview

Sovrium implements soft delete as the default deletion strategy. Records are marked with a `deleted_at` timestamp rather than being permanently removed. This enables recovery, audit trails, and compliance with data retention policies. Permanent deletion is available for admins when required.

---

## US-SOFT-DELETE-001: Soft Delete Record

**As a** developer,
**I want to** soft delete records by setting deleted_at timestamp,
**so that** records can be recovered if deleted by mistake.

### API Request

```
DELETE /api/tables/1/records/123
```

### Response

```json
{
  "id": 123,
  "deleted_at": "2025-01-15T10:30:00Z"
}
```

### Acceptance Criteria

| ID     | Criterion                                     | E2E Spec                        | Status |
| ------ | --------------------------------------------- | ------------------------------- | ------ |
| AC-001 | Returns 200 OK with deleted record            | `API-TABLES-RECORDS-DELETE-001` | ✅     |
| AC-002 | Sets deleted_at timestamp on record           | `API-TABLES-RECORDS-DELETE-002` | ✅     |
| AC-003 | Returns 404 Not Found for non-existent record | `API-TABLES-RECORDS-DELETE-003` | ✅     |
| AC-004 | Returns 401 when not authenticated            | `API-TABLES-RECORDS-DELETE-004` | ✅     |
| AC-005 | Returns 403 when user lacks delete permission | `API-TABLES-RECORDS-DELETE-005` | ✅     |
| AC-006 | Returns 404 for already soft-deleted record   | `API-TABLES-RECORDS-DELETE-006` | ✅     |
| AC-007 | Logs delete operation to activity history     | `API-TABLES-RECORDS-DELETE-007` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/{recordId}/delete.spec.ts`

---

## US-SOFT-DELETE-002: Permanent Delete Record

**As a** developer,
**I want to** permanently delete records when required,
**so that** I can comply with data erasure requirements (GDPR right to be forgotten).

### API Request

```
DELETE /api/tables/1/records/123?permanent=true
```

### Configuration

```yaml
tables:
  - id: 1
    name: users
    permissions:
      delete: ['admin', 'member']
      # Permanent delete is controlled via the ?permanent=true query parameter
      # and requires admin role (enforced at the API level)
```

### Acceptance Criteria

| ID     | Criterion                                                    | E2E Spec                        | Status |
| ------ | ------------------------------------------------------------ | ------------------------------- | ------ |
| AC-001 | Permanently removes record from database with permanent=true | `API-TABLES-RECORDS-DELETE-008` | ✅     |
| AC-002 | Returns 403 when user lacks permanentDelete permission       | `API-TABLES-RECORDS-DELETE-009` | ✅     |
| AC-003 | Cascades permanent delete to related records if configured   | `API-TABLES-RECORDS-DELETE-010` | ✅     |
| AC-004 | Logs permanent delete operation to activity history          | `API-TABLES-RECORDS-DELETE-011` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/{recordId}/delete.spec.ts`

---

## US-SOFT-DELETE-003: Cascade Delete Behavior

**As a** developer,
**I want to** configure cascade delete behavior for relationships,
**so that** related records are handled appropriately when parent is deleted.

### Configuration

```yaml
tables:
  - id: 1
    name: orders
    fields:
      - id: 1
        name: customer_id
        type: relationship
        relatedTable: customers
        relationType: many-to-one
        onDelete: cascade # Delete orders when customer is deleted

  - id: 2
    name: order_items
    fields:
      - id: 1
        name: order_id
        type: relationship
        relatedTable: orders
        relationType: many-to-one
        onDelete: cascade # Delete items when order is deleted
```

### Acceptance Criteria

| ID     | Criterion                                                    | E2E Spec                        | Status |
| ------ | ------------------------------------------------------------ | ------------------------------- | ------ |
| AC-001 | Soft deletes cascade to child records with onDelete: cascade | `API-TABLES-RECORDS-DELETE-012` | ✅     |
| AC-002 | Sets foreign key to NULL with onDelete: set-null             | `API-TABLES-RECORDS-DELETE-013` | ✅     |
| AC-003 | Returns 400 when onDelete: restrict and children exist       | `API-TABLES-RECORDS-DELETE-014` | ✅     |
| AC-004 | Cascade operations are atomic (all or nothing)               | `API-TABLES-RECORDS-DELETE-015` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/{recordId}/delete.spec.ts`

---

## US-SOFT-DELETE-004: Restore Deleted Record

**As a** developer,
**I want to** restore soft-deleted records,
**so that** users can recover accidentally deleted data.

### API Request

```
POST /api/tables/1/records/123/restore
```

### Response

```json
{
  "id": 123,
  "deleted_at": null,
  "restored_at": "2025-01-15T11:00:00Z"
}
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                                | Status |
| ------ | ---------------------------------------------------- | --------------------------------------- | ------ |
| AC-001 | Returns 200 OK with restored record                  | `API-TABLES-RECORDS-RESTORE-001`        | ✅     |
| AC-002 | Clears deleted_at timestamp on record                | `API-TABLES-RECORDS-RESTORE-002`        | ✅     |
| AC-003 | Returns 404 Not Found for non-existent record        | `API-TABLES-RECORDS-RESTORE-003`        | ✅     |
| AC-004 | Returns 400 for record that is not deleted           | `API-TABLES-RECORDS-RESTORE-004`        | ✅     |
| AC-005 | Returns 401 when not authenticated                   | `API-TABLES-RECORDS-RESTORE-005`        | ✅     |
| AC-006 | Returns 403 when user lacks restore permission       | `API-TABLES-RECORDS-RESTORE-006`        | ✅     |
| AC-007 | Logs restore operation to activity history           | `API-TABLES-RECORDS-RESTORE-007`        | ✅     |
| AC-008 | Restores cascade-deleted child records               | `API-TABLES-RECORDS-RESTORE-008`        | ✅     |
| AC-009 | User can complete full restore workflow (regression) | `API-TABLES-RECORDS-RESTORE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/{recordId}/restore/post.spec.ts`

---

## US-SOFT-DELETE-005: Batch Restore Records

**As a** developer,
**I want to** restore multiple deleted records at once,
**so that** I can efficiently recover bulk-deleted data.

### API Request

```
POST /api/tables/1/records/batch/restore
Content-Type: application/json

{
  "ids": [123, 124, 125]
}
```

### Acceptance Criteria

| ID     | Criterion                                                  | E2E Spec                                      | Status |
| ------ | ---------------------------------------------------------- | --------------------------------------------- | ------ |
| AC-001 | Returns 200 OK with array of restored records              | `API-TABLES-RECORDS-BATCH-RESTORE-001`        | ✅     |
| AC-002 | Restores all specified records in single transaction       | `API-TABLES-RECORDS-BATCH-RESTORE-002`        | ⏳     |
| AC-003 | Returns 400 when any record ID is invalid                  | `API-TABLES-RECORDS-BATCH-RESTORE-003`        | ⏳     |
| AC-004 | Skips records that are not deleted                         |                                               |        |
| AC-005 | Returns partial success response with error details        |                                               |        |
| AC-006 | Returns 401 when not authenticated                         | `API-TABLES-RECORDS-BATCH-RESTORE-004`        | ✅     |
| AC-007 | Returns 403 when user lacks restore permission             | `API-TABLES-RECORDS-BATCH-RESTORE-005`        | ⏳     |
| AC-008 | Logs batch restore operation to activity history           | `API-TABLES-RECORDS-BATCH-RESTORE-009`        | ⏳     |
| AC-009 | User can complete full batch restore workflow (regression) | `API-TABLES-RECORDS-BATCH-RESTORE-REGRESSION` | ⏳     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/batch/restore/post.spec.ts`

---

## US-SOFT-DELETE-006: List Deleted Records (Trash)

**As a** developer,
**I want to** view soft-deleted records in a trash view,
**so that** users can browse and selectively restore deleted data.

### API Request

```
GET /api/tables/1/trash
```

### Response

```json
{
  "records": [
    {
      "id": 123,
      "name": "Deleted Item",
      "deleted_at": "2025-01-15T10:30:00Z",
      "deleted_by": { "id": 1, "name": "Alice" }
    }
  ],
  "total": 5
}
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                      | Status |
| ------ | -------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Returns 200 OK with array of soft-deleted records  | `API-TABLES-TRASH-001`        | ⏳     |
| AC-002 | Includes deleted_at timestamp and deleted_by user  | `API-TABLES-TRASH-002`        | ✅     |
| AC-003 | Supports pagination with limit and offset          | `API-TABLES-TRASH-003`        | ✅     |
| AC-004 | Returns 403 when user lacks trash view permission  | `API-TABLES-TRASH-004`        | ✅     |
| AC-005 | User can complete full trash workflow (regression) | `API-TABLES-TRASH-REGRESSION` | ⏳     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/trash/get.spec.ts`

---

## US-SOFT-DELETE-007: Include Deleted Records in Query

**As a** developer,
**I want to** optionally include deleted records in queries,
**so that** I can display historical data or audit trails.

### API Request

```
GET /api/tables/1/records?includeDeleted=true
GET /api/tables/1/records?includeDeleted=only
```

### Acceptance Criteria

| ID     | Criterion                                                    | E2E Spec                                        | Status |
| ------ | ------------------------------------------------------------ | ----------------------------------------------- | ------ |
| AC-001 | includeDeleted=true includes both active and deleted records | `API-TABLES-RECORDS-INCLUDE-DELETED-001`        | ✅     |
| AC-002 | includeDeleted=only returns only deleted records             | `API-TABLES-RECORDS-INCLUDE-DELETED-002`        | ✅     |
| AC-003 | Default behavior excludes deleted records                    | `API-TABLES-RECORDS-INCLUDE-DELETED-003`        | ✅     |
| AC-004 | Deleted records are marked with deleted_at in response       | `API-TABLES-RECORDS-INCLUDE-DELETED-004`        | ✅     |
| AC-005 | User can complete full include-deleted workflow (regression) | `API-TABLES-RECORDS-INCLUDE-DELETED-REGRESSION` | ⏳     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/include-deleted.spec.ts`

---

## Regression Tests

| Spec ID                                         | Workflow                                          | Status |
| ----------------------------------------------- | ------------------------------------------------- | ------ |
| `API-TABLES-RECORDS-DELETE-REGRESSION`          | User soft deletes and permanently deletes records | `[x]`  |
| `API-TABLES-RECORDS-RESTORE-REGRESSION`         | User restores deleted records                     | `[x]`  |
| `API-TABLES-TRASH-REGRESSION`                   | User views and manages trash                      | `[x]`  |
| `API-TABLES-RECORDS-INCLUDE-DELETED-REGRESSION` | User queries with includeDeleted flag             | `[x]`  |
| `API-TABLES-RECORDS-BATCH-RESTORE-REGRESSION`   | User batch restores deleted records               | `[x]`  |

---

## Coverage Summary

| User Story         | Title                        | Spec Count            | Status   |
| ------------------ | ---------------------------- | --------------------- | -------- |
| US-SOFT-DELETE-001 | Soft Delete Record           | 7                     | Complete |
| US-SOFT-DELETE-002 | Permanent Delete Record      | 4                     | Complete |
| US-SOFT-DELETE-003 | Cascade Delete Behavior      | 4                     | Complete |
| US-SOFT-DELETE-004 | Restore Deleted Record       | 9                     | Complete |
| US-SOFT-DELETE-005 | Batch Restore Records        | 9                     | Complete |
| US-SOFT-DELETE-006 | List Deleted Records (Trash) | 5                     | Complete |
| US-SOFT-DELETE-007 | Include Deleted in Query     | 5                     | Complete |
| **Total**          |                              | **47 + 5 regression** |          |
