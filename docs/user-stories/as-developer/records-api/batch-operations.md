# Batch Operations

> **Feature Area**: Records API
> **Schema**: `src/domain/models/app/table/`
> **API Routes**: `POST /api/tables/:tableId/records/batch`, `PATCH /api/tables/:tableId/records/batch`, `DELETE /api/tables/:tableId/records/batch`

---

## US-RECORDS-BATCH-001: Batch Create Records

**As a** developer,
**I want to** create multiple records in a single API call,
**so that** I can efficiently import or create bulk data.

### API Request

```json
POST /api/tables/1/records/batch
{
  "records": [
    { "fields": { "email": "john@example.com", "name": "John" } },
    { "fields": { "email": "jane@example.com", "name": "Jane" } },
    { "fields": { "email": "bob@example.com", "name": "Bob" } }
  ],
  "returnRecords": true
}
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                                   | Status |
| ------ | ------------------------------------------------------- | ------------------------------------------ | ------ |
| AC-001 | Returns 201 with created count and records array        | `API-TABLES-RECORDS-BATCH-POST-001`        | ✅     |
| AC-002 | Returns 404 Not Found for non-existent table            | `API-TABLES-RECORDS-BATCH-POST-002`        | ✅     |
| AC-003 | Returns 400 when records array is empty                 | `API-TABLES-RECORDS-BATCH-POST-003`        | ✅     |
| AC-004 | Returns 400 when records array exceeds limit            | `API-TABLES-RECORDS-BATCH-POST-004`        | ✅     |
| AC-005 | Returns 401 when not authenticated                      | `API-TABLES-RECORDS-BATCH-POST-005`        | ✅     |
| AC-006 | Returns 403 when user lacks create permission           | `API-TABLES-RECORDS-BATCH-POST-006`        | ✅     |
| AC-007 | Validates each record against schema                    | `API-TABLES-RECORDS-BATCH-POST-007`        | ✅     |
| AC-008 | Returns partial success with errors array               | `API-TABLES-RECORDS-BATCH-POST-008`        | ✅     |
| AC-009 | Supports transaction mode (all-or-nothing)              | `API-TABLES-RECORDS-BATCH-POST-009`        | ✅     |
| AC-010 | Returns created records when returnRecords=true         | `API-TABLES-RECORDS-BATCH-POST-010`        | ⏳     |
| AC-011 | Returns only count when returnRecords=false             | `API-TABLES-RECORDS-BATCH-POST-011`        | ⏳     |
| AC-012 | Maximum batch size is 100 records                       | `API-TABLES-RECORDS-BATCH-POST-012`        | ⏳     |
| AC-013 | Rolls back all on validation error in transaction mode  | `API-TABLES-RECORDS-BATCH-POST-013`        | ⏳     |
| AC-014 | User batch creates records with validation (regression) | `API-TABLES-RECORDS-BATCH-POST-REGRESSION` | ⏳     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/batch/post.spec.ts`

---

## US-RECORDS-BATCH-002: Batch Update Records

**As a** developer,
**I want to** update multiple records in a single API call,
**so that** I can efficiently modify bulk data.

### API Request

```json
PATCH /api/tables/1/records/batch
{
  "records": [
    { "id": 1, "fields": { "status": "active" } },
    { "id": 2, "fields": { "status": "active" } },
    { "id": 3, "fields": { "status": "inactive" } }
  ],
  "returnRecords": true
}
```

### Acceptance Criteria

