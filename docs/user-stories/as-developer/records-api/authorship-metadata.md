# Authorship Metadata

> **Feature Area**: Records API - Authorship Tracking
> **Schema**: `src/domain/models/app/table/field-types/` (`created-by`, `updated-by`, `deleted-by`)
> **API Routes**: All Records CRUD endpoints (`POST`, `PATCH`, `DELETE`, `POST /restore`)
> **E2E Specs**: `specs/api/tables/{tableId}/records/authorship-metadata.spec.ts`

---

## Overview

Sovrium automatically tracks record authorship using three system field types: `created-by`, `updated-by`, and `deleted-by`. When these fields are configured on a table, the Records API auto-populates them from the authenticated user session during create, update, and delete operations. These fields are always read-only via the API -- users cannot manually set or override them.

**Relationship to field-type specs**: The field-type specs (`APP-TABLES-FIELD-TYPES-CREATED-BY-*`, etc.) validate DB-level schema behavior (column creation, FK constraints, triggers). This user story covers the **Records API behavior** -- how CRUD endpoints populate and expose these fields.

**Auth-conditional behavior**: When authentication is enabled, authorship fields are populated from the session user ID. When authentication is disabled (no auth strategy configured), authorship fields are `NULL`.

**API response structure**: Authorship fields (`createdBy`, `updatedBy`, `deletedBy`) are **system metadata** — they appear at the record root level alongside `createdAt`, `updatedAt`, and `deletedAt`, NOT inside the `fields` object. The `fields` object contains only user-defined field values.

---

## US-API-AUTHORSHIP-001: Created By on Record Creation

**As a** developer,
**I want to** have the `createdBy` field automatically set to the current user's ID when a record is created,
**so that** I can track who created each record without manual input.

### API Request

```json
POST /api/tables/1/records
{
  "fields": {
    "title": "New Task"
  }
}
```

### Response

```json
{
  "id": "1",
  "fields": {
    "title": "New Task"
  },
  "createdBy": "user-uuid-123",
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

### Acceptance Criteria

| ID     | Criterion                                                                                                                  | E2E Spec                            | Status |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------ | --- |
| AC-001 | createdBy is auto-set to current user ID on record creation                                                                | `API-TABLES-RECORDS-AUTHORSHIP-001` | ✅     |
| AC-002 | createdBy is included in the API response after creation                                                                   | `API-TABLES-RECORDS-AUTHORSHIP-002` | ✅     |
| AC-003 | createdBy is stored in the database with correct user ID                                                                   | `API-TABLES-RECORDS-AUTHORSHIP-003` | ✅     |
| AC-004 | ~~createdBy is NULL when no authentication is configured~~ (N/A: AppSchema now requires auth when using authorship fields) | N/A                                 | N/A    |     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/authorship-metadata.spec.ts`
- **Field Type Schema**: `src/domain/models/app/table/field-types/created-by-field.ts`

---

## US-API-AUTHORSHIP-002: Updated By on Record Update

**As a** developer,
**I want to** have the `updatedBy` field automatically set to the current user's ID when a record is updated,
**so that** I can track who last modified each record.

### API Request

```json
PATCH /api/tables/1/records/1
{
  "fields": {
    "title": "Updated Task Title"
  }
}
```

### Response

```json
{
  "id": "1",
  "fields": {
    "title": "Updated Task Title"
  },
  "createdBy": "user-uuid-123",
  "updatedBy": "user-uuid-456",
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T11:00:00Z"
}
```

### Acceptance Criteria

| ID     | Criterion                                                       | E2E Spec                            | Status |
| ------ | --------------------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | updatedBy is auto-set to current user ID on record update       | `API-TABLES-RECORDS-AUTHORSHIP-005` | ✅     |
| AC-002 | updatedBy reflects the updating user, not the original creator  | `API-TABLES-RECORDS-AUTHORSHIP-006` | ✅     |
| AC-003 | updatedBy is set to same value as createdBy on initial creation | `API-TABLES-RECORDS-AUTHORSHIP-007` | ✅     |
| AC-004 | updatedBy is included in the API response after update          | `API-TABLES-RECORDS-AUTHORSHIP-008` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/authorship-metadata.spec.ts`
- **Field Type Schema**: `src/domain/models/app/table/field-types/updated-by-field.ts`

---

## US-API-AUTHORSHIP-003: Deleted By on Soft Delete

**As a** developer,
**I want to** have the `deletedBy` field automatically set to the current user's ID when a record is soft-deleted,
**so that** I can track who deleted each record for audit purposes.

### API Request

```
DELETE /api/tables/1/records/1
```

### Database State After Deletion

```sql
SELECT deleted_by, deleted_at FROM tasks WHERE id = 1;
-- deleted_by: 'user-uuid-123', deleted_at: '2025-01-15T10:30:00Z'
```

### Acceptance Criteria

| ID     | Criterion                                                  | E2E Spec                            | Status |
| ------ | ---------------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | deletedBy is auto-set to current user ID on soft delete    | `API-TABLES-RECORDS-AUTHORSHIP-009` | ✅     |
| AC-002 | deletedBy is NULL for active (non-deleted) records         | `API-TABLES-RECORDS-AUTHORSHIP-010` | ✅     |
| AC-003 | deletedBy is cleared (set to NULL) when record is restored | `API-TABLES-RECORDS-AUTHORSHIP-011` | ✅     |
| AC-004 | deletedBy is included in trash listing response            | `API-TABLES-RECORDS-AUTHORSHIP-012` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/authorship-metadata.spec.ts`
- **Field Type Schema**: `src/domain/models/app/table/field-types/deleted-by-field.ts`

