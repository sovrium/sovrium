# API Specification

> REST API endpoints for tables, records, views, activity, and health

## Overview

The API provides RESTful endpoints for interacting with Sovrium applications. All endpoints follow consistent patterns for authentication, error handling, pagination, and response formats.

**Vision Alignment**: The API enables Sovrium's data-driven applications to be accessed programmatically, supporting both internal UI needs and external integrations.

## Base Configuration

**Base Path**: `/api`
**Content-Type**: `application/json`
**Authentication**: Session-based via Better Auth (see [Auth](./auth.md))

---

## Response Formats

### Success Response

```json
{
  "data": { ... }
}
```

### List Response (with Pagination)

```json
{
  "records": [...],
  "pagination": {
    "total": 100,
    "limit": 10,
    "offset": 0
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### HTTP Status Codes

| Code  | Description           | When Used                        |
| ----- | --------------------- | -------------------------------- |
| `200` | OK                    | Successful GET, PATCH            |
| `201` | Created               | Successful POST                  |
| `204` | No Content            | Successful DELETE                |
| `400` | Bad Request           | Invalid input, validation errors |
| `401` | Unauthorized          | Missing or invalid session       |
| `403` | Forbidden             | Insufficient permissions         |
| `404` | Not Found             | Resource doesn't exist           |
| `429` | Too Many Requests     | Rate limit exceeded              |
| `500` | Internal Server Error | Server-side errors               |

---

## Health API

**Purpose**: Application health monitoring for load balancers and uptime checks.

### GET /api/health

Returns application health status.

**Authentication**: None required

**Response**:

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "app": {
    "name": "my-sovrium-app"
  }
}
```

| Field       | Type     | Description                  |
| ----------- | -------- | ---------------------------- |
| `status`    | `'ok'`   | Health status indicator      |
| `timestamp` | `string` | ISO 8601 timestamp           |
| `app.name`  | `string` | Application name from schema |

---

## Tables API

**Base Path**: `/api/tables`

### GET /api/tables

Lists all tables the authenticated user has permission to view.

**Authentication**: Required

**Response**:

```json
{
  "tables": [
    { "id": "tasks", "name": "Tasks" },
    { "id": "projects", "name": "Projects" }
  ]
}
```

**Permission Filtering**:

- Returns only tables where user has `read` permission
- Admin users see all tables
- Regular users see tables based on role assignments

### GET /api/tables/{tableId}

Returns table metadata including fields and configuration.

