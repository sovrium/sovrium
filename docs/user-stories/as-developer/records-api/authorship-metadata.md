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

---

## US-API-AUTHORSHIP-001: Created By on Record Creation

**As a** developer,
**I want** the `created_by` field to be automatically set to the current user's ID when a record is created,
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
  "id": 1,
  "fields": {
    "title": "New Task",
    "created_by": "user-uuid-123"
  },
  "created_at": "2025-01-15T10:30:00Z"
}
```

### Acceptance Criteria

| ID     | Criterion                                                        | E2E Spec                                 | Status |
| ------ | ---------------------------------------------------------------- | ---------------------------------------- | ------ |
| AC-001 | created_by is auto-set to current user ID on record creation     | `API-TABLES-RECORDS-AUTHORSHIP-001`      | ⏳     |
| AC-002 | created_by is included in the API response after creation        | `API-TABLES-RECORDS-AUTHORSHIP-002`      | ⏳     |
| AC-003 | created_by is stored in the database with correct user ID        | `API-TABLES-RECORDS-AUTHORSHIP-003`      | ⏳     |
| AC-004 | created_by is NULL when no authentication is configured          | `API-TABLES-RECORDS-AUTHORSHIP-004`      | ⏳     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/authorship-metadata.spec.ts`
- **Field Type Schema**: `src/domain/models/app/table/field-types/created-by-field.ts`

---

## US-API-AUTHORSHIP-002: Updated By on Record Update

**As a** developer,
**I want** the `updated_by` field to be automatically set to the current user's ID when a record is updated,
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
  "id": 1,
  "fields": {
    "title": "Updated Task Title",
    "created_by": "user-uuid-123",
    "updated_by": "user-uuid-456"
  },
  "updated_at": "2025-01-15T11:00:00Z"
}
```

### Acceptance Criteria

| ID     | Criterion                                                          | E2E Spec                                 | Status |
| ------ | ------------------------------------------------------------------ | ---------------------------------------- | ------ |
| AC-001 | updated_by is auto-set to current user ID on record update         | `API-TABLES-RECORDS-AUTHORSHIP-005`      | ⏳     |
| AC-002 | updated_by reflects the updating user, not the original creator    | `API-TABLES-RECORDS-AUTHORSHIP-006`      | ⏳     |
| AC-003 | updated_by is set to same value as created_by on initial creation  | `API-TABLES-RECORDS-AUTHORSHIP-007`      | ⏳     |
| AC-004 | updated_by is included in the API response after update            | `API-TABLES-RECORDS-AUTHORSHIP-008`      | ⏳     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/authorship-metadata.spec.ts`
- **Field Type Schema**: `src/domain/models/app/table/field-types/updated-by-field.ts`

---

## US-API-AUTHORSHIP-003: Deleted By on Soft Delete

**As a** developer,
**I want** the `deleted_by` field to be automatically set to the current user's ID when a record is soft-deleted,
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

| ID     | Criterion                                                        | E2E Spec                                 | Status |
| ------ | ---------------------------------------------------------------- | ---------------------------------------- | ------ |
| AC-001 | deleted_by is auto-set to current user ID on soft delete         | `API-TABLES-RECORDS-AUTHORSHIP-009`      | ⏳     |
| AC-002 | deleted_by is NULL for active (non-deleted) records              | `API-TABLES-RECORDS-AUTHORSHIP-010`      | ⏳     |
| AC-003 | deleted_by is cleared (set to NULL) when record is restored      | `API-TABLES-RECORDS-AUTHORSHIP-011`      | ⏳     |
| AC-004 | deleted_by is included in trash listing response                 | `API-TABLES-RECORDS-AUTHORSHIP-012`      | ⏳     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/authorship-metadata.spec.ts`
- **Field Type Schema**: `src/domain/models/app/table/field-types/deleted-by-field.ts`

---

## US-API-AUTHORSHIP-004: Read-Only Enforcement

**As a** developer,
**I want** authorship fields to be read-only via the API,
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

The API silently ignores the `created_by` value provided by the user and sets it from the authenticated session.

### Acceptance Criteria

| ID     | Criterion                                                             | E2E Spec                                 | Status |
| ------ | --------------------------------------------------------------------- | ---------------------------------------- | ------ |
| AC-001 | API ignores user-provided created_by value on create                  | `API-TABLES-RECORDS-AUTHORSHIP-013`      | ⏳     |
| AC-002 | API ignores user-provided updated_by value on update                  | `API-TABLES-RECORDS-AUTHORSHIP-014`      | ⏳     |
| AC-003 | API ignores user-provided deleted_by value on delete                  | `API-TABLES-RECORDS-AUTHORSHIP-015`      | ⏳     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/authorship-metadata.spec.ts`

