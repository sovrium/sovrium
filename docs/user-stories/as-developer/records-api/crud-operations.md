# CRUD Operations

> **Feature Area**: Records API
> **Schema**: `src/domain/models/app/table/`
> **API Routes**: `POST /api/tables/:tableId/records`, `GET /api/tables/:tableId/records`, `GET /api/tables/:tableId/records/:recordId`, `PATCH /api/tables/:tableId/records/:recordId`, `DELETE /api/tables/:tableId/records/:recordId`

---

## US-RECORDS-CRUD-001: Create Record

**As a** developer,
**I want to** create new records in a table via API,
**so that** users can add data to my application.

### API Request

```json
POST /api/tables/1/records
{
  "fields": {
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

### Acceptance Criteria

| ID     | Criterion                                         | E2E Spec                               | Status |
| ------ | ------------------------------------------------- | -------------------------------------- | ------ |
| AC-001 | Returns 201 Created with record data              | `API-TABLES-RECORDS-CREATE-001`        | ✅     |
| AC-002 | Returns 404 Not Found for non-existent table      | `API-TABLES-RECORDS-CREATE-002`        | ✅     |
| AC-003 | Returns 400 when required field is missing        | `API-TABLES-RECORDS-CREATE-003`        | ✅     |
| AC-004 | Returns 400 for invalid field type value          | `API-TABLES-RECORDS-CREATE-004`        | ✅     |
| AC-005 | Returns 400 for unique constraint violation       | `API-TABLES-RECORDS-CREATE-005`        | ✅     |
| AC-006 | Returns 401 when not authenticated                | `API-TABLES-RECORDS-CREATE-006`        | ✅     |
| AC-007 | Returns 403 when user lacks create permission     | `API-TABLES-RECORDS-CREATE-007`        | ✅     |
| AC-008 | Auto-generates id for new record                  | `API-TABLES-RECORDS-CREATE-008`        | ✅     |
| AC-009 | Sets created_at and updated_at timestamps         | `API-TABLES-RECORDS-CREATE-009`        | ✅     |
| AC-010 | Applies default values for optional fields        | `API-TABLES-RECORDS-CREATE-010`        | ✅     |
| AC-011 | Validates email format for email fields           | `API-TABLES-RECORDS-CREATE-011`        | ✅     |
| AC-012 | Validates URL format for URL fields               |                                        | ⏳     |
| AC-013 | Validates number range for number fields          | `API-TABLES-RECORDS-CREATE-013`        | ✅     |
| AC-014 | Returns created record with all fields            | `API-TABLES-RECORDS-CREATE-014`        | ✅     |
| AC-015 | Supports creating record with relationship fields | `API-TABLES-RECORDS-CREATE-015`        | ✅     |
| AC-016 | User creates record with validation (regression)  | `API-TABLES-RECORDS-CREATE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/post.spec.ts`

---

## US-RECORDS-CRUD-002: List Records

**As a** developer,
**I want to** retrieve a list of records from a table,
**so that** users can view data in my application.

### API Request

```
GET /api/tables/1/records?limit=10&offset=0&sort=created_at:desc
```

### Acceptance Criteria

| ID     | Criterion                                                  | E2E Spec                             | Status |
| ------ | ---------------------------------------------------------- | ------------------------------------ | ------ |
| AC-001 | Returns 200 with array of records and pagination           | `API-TABLES-RECORDS-LIST-001`        | ✅     |
| AC-002 | Returns 404 Not Found for non-existent table               | `API-TABLES-RECORDS-LIST-002`        | ✅     |
| AC-003 | Returns 401 when not authenticated                         | `API-TABLES-RECORDS-LIST-003`        | ✅     |
| AC-004 | Returns 403 when user lacks read permission                | `API-TABLES-RECORDS-LIST-004`        | ✅     |
| AC-005 | Supports limit parameter for pagination                    | `API-TABLES-RECORDS-LIST-005`        | ✅     |
| AC-006 | Supports offset parameter for pagination                   | `API-TABLES-RECORDS-LIST-006`        | ✅     |
| AC-007 | Supports sort parameter (field:asc/desc)                   | `API-TABLES-RECORDS-LIST-007`        | ✅     |
| AC-008 | Supports filter parameter for field values                 | `API-TABLES-RECORDS-LIST-008`        | ✅     |
| AC-009 | Excludes soft-deleted records by default                   | `API-TABLES-RECORDS-LIST-009`        | ✅     |
| AC-010 | Returns pagination metadata (total, limit, offset)         | `API-TABLES-RECORDS-LIST-010`        | ✅     |
| AC-011 | Supports multiple sort fields                              | `API-TABLES-RECORDS-LIST-011`        | ✅     |
| AC-012 | Supports filtering by multiple fields                      | `API-TABLES-RECORDS-LIST-012`        | ✅     |
| AC-013 | Supports contains filter for text fields                   | `API-TABLES-RECORDS-LIST-013`        | ✅     |
| AC-014 | Supports greater than/less than for numbers                | `API-TABLES-RECORDS-LIST-014`        | ✅     |
| AC-015 | Supports date range filtering                              | `API-TABLES-RECORDS-LIST-015`        | ✅     |
| AC-016 | Only returns fields user has read permission for           | `API-TABLES-RECORDS-LIST-016`        | ✅     |
| AC-017 | Supports select parameter to choose fields                 | `API-TABLES-RECORDS-LIST-017`        | ✅     |
| AC-018 | Returns empty array when no records match                  | `API-TABLES-RECORDS-LIST-018`        | ✅     |
| AC-019 | Default limit is 20 records                                | `API-TABLES-RECORDS-LIST-019`        | ✅     |
| AC-020 | Maximum limit is 100 records                               | `API-TABLES-RECORDS-LIST-020`        | ✅     |
| AC-021 | Supports OR filter logic                                   | `API-TABLES-RECORDS-LIST-021`        | ✅     |
| AC-022 | Supports AND filter logic                                  | `API-TABLES-RECORDS-LIST-022`        | ✅     |
| AC-023 | Supports nested filter conditions                          | `API-TABLES-RECORDS-LIST-023`        | ✅     |
| AC-024 | Returns records ordered by creation date by default        | `API-TABLES-RECORDS-LIST-024`        | ✅     |
| AC-025 | Supports cursor-based pagination                           | `API-TABLES-RECORDS-LIST-025`        | ✅     |
| AC-026 | User lists records with filtering and sorting (regression) | `API-TABLES-RECORDS-LIST-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/get.spec.ts`

---

## US-RECORDS-CRUD-003: Get Single Record

**As a** developer,
**I want to** retrieve a single record by ID,
**so that** users can view detailed data for a specific item.

### API Request

```
GET /api/tables/1/records/42
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                            | Status |
| ------ | ----------------------------------------------------- | ----------------------------------- | ------ |
| AC-001 | Returns 200 OK with record data                       | `API-TABLES-RECORDS-GET-001`        | ✅     |
| AC-002 | Returns 404 Not Found for non-existent record         | `API-TABLES-RECORDS-GET-002`        | ✅     |
| AC-003 | Returns 404 Not Found for non-existent table          | `API-TABLES-RECORDS-GET-003`        | ✅     |
| AC-004 | Returns 401 when not authenticated                    | `API-TABLES-RECORDS-GET-004`        | ✅     |
| AC-005 | Returns 403 when user lacks read permission           | `API-TABLES-RECORDS-GET-005`        | ✅     |
| AC-006 | Returns 404 for soft-deleted records (by default)     | `API-TABLES-RECORDS-GET-006`        | ✅     |
| AC-007 | Includes all fields user has read permission for      | `API-TABLES-RECORDS-GET-007`        | ✅     |
| AC-008 | Includes record metadata (id, created_at, updated_at) | `API-TABLES-RECORDS-GET-008`        | ✅     |
| AC-009 | Supports expand parameter for relationship fields     | `API-TABLES-RECORDS-GET-009`        | ✅     |
| AC-010 | Returns relationship data when expanded               | `API-TABLES-RECORDS-GET-010`        | ✅     |
| AC-011 | User retrieves single record (regression)             | `API-TABLES-RECORDS-GET-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/{recordId}/get.spec.ts`