**Authentication**: Required

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tableId` | `string` | Yes | Table identifier |

**Response**:

```json
{
  "id": "tasks",
  "name": "Tasks",
  "fields": [
    {
      "name": "title",
      "type": "single-line-text",
      "required": true
    },
    {
      "name": "status",
      "type": "single-select",
      "options": ["todo", "in-progress", "done"]
    }
  ]
}
```

**Error Responses**:

- `401`: Not authenticated
- `403`: No read permission on table
- `404`: Table not found

---

## Records API

**Base Path**: `/api/tables/{tableId}/records`

### GET /api/tables/{tableId}/records

Lists records from a table with filtering, sorting, and pagination.

**Authentication**: Required

**Query Parameters**:

| Parameter         | Type      | Default | Description                                      |
| ----------------- | --------- | ------- | ------------------------------------------------ |
| `limit`           | `number`  | `100`   | Records per page (max 1000)                      |
| `offset`          | `number`  | `0`     | Pagination offset                                |
| `filter`          | `object`  | -       | JSON filter object                               |
| `filterByFormula` | `string`  | -       | Airtable-style formula                           |
| `sort`            | `array`   | -       | Sort configuration                               |
| `fields`          | `array`   | -       | Field projection (returns only specified fields) |
| `view`            | `string`  | -       | Apply view's filters and sorts                   |
| `groupBy`         | `string`  | -       | Group results by field                           |
| `aggregate`       | `object`  | -       | Aggregation operations                           |
| `includeDeleted`  | `boolean` | `false` | Include soft-deleted records                     |

**Filter Object**:

```json
{
  "field": "status",
  "operator": "equals",
  "value": "active"
}
```

**Filter Operators**:
| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | `{ "field": "status", "operator": "equals", "value": "active" }` |
| `not_equals` | Not equal | `{ "field": "status", "operator": "not_equals", "value": "archived" }` |
| `contains` | String contains | `{ "field": "title", "operator": "contains", "value": "urgent" }` |
| `starts_with` | String starts with | `{ "field": "name", "operator": "starts_with", "value": "A" }` |
| `ends_with` | String ends with | `{ "field": "email", "operator": "ends_with", "value": "@example.com" }` |
| `gt` | Greater than | `{ "field": "price", "operator": "gt", "value": 100 }` |
| `gte` | Greater than or equal | `{ "field": "age", "operator": "gte", "value": 18 }` |
| `lt` | Less than | `{ "field": "stock", "operator": "lt", "value": 10 }` |
| `lte` | Less than or equal | `{ "field": "priority", "operator": "lte", "value": 5 }` |
| `is_empty` | Field is empty/null | `{ "field": "notes", "operator": "is_empty" }` |
| `is_not_empty` | Field has value | `{ "field": "assignee", "operator": "is_not_empty" }` |
| `in` | Value in array | `{ "field": "status", "operator": "in", "value": ["active", "pending"] }` |

**Filter by Formula** (Airtable-style):

```
?filterByFormula=AND({status}='active', {priority}>3)
```

**Sort Configuration**:

```json
[
  { "field": "created_at", "direction": "desc" },
  { "field": "title", "direction": "asc" }
]
```

**Field Projection**:

```
?fields=id,title,status
```

Returns only specified fields (plus `id` always included).

**Response**:

```json
{
  "records": [
    {
      "id": "rec_123",
      "title": "Fix bug",
      "status": "in-progress",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 100,
    "offset": 0
  }
}
```

**Aggregation Response** (when `aggregate` is provided):

```json
{
  "aggregations": {
    "count": 150,
    "sum": { "price": 15000 },
    "avg": { "rating": 4.5 }
  }
}
```

**Permission Enforcement**:

- Users can only see records they have permission to view
- Field-level permissions filter returned fields
- 403 returned when filtering/sorting on inaccessible fields

### GET /api/tables/{tableId}/records/{recordId}

Returns a single record by ID.

**Authentication**: Required

**Response**:

```json
{
  "id": "rec_123",
  "title": "Fix bug",
  "status": "in-progress",
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T11:00:00Z"
}
```

**Error Responses**:

- `401`: Not authenticated
- `403`: No read permission
- `404`: Record not found (or soft-deleted without `includeDeleted`)

### POST /api/tables/{tableId}/records

Creates a new record.

**Authentication**: Required

**Request Body**:

```json
{
  "fields": {
    "title": "New task",
    "status": "todo",
    "priority": 3
  }
}
```

**Response** (`201 Created`):

```json
{
  "id": "rec_456",
  "title": "New task",
  "status": "todo",
  "priority": 3,
  "created_at": "2025-01-15T12:00:00Z",
  "created_by": "user_789"
}
```

**Validation**:

- Required fields must be provided
- Field types are validated against schema
- Unique constraints are enforced

### PATCH /api/tables/{tableId}/records/{recordId}

Updates an existing record.

**Authentication**: Required

**Request Body**:

```json
{
  "fields": {
    "status": "done",
    "completed_at": "2025-01-15T14:00:00Z"
  }
}
```

**Response**:

```json
{
  "id": "rec_123",
  "title": "Fix bug",
  "status": "done",
  "completed_at": "2025-01-15T14:00:00Z",
  "updated_at": "2025-01-15T14:00:00Z",
  "updated_by": "user_789"
}
```

### DELETE /api/tables/{tableId}/records/{recordId}

Soft-deletes a record (sets `deleted_at` timestamp).

**Authentication**: Required

**Response**: `204 No Content`

**Behavior**:

- Record is soft-deleted (not permanently removed)
- `deleted_at` timestamp is set
- `deleted_by` is set to current user
- Record excluded from default queries
- Use `includeDeleted=true` to retrieve

### POST /api/tables/{tableId}/records/{recordId}/restore

Restores a soft-deleted record.

**Authentication**: Required

**Response**:

```json
{
  "id": "rec_123",
  "title": "Fix bug",
  "deleted_at": null
}
```

### DELETE /api/tables/{tableId}/records/{recordId}/permanent

Permanently deletes a record (admin only).

**Authentication**: Required (admin role)

**Response**: `204 No Content`

---

## Batch Operations

### POST /api/tables/{tableId}/records/batch

Performs batch operations (create, update, delete) on multiple records.

**Authentication**: Required

**Request Body**:

```json
{
  "operations": [
    {
      "method": "create",
      "fields": { "title": "Task 1" }
    },
    {
      "method": "update",
      "id": "rec_123",
      "fields": { "status": "done" }
    },
    {
      "method": "delete",
      "id": "rec_456"
    }
  ]
}
```

**Response**:

```json
{
  "results": [
    { "success": true, "id": "rec_789" },
    { "success": true, "id": "rec_123" },
    { "success": true, "id": "rec_456" }
  ],
  "summary": {
    "total": 3,
    "succeeded": 3,
    "failed": 0
  }
}
```

**Limits**:

- Maximum 100 operations per batch
- Operations are processed transactionally

---

## Views API

**Base Path**: `/api/tables/{tableId}/views`

### GET /api/tables/{tableId}/views

Lists all views for a table.

**Authentication**: Required

**Response**:

```json
{
  "views": [
    {
      "id": "view_active",
      "name": "Active Tasks",
      "type": "grid"
    },
    {
      "id": "view_calendar",
      "name": "Calendar",
      "type": "calendar"
    }
  ]
}
```

### GET /api/tables/{tableId}/views/{viewId}

Returns view configuration.

**Authentication**: Required

**Response**:

```json
{
  "id": "view_active",
  "name": "Active Tasks",
  "type": "grid",
  "fields": ["title", "status", "due_date"],
  "filters": [{ "field": "status", "operator": "not_equals", "value": "done" }],
  "sorts": [{ "field": "due_date", "direction": "asc" }],
  "groupBy": "status"
}
```

### GET /api/tables/{tableId}/views/{viewId}/records

Returns records using view's filters, sorts, and field selection.

**Authentication**: Required

**Response**: Same as `GET /api/tables/{tableId}/records` but with view configuration applied.

---

## Comments API

**Base Path**: `/api/tables/{tableId}/records/{recordId}/comments`

### GET /api/tables/{tableId}/records/{recordId}/comments

Lists comments on a record.

**Authentication**: Required

**Response**:

```json
{
  "comments": [
    {
      "id": "cmt_123",
      "content": "This looks good!",
      "author": {
        "id": "user_456",
        "name": "Alice"
      },
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### POST /api/tables/{tableId}/records/{recordId}/comments

Creates a comment on a record.

**Authentication**: Required

**Request Body**:

```json
{
  "content": "Great progress on this task!"
}
```

**Response** (`201 Created`):

```json
{
  "id": "cmt_789",
  "content": "Great progress on this task!",
  "author": {
    "id": "user_456",
    "name": "Alice"
  },
  "created_at": "2025-01-15T12:00:00Z"
}
```

### DELETE /api/tables/{tableId}/records/{recordId}/comments/{commentId}

Deletes a comment (author or admin only).

**Authentication**: Required

**Response**: `204 No Content`

---

## Activity API

**Base Path**: `/api/activity`

### GET /api/activity

Returns activity/audit log entries.

**Authentication**: Required (admin only)

**Query Parameters**:

| Parameter   | Type     | Default | Description           |
| ----------- | -------- | ------- | --------------------- |
| `tableName` | `string` | -       | Filter by table       |
| `action`    | `string` | -       | Filter by action type |
| `userId`    | `string` | -       | Filter by user        |
| `startDate` | `string` | -       | Start date (ISO 8601) |
| `endDate`   | `string` | -       | End date (ISO 8601)   |
| `page`      | `number` | `1`     | Page number           |
| `pageSize`  | `number` | `50`    | Items per page        |

**Action Types**:

- `create` - Record created
- `update` - Record updated
- `delete` - Record deleted
- `restore` - Record restored
- `permanent_delete` - Record permanently deleted

**Response**:

```json
{
  "activities": [
    {
      "id": "act_123",
      "action": "update",
      "tableName": "tasks",
      "recordId": "rec_456",
      "user": {
        "id": "user_789",
        "name": "Alice"
      },
      "changes": {
        "status": { "from": "todo", "to": "done" }
      },
      "timestamp": "2025-01-15T14:00:00Z"
    }
  ],
  "pagination": {
    "total": 500,
    "page": 1,
    "pageSize": 50,
    "totalPages": 10
  }
}
```

### GET /api/activity/{activityId}

Returns a single activity entry.

**Authentication**: Required (admin only)

**Response**:

```json
{
  "id": "act_123",
  "action": "update",
  "tableName": "tasks",
  "recordId": "rec_456",
  "user": {
    "id": "user_789",
    "name": "Alice"
  },
  "changes": {
    "status": { "from": "todo", "to": "done" }
  },
  "timestamp": "2025-01-15T14:00:00Z"
}
```

---

## Trash API

**Base Path**: `/api/tables/{tableId}/trash`

### GET /api/tables/{tableId}/trash

Lists soft-deleted records.

**Authentication**: Required

**Query Parameters**: Same as records list (limit, offset, filter, sort)

**Response**:

```json
{
  "records": [
    {
      "id": "rec_123",
      "title": "Deleted task",
      "deleted_at": "2025-01-15T10:00:00Z",
      "deleted_by": "user_456"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 100,
    "offset": 0
  }
}
```

### DELETE /api/tables/{tableId}/trash

Empties trash (permanently deletes all soft-deleted records).

**Authentication**: Required (admin only)

**Response**: `204 No Content`

---

## Rate Limiting

API requests are rate-limited to prevent abuse.

| Endpoint Category | Limit | Window   |
| ----------------- | ----- | -------- |
| Read operations   | 1000  | 1 minute |
| Write operations  | 100   | 1 minute |
| Batch operations  | 10    | 1 minute |

**Rate Limit Headers**:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1705319460
```

**Exceeded Response** (`429 Too Many Requests`):

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 30
  }
}
```

---

## E2E Test Coverage

| Category           | Spec Files | Tests | Status   |
| ------------------ | ---------- | ----- | -------- |
| Health             | 1          | ~1    | 🟢 100%  |
| Tables List        | 1          | ~6    | 🟢 100%  |
| Table Details      | 1          | ~5    | 🟢 100%  |
| Records CRUD       | 4          | ~40   | 🟢 100%  |
| Records Filtering  | 2          | ~25   | 🟢 100%  |
| Records Sorting    | 1          | ~8    | 🟢 100%  |
| Records Pagination | 1          | ~6    | 🟢 100%  |
| Batch Operations   | 1          | ~10   | 🟢 100%  |
| Views              | 3          | ~15   | 🟢 100%  |
| Comments           | 3          | ~10   | 🟢 100%  |
| Trash              | 2          | ~8    | 🟢 100%  |
| Activity           | 4          | ~19   | 🟡 fixme |
| Rate Limiting      | 1          | ~5    | 🟡 fixme |

**Total**: 25 spec files, ~158 tests (excluding auth endpoints)

---

## Implementation Status

**Overall**: 🟡 85%

| Component        | Status | Notes                               |
| ---------------- | ------ | ----------------------------------- |
| Health API       | ✅     | Complete                            |
| Tables API       | ✅     | CRUD + permissions                  |
| Records API      | ✅     | Full filtering, sorting, pagination |
| Batch Operations | ✅     | Create, update, delete              |
| Views API        | ✅     | List, get, records                  |
| Comments API     | ✅     | CRUD operations                     |
| Trash API        | ✅     | List, restore, empty                |
| Activity API     | 🟡     | Core features, some tests as fixme  |
| Rate Limiting    | 🟡     | Basic implementation                |

---

## Use Cases

### Example 1: Fetching Paginated Records

```bash
GET /api/tables/tasks/records?limit=10&offset=0&sort=[{"field":"created_at","direction":"desc"}]
```

### Example 2: Filtering by Status

```bash
GET /api/tables/tasks/records?filter={"field":"status","operator":"equals","value":"active"}
```

### Example 3: Complex Formula Filter

```bash
GET /api/tables/tasks/records?filterByFormula=AND({status}='active',{priority}>3,{assignee}!='')
```

### Example 4: Field Projection

```bash
GET /api/tables/tasks/records?fields=id,title,status
```

### Example 5: View-Based Query

```bash
GET /api/tables/tasks/views/active-tasks/records
```

### Example 6: Batch Update

```bash
POST /api/tables/tasks/records/batch
{
  "operations": [
    { "method": "update", "id": "rec_1", "fields": { "status": "done" } },
    { "method": "update", "id": "rec_2", "fields": { "status": "done" } },
    { "method": "update", "id": "rec_3", "fields": { "status": "done" } }
  ]
}
```

### Example 7: Activity Log Query

```bash
GET /api/activity?tableName=tasks&action=update&startDate=2025-01-01&page=1&pageSize=50
```

---

## Related Features

- [Tables](./tables.md) - Table schema definitions
- [Auth](./auth.md) - Authentication endpoints
- [Migrations](./migrations.md) - Schema evolution

## Related Documentation

- [Hono RPC](../infrastructure/api/hono-rpc-openapi.md) - API framework
- [Zod OpenAPI](../infrastructure/api/zod-hono-openapi.md) - Schema validation
- [Authorization Patterns](../architecture/patterns/authorization-overview.md) - Permission system