| ID     | Criterion                                         | E2E Spec                                    | Status |
| ------ | ------------------------------------------------- | ------------------------------------------- | ------ |
| AC-001 | Returns 200 with updated count and records array  | `API-TABLES-RECORDS-BATCH-PATCH-001`        | ✅     |
| AC-002 | Returns 404 Not Found for non-existent table      | `API-TABLES-RECORDS-BATCH-PATCH-002`        | ✅     |
| AC-003 | Returns 400 when records array is empty           | `API-TABLES-RECORDS-BATCH-PATCH-003`        | ✅     |
| AC-004 | Returns 400 when record ID is missing             | `API-TABLES-RECORDS-BATCH-PATCH-004`        | ✅     |
| AC-005 | Returns 401 when not authenticated                | `API-TABLES-RECORDS-BATCH-PATCH-005`        | ✅     |
| AC-006 | Returns 403 when user lacks update permission     | `API-TABLES-RECORDS-BATCH-PATCH-006`        | ✅     |
| AC-007 | Validates each record against schema              | `API-TABLES-RECORDS-BATCH-PATCH-007`        | ✅     |
| AC-008 | Skips non-existent records with error in response | `API-TABLES-RECORDS-BATCH-PATCH-008`        | ✅     |
| AC-009 | Supports transaction mode (all-or-nothing)        | `API-TABLES-RECORDS-BATCH-PATCH-009`        | ✅     |
| AC-010 | Updates updated_at timestamp for each record      | `API-TABLES-RECORDS-BATCH-PATCH-010`        | ✅     |
| AC-011 | Maximum batch size is 100 records                 | `API-TABLES-RECORDS-BATCH-PATCH-011`        | ⏳     |
| AC-012 | Updates records with proper data types            | `API-TABLES-RECORDS-BATCH-PATCH-012`        | ⏳     |
| AC-013 | Excludes deleted records from update              | `API-TABLES-RECORDS-BATCH-PATCH-013`        | ⏳     |
| AC-014 | User batch updates records (regression)           | `API-TABLES-RECORDS-BATCH-PATCH-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/batch/patch.spec.ts`

---

## US-RECORDS-BATCH-003: Batch Delete Records

**As a** developer,
**I want to** delete multiple records in a single API call,
**so that** I can efficiently remove bulk data.

### API Request

```json
DELETE /api/tables/1/records/batch
{
  "ids": [1, 2, 3],
  "permanent": false
}
```

### Acceptance Criteria

| ID     | Criterion                                                                               | E2E Spec                                     | Status |
| ------ | --------------------------------------------------------------------------------------- | -------------------------------------------- | ------ |
| AC-001 | Returns 200 with deleted count                                                          | `API-TABLES-RECORDS-BATCH-DELETE-001`        | ✅     |
| AC-002 | Returns 404 Not Found for non-existent table                                            | `API-TABLES-RECORDS-BATCH-DELETE-002`        | ✅     |
| AC-003 | Returns 400 when ids array is empty                                                     | `API-TABLES-RECORDS-BATCH-DELETE-003`        | ✅     |
| AC-004 | Returns 401 when not authenticated                                                      | `API-TABLES-RECORDS-BATCH-DELETE-004`        | ✅     |
| AC-005 | Returns 403 when user lacks delete permission                                           | `API-TABLES-RECORDS-BATCH-DELETE-005`        | ✅     |
| AC-006 | Soft deletes records by default                                                         | `API-TABLES-RECORDS-BATCH-DELETE-006`        | ✅     |
| AC-007 | Skips non-existent record IDs                                                           | `API-TABLES-RECORDS-BATCH-DELETE-007`        | ✅     |
| AC-008 | Supports permanent=true for hard delete                                                 | `API-TABLES-RECORDS-BATCH-DELETE-008`        | ✅     |
| AC-009 | Permanent delete requires admin role                                                    | `API-TABLES-RECORDS-BATCH-DELETE-009`        | ✅     |
| AC-010 | Maximum batch size is 100 records                                                       | `API-TABLES-RECORDS-BATCH-DELETE-010`        | ✅     |
| AC-011 | Batch delete skips already soft-deleted records and returns count of newly deleted only |                                              |        |
| AC-012 | Admin permanent delete with permanent=true hard deletes records                         |                                              |        |
| AC-013 | User batch soft-deletes records (regression)                                            | `API-TABLES-RECORDS-BATCH-DELETE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/batch/delete.spec.ts`

---

## US-RECORDS-BATCH-004: Batch Restore Records

**As a** developer,
**I want to** restore multiple soft-deleted records in a single API call,
**so that** I can efficiently recover bulk data.

### API Request

```json
POST /api/tables/1/records/batch/restore
{
  "ids": [1, 2, 3]
}
```

### Acceptance Criteria