---

## US-RECORDS-CRUD-004: Update Record

**As a** developer,
**I want to** update existing records via API,
**so that** users can modify data in my application.

### API Request

```json
PATCH /api/tables/1/records/42
{
  "fields": {
    "first_name": "Jonathan",
    "last_name": "Smith"
  }
}
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                               | Status |
| ------ | -------------------------------------------------- | -------------------------------------- | ------ |
| AC-001 | Returns 200 OK with updated record                 | `API-TABLES-RECORDS-UPDATE-001`        | ✅     |
| AC-002 | Returns 404 Not Found for non-existent record      | `API-TABLES-RECORDS-UPDATE-002`        | ✅     |
| AC-003 | Returns 404 Not Found for non-existent table       | `API-TABLES-RECORDS-UPDATE-003`        | ✅     |
| AC-004 | Returns 400 for invalid field type value           | `API-TABLES-RECORDS-UPDATE-004`        | ✅     |
| AC-005 | Returns 400 for unique constraint violation        | `API-TABLES-RECORDS-UPDATE-005`        | ✅     |
| AC-006 | Returns 401 when not authenticated                 | `API-TABLES-RECORDS-UPDATE-006`        | ✅     |
| AC-007 | Returns 403 when user lacks update permission      | `API-TABLES-RECORDS-UPDATE-007`        | ✅     |
| AC-008 | Only updates provided fields (partial update)      | `API-TABLES-RECORDS-UPDATE-008`        | ✅     |
| AC-009 | Updates updated_at timestamp                       | `API-TABLES-RECORDS-UPDATE-009`        | ✅     |
| AC-010 | Cannot update read-only fields (created_at, id)    | `API-TABLES-RECORDS-UPDATE-010`        | ✅     |
| AC-011 | Validates updated values against field constraints | `API-TABLES-RECORDS-UPDATE-011`        | ✅     |
| AC-012 | Returns 404 for soft-deleted records               | `API-TABLES-RECORDS-UPDATE-012`        | ✅     |
| AC-013 | Creates activity log entry for record update       | `API-TABLES-RECORDS-UPDATE-013`        | ✅     |
| AC-014 | Only logs fields that actually changed             | `API-TABLES-RECORDS-UPDATE-014`        | ✅     |
| AC-015 | Captures user who performed the update             | `API-TABLES-RECORDS-UPDATE-015`        | ✅     |
| AC-016 | User updates record with validation (regression)   | `API-TABLES-RECORDS-UPDATE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/{recordId}/patch.spec.ts`

---

## US-RECORDS-CRUD-005: Delete Record

**As a** developer,
**I want to** delete records via API,
**so that** users can remove data from my application.

### API Request

```
DELETE /api/tables/1/records/42
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                               | Status |
| ------ | ------------------------------------------------------- | -------------------------------------- | ------ |
| AC-001 | Returns 204 No Content and soft deletes record          | `API-TABLES-RECORDS-DELETE-001`        | ✅     |
| AC-002 | Returns 404 Not Found for non-existent record           | `API-TABLES-RECORDS-DELETE-002`        | ✅     |
| AC-003 | Returns 404 Not Found for non-existent table            | `API-TABLES-RECORDS-DELETE-003`        | ✅     |
| AC-004 | Returns 401 when not authenticated                      | `API-TABLES-RECORDS-DELETE-004`        | ✅     |
| AC-005 | Returns 403 when user lacks delete permission           | `API-TABLES-RECORDS-DELETE-005`        | ✅     |
| AC-006 | Soft delete sets deleted_at timestamp                   | `API-TABLES-RECORDS-DELETE-006`        | ✅     |
| AC-007 | Soft-deleted record is excluded from list queries       | `API-TABLES-RECORDS-DELETE-007`        | ✅     |
| AC-008 | Soft-deleted record returns 404 on direct access        | `API-TABLES-RECORDS-DELETE-008`        | ✅     |
| AC-009 | Permanent delete removes record completely (admin only) | `API-TABLES-RECORDS-DELETE-009`        | ✅     |
| AC-010 | Returns 404 for already soft-deleted record             | `API-TABLES-RECORDS-DELETE-010`        | ✅     |
| AC-011 | Cascades delete to related records (if configured)      | `API-TABLES-RECORDS-DELETE-011`        | ✅     |
| AC-012 | Sets deleted_by field (if available)                    | `API-TABLES-RECORDS-DELETE-012`        | ✅     |
| AC-013 | Supports ?permanent=true for hard delete                | `API-TABLES-RECORDS-DELETE-013`        | ✅     |
| AC-014 | Permanent delete requires admin role                    | `API-TABLES-RECORDS-DELETE-014`        | ✅     |
| AC-015 | Returns 403 for permanent delete without admin role     | `API-TABLES-RECORDS-DELETE-015`        | ✅     |
| AC-016 | User soft-deletes and restores record (regression)      | `API-TABLES-RECORDS-DELETE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/{recordId}/delete.spec.ts`