---

## US-API-AUTHORSHIP-005: Multi-User Scenarios

**As a** developer,
**I want** authorship fields to correctly reflect different users across operations,
**so that** the audit trail accurately represents who performed each action.

### Scenario

1. Alice creates a record -> `created_by: Alice`, `updated_by: Alice`
2. Bob updates the record -> `created_by: Alice`, `updated_by: Bob`
3. Charlie deletes the record -> `created_by: Alice`, `updated_by: Bob`, `deleted_by: Charlie`

### Acceptance Criteria

| ID     | Criterion                                                                      | E2E Spec                                 | Status |
| ------ | ------------------------------------------------------------------------------ | ---------------------------------------- | ------ |
| AC-001 | Different users are tracked across create, update, delete operations           | `API-TABLES-RECORDS-AUTHORSHIP-016`      | ⏳     |
| AC-002 | created_by remains unchanged after update by different user                    | `API-TABLES-RECORDS-AUTHORSHIP-017`      | ⏳     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/authorship-metadata.spec.ts`

---

## US-API-AUTHORSHIP-006: Batch Operations

**As a** developer,
**I want** authorship fields to be correctly set during batch create, update, and delete operations,
**so that** bulk data modifications maintain accurate audit trails.

### Acceptance Criteria

| ID     | Criterion                                                                  | E2E Spec                                 | Status |
| ------ | -------------------------------------------------------------------------- | ---------------------------------------- | ------ |
| AC-001 | Batch create sets created_by on all records to the current user            | `API-TABLES-RECORDS-AUTHORSHIP-018`      | ⏳     |
| AC-002 | Batch update sets updated_by on all records to the current user            | `API-TABLES-RECORDS-AUTHORSHIP-019`      | ⏳     |
| AC-003 | Batch delete sets deleted_by on all records to the current user            | `API-TABLES-RECORDS-AUTHORSHIP-020`      | ⏳     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/authorship-metadata.spec.ts`
- **Batch Operations**: `specs/api/tables/{tableId}/records/batch/`

---

## US-API-AUTHORSHIP-007: API Response Inclusion

**As a** developer,
**I want** authorship fields to be included in API responses for all record operations,
**so that** the client application can display authorship information.

### Acceptance Criteria

| ID     | Criterion                                                                       | E2E Spec                                 | Status |
| ------ | ------------------------------------------------------------------------------- | ---------------------------------------- | ------ |
| AC-001 | created_by is included in GET single record response                            | `API-TABLES-RECORDS-AUTHORSHIP-021`      | ⏳     |
| AC-002 | updated_by is included in GET single record response                            | `API-TABLES-RECORDS-AUTHORSHIP-022`      | ⏳     |
| AC-003 | Authorship fields are included in list records response for each record         | `API-TABLES-RECORDS-AUTHORSHIP-023`      | ⏳     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/authorship-metadata.spec.ts`

---

## Regression Tests

| Spec ID                                        | Workflow                                                  | Status |
| ---------------------------------------------- | --------------------------------------------------------- | ------ |
| `API-TABLES-RECORDS-AUTHORSHIP-REGRESSION`     | Full authorship metadata lifecycle across CRUD operations | `[x]`  |

---

## Coverage Summary

| User Story             | Title                           | Spec Count | Status   |
| ---------------------- | ------------------------------- | ---------- | -------- |
| US-API-AUTHORSHIP-001  | Created By on Record Creation   | 4          | Complete |
| US-API-AUTHORSHIP-002  | Updated By on Record Update     | 4          | Complete |
| US-API-AUTHORSHIP-003  | Deleted By on Soft Delete       | 4          | Complete |
| US-API-AUTHORSHIP-004  | Read-Only Enforcement           | 3          | Complete |
| US-API-AUTHORSHIP-005  | Multi-User Scenarios            | 2          | Complete |
| US-API-AUTHORSHIP-006  | Batch Operations                | 3          | Complete |
| US-API-AUTHORSHIP-007  | API Response Inclusion          | 3          | Complete |
| **Total**              |                                 | **23 + 1 regression** |  |