| ID     | Criterion                                        | E2E Spec                                      | Status |
| ------ | ------------------------------------------------ | --------------------------------------------- | ------ |
| AC-001 | Returns 200 with restored count                  | `API-TABLES-RECORDS-BATCH-RESTORE-001`        | ✅     |
| AC-002 | Returns 404 Not Found for non-existent table     | `API-TABLES-RECORDS-BATCH-RESTORE-002`        | ⏳     |
| AC-003 | Returns 400 when ids array is empty              | `API-TABLES-RECORDS-BATCH-RESTORE-003`        | ⏳     |
| AC-004 | Returns 401 when not authenticated               | `API-TABLES-RECORDS-BATCH-RESTORE-004`        | ✅     |
| AC-005 | Returns 403 when user lacks restore permission   | `API-TABLES-RECORDS-BATCH-RESTORE-005`        | ⏳     |
| AC-006 | Clears deleted_at timestamp for restored records | `API-TABLES-RECORDS-BATCH-RESTORE-006`        | ⏳     |
| AC-007 | Skips records that are not soft-deleted          | `API-TABLES-RECORDS-BATCH-RESTORE-007`        | ⏳     |
| AC-008 | Maximum batch size is 100 records                | `API-TABLES-RECORDS-BATCH-RESTORE-008`        | ⏳     |
| AC-009 | User batch restores records (regression)         | `API-TABLES-RECORDS-BATCH-RESTORE-REGRESSION` | ⏳     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/batch/restore/post.spec.ts`

---

## US-RECORDS-BATCH-005: Upsert Records

**As a** developer,
**I want to** create or update records based on unique field values,
**so that** I can efficiently synchronize data from external sources.

### API Request

```json
POST /api/tables/1/records/upsert
{
  "records": [
    { "fields": { "email": "john@example.com", "name": "John Updated" } },
    { "fields": { "email": "new@example.com", "name": "New User" } }
  ],
  "matchFields": ["email"]
}
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                        | Status |
| ------ | ------------------------------------------------------- | ------------------------------- | ------ |
| AC-001 | Creates new record when no match found                  | `API-TABLES-RECORDS-UPSERT-001` | ✅     |
| AC-002 | Updates existing record when match found                | `API-TABLES-RECORDS-UPSERT-002` | ✅     |
| AC-003 | Returns 400 when matchFields is empty                   | `API-TABLES-RECORDS-UPSERT-003` | ✅     |
| AC-004 | Returns 400 when matchFields not in schema              | `API-TABLES-RECORDS-UPSERT-004` | ✅     |
| AC-005 | Returns 401 when not authenticated                      | `API-TABLES-RECORDS-UPSERT-005` | ✅     |
| AC-006 | Returns 403 when user lacks create or update permission | `API-TABLES-RECORDS-UPSERT-006` | ✅     |
| AC-007 | Supports multiple matchFields for composite matching    | `API-TABLES-RECORDS-UPSERT-007` | ✅     |
| AC-008 | Returns counts of created and updated records           | `API-TABLES-RECORDS-UPSERT-008` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/upsert/post.spec.ts`

---

## Regression Tests

| Spec ID                                       | Workflow                                   | Status |
| --------------------------------------------- | ------------------------------------------ | ------ |
| `API-TABLES-RECORDS-BATCH-POST-REGRESSION`    | User batch creates records with validation | `[x]`  |
| `API-TABLES-RECORDS-BATCH-PATCH-REGRESSION`   | User batch updates records                 | `[x]`  |
| `API-TABLES-RECORDS-BATCH-DELETE-REGRESSION`  | User batch soft-deletes records            | `[x]`  |
| `API-TABLES-RECORDS-BATCH-RESTORE-REGRESSION` | User batch restores records                | `[x]`  |
| `API-TABLES-RECORDS-UPSERT-REGRESSION`        | User upserts records with matching         | `[x]`  |

---

## Coverage Summary

| User Story           | Title                 | Spec Count            | Status   |
| -------------------- | --------------------- | --------------------- | -------- |
| US-RECORDS-BATCH-001 | Batch Create Records  | 13                    | Complete |
| US-RECORDS-BATCH-002 | Batch Update Records  | 11                    | Complete |
| US-RECORDS-BATCH-003 | Batch Delete Records  | 13                    | Complete |
| US-RECORDS-BATCH-004 | Batch Restore Records | 8                     | Complete |
| US-RECORDS-BATCH-005 | Upsert Records        | 8                     | Complete |
| **Total**            |                       | **53 + 5 regression** |          |