---

## Regression Tests

| Spec ID                                | Workflow                                      | Status |
| -------------------------------------- | --------------------------------------------- | ------ |
| `API-TABLES-RECORDS-CREATE-REGRESSION` | User creates record with validation           | `[x]`  |
| `API-TABLES-RECORDS-LIST-REGRESSION`   | User lists records with filtering and sorting | `[x]`  |
| `API-TABLES-RECORDS-GET-REGRESSION`    | User retrieves single record                  | `[x]`  |
| `API-TABLES-RECORDS-UPDATE-REGRESSION` | User updates record with validation           | `[x]`  |
| `API-TABLES-RECORDS-DELETE-REGRESSION` | User soft-deletes and restores record         | `[x]`  |

---

## Coverage Summary

| User Story          | Title             | Spec Count            | Status   |
| ------------------- | ----------------- | --------------------- | -------- |
| US-RECORDS-CRUD-001 | Create Record     | 15                    | Complete |
| US-RECORDS-CRUD-002 | List Records      | 25                    | Complete |
| US-RECORDS-CRUD-003 | Get Single Record | 10                    | Complete |
| US-RECORDS-CRUD-004 | Update Record     | 16                    | Complete |
| US-RECORDS-CRUD-005 | Delete Record     | 16                    | Complete |
| **Total**           |                   | **82 + 5 regression** |          |