---

## US-API-AUTHORSHIP-004: Read-Only Enforcement

**As a** developer,
**I want to** ensure authorship fields are read-only via the API,
**so that** users cannot forge or tamper with audit trail data.

### API Request (Attempt to Override)

```json
POST /api/tables/1/records
{
  "fields": {
    "title": "New Task",
    "created_by": "fake-user-id"
  }
}
```

### Expected Behavior

The API silently ignores the `createdBy` value provided by the user and sets it from the authenticated session.

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                            | Status |
| ------ | --------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | API ignores user-provided createdBy value on create | `API-TABLES-RECORDS-AUTHORSHIP-013` | ✅     |
| AC-002 | API ignores user-provided updatedBy value on update | `API-TABLES-RECORDS-AUTHORSHIP-014` | ✅     |
| AC-003 | API ignores user-provided deletedBy value on delete | `API-TABLES-RECORDS-AUTHORSHIP-015` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/authorship-metadata.spec.ts`

---

## US-API-AUTHORSHIP-005: Multi-User Scenarios

**As a** developer,
**I want to** have authorship fields correctly reflect different users across operations,
**so that** the audit trail accurately represents who performed each action.

### Scenario

1. Alice creates a record -> `createdBy: Alice`, `updatedBy: Alice`
2. Bob updates the record -> `createdBy: Alice`, `updatedBy: Bob`
3. Charlie deletes the record -> `createdBy: Alice`, `updatedBy: Bob`, `deletedBy: Charlie`

### Acceptance Criteria

| ID     | Criterion                                                            | E2E Spec                            | Status |
| ------ | -------------------------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | Different users are tracked across create, update, delete operations | `API-TABLES-RECORDS-AUTHORSHIP-016` | ✅     |
| AC-002 | createdBy remains unchanged after update by different user           | `API-TABLES-RECORDS-AUTHORSHIP-017` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/authorship-metadata.spec.ts`

---

## US-API-AUTHORSHIP-006: Batch Operations

**As a** developer,
**I want to** have authorship fields correctly set during batch create, update, and delete operations,
**so that** bulk data modifications maintain accurate audit trails.

### Acceptance Criteria

| ID     | Criterion                                                      | E2E Spec                            | Status |
| ------ | -------------------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | Batch create sets createdBy on all records to the current user | `API-TABLES-RECORDS-AUTHORSHIP-018` | ✅     |
| AC-002 | Batch update sets updatedBy on all records to the current user | `API-TABLES-RECORDS-AUTHORSHIP-019` | ✅     |
| AC-003 | Batch delete sets deletedBy on all records to the current user | `API-TABLES-RECORDS-AUTHORSHIP-020` | ⏳     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/authorship-metadata.spec.ts`
- **Batch Operations**: `specs/api/tables/{tableId}/records/batch/`

---

## US-API-AUTHORSHIP-007: API Response Inclusion

**As a** developer,
**I want to** have authorship fields included in API responses for all record operations,
**so that** the client application can display authorship information.

### Acceptance Criteria

| ID     | Criterion                                                               | E2E Spec                                   | Status |
| ------ | ----------------------------------------------------------------------- | ------------------------------------------ | ------ |
| AC-001 | createdBy is included in GET single record response                     | `API-TABLES-RECORDS-AUTHORSHIP-021`        | ✅     |
| AC-002 | updatedBy is included in GET single record response                     | `API-TABLES-RECORDS-AUTHORSHIP-022`        | ✅     |
| AC-003 | Authorship fields are included in list records response for each record | `API-TABLES-RECORDS-AUTHORSHIP-023`        | ✅     |
| AC-004 | Full authorship lifecycle across CRUD operations (regression)           | `API-TABLES-RECORDS-AUTHORSHIP-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/authorship-metadata.spec.ts`

---

## Regression Tests

| Spec ID                                    | Workflow                                                  | Status |
| ------------------------------------------ | --------------------------------------------------------- | ------ |
| `API-TABLES-RECORDS-AUTHORSHIP-REGRESSION` | Full authorship metadata lifecycle across CRUD operations | `[ ]`  |

---

## Coverage Summary

| User Story            | Title                         | Spec Count | Status   |
| --------------------- | ----------------------------- | ---------- | -------- |
| US-API-AUTHORSHIP-001 | Created By on Record Creation | 3          | Complete |
| US-API-AUTHORSHIP-002 | Updated By on Record Update   | 4          | Complete |
| US-API-AUTHORSHIP-003 | Deleted By on Soft Delete     | 4          | Complete |
| US-API-AUTHORSHIP-004 | Read-Only Enforcement         | 3          | Complete |
| US-API-AUTHORSHIP-005 | Multi-User Scenarios          | 2          | Complete |
| US-API-AUTHORSHIP-006 | Batch Operations              | 3          | Complete |
| US-API-AUTHORSHIP-007 | API Response Inclusion        | 4          | Complete |
| **Total**             |                               | **23**     |          |
