# Upsert Records

> **Feature Area**: Records API - Create or Update
> **Schema**: `src/domain/models/app/table/`
> **API Routes**: `POST /api/tables/:tableId/records/upsert`
> **E2E Specs**: `specs/api/tables/{tableId}/records/upsert/post.spec.ts`

---

## Overview

Sovrium supports upsert (insert or update) operations for records. When a record with matching unique field values exists, it's updated; otherwise, a new record is created. This enables idempotent operations and simplifies sync workflows.

---

## US-RECORDS-UPSERT-001: Upsert Single Record

**As a** developer,
**I want to** upsert records based on unique field values,
**so that** I can create or update records in a single API call.

### API Request

```json
POST /api/tables/1/records/upsert
{
  "fields": {
    "email": "john@example.com",
    "name": "John Doe",
    "status": "active"
  },
  "matchFields": ["email"]
}
```

### Response (Created)

```json
{
  "id": 123,
  "operation": "created",
  "record": {
    "id": 123,
    "email": "john@example.com",
    "name": "John Doe",
    "status": "active"
  }
}
```

### Response (Updated)

```json
{
  "id": 123,
  "operation": "updated",
  "record": {
    "id": 123,
    "email": "john@example.com",
    "name": "John Doe",
    "status": "active"
  }
}
```

### Acceptance Criteria

| ID     | Criterion                                                 | E2E Spec                               | Status |
| ------ | --------------------------------------------------------- | -------------------------------------- | ------ |
| AC-001 | Returns 200 OK with created record when no match found    | `API-TABLES-RECORDS-UPSERT-001`        | ✅     |
| AC-002 | Returns 200 OK with updated record when match found       | `API-TABLES-RECORDS-UPSERT-002`        | ✅     |
| AC-003 | Returns 404 Not Found for non-existent table              | `API-TABLES-RECORDS-UPSERT-003`        | ✅     |
| AC-004 | Returns 401 when not authenticated                        | `API-TABLES-RECORDS-UPSERT-004`        | ✅     |
| AC-005 | Returns 403 when user lacks create permission             | `API-TABLES-RECORDS-UPSERT-005`        | ✅     |
| AC-006 | Returns 403 when user lacks update permission (on update) | `API-TABLES-RECORDS-UPSERT-006`        | ✅     |
| AC-007 | Returns 400 when matchFields is empty                     | `API-TABLES-RECORDS-UPSERT-007`        | ✅     |
| AC-008 | Returns 400 when matchFields contains invalid field name  | `API-TABLES-RECORDS-UPSERT-008`        | ✅     |
| AC-009 | Returns 400 when required field is missing                | `API-TABLES-RECORDS-UPSERT-009`        | ✅     |
| AC-010 | Returns 400 for invalid field type value                  | `API-TABLES-RECORDS-UPSERT-010`        | ⏳     |
| AC-011 | Filters protected fields from upsert (id, created_at)     | `API-TABLES-RECORDS-UPSERT-011`        | ⏳     |
| AC-012 | Returns 200 OK with operation type in response            | `API-TABLES-RECORDS-UPSERT-012`        | ✅     |
| AC-013 | Enforces constraints during upsert operation              | `API-TABLES-RECORDS-UPSERT-013`        | ⏳     |
| AC-014 | User can complete full upsert workflow (regression)       | `API-TABLES-RECORDS-UPSERT-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/presentation/api/routes/records.ts`
- **E2E Spec**: `specs/api/tables/{tableId}/records/upsert/post.spec.ts`

---

## Regression Tests

| Spec ID                                | Workflow                      | Status |
| -------------------------------------- | ----------------------------- | ------ |
| `API-TABLES-RECORDS-UPSERT-REGRESSION` | User performs upsert workflow | `[x]`  |

---

## Coverage Summary

| User Story            | Title                | Spec Count            | Status   |
| --------------------- | -------------------- | --------------------- | -------- |
| US-RECORDS-UPSERT-001 | Upsert Single Record | 14                    | Complete |
| **Total**             |                      | **14 + 1 regression** |          |
