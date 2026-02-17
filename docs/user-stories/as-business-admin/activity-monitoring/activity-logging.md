# Activity Logging API

> **Feature Area**: Activity API - System-wide Activity Tracking
> **Schema**: `src/domain/models/app/activity/`
> **API Routes**: `GET /api/activity`, `GET /api/activity/:activityId`
> **E2E Specs**: `specs/api/activity/`

---

## Overview

Sovrium provides a system-wide activity logging API that tracks all user and system actions across the application. This includes record CRUD operations, authentication events, and administrative actions. The activity log supports filtering, pagination, and retention policies.

---

## US-API-ACTIVITY-001: List Activity Logs

**As a** business admin,
**I want to** retrieve a paginated list of activity logs,
**so that** I can monitor system activity and audit user actions.

### API Request

```
GET /api/activity?page=1&pageSize=20&table=orders&action=update
```

### Response

```json
{
  "activities": [
    {
      "id": "act_123",
      "action": "update",
      "table": "orders",
      "recordId": 456,
      "changes": {
        "status": { "from": "pending", "to": "approved" }
      },
      "user": { "id": 1, "name": "Alice", "email": "alice@example.com" },
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 20
}
```

### Query Parameters

| Parameter  | Type   | Description                                          |
| ---------- | ------ | ---------------------------------------------------- |
| `page`     | number | Page number (default: 1)                             |
| `pageSize` | number | Items per page (default: 20, max: 100)               |
| `table`    | string | Filter by table name                                 |
| `action`   | string | Filter by action type (create/update/delete/restore) |
| `userId`   | number | Filter by user ID (admin only for other users)       |
| `from`     | string | Filter by date range start (ISO 8601)                |
| `to`       | string | Filter by date range end (ISO 8601)                  |

### Acceptance Criteria

| ID     | Criterion                                                   | E2E Spec                       | Status |
| ------ | ----------------------------------------------------------- | ------------------------------ | ------ |
| AC-001 | Returns 200 OK with paginated activity logs                 | `API-ACTIVITY-LIST-001`        | ✅     |
| AC-002 | Returns 401 when user is not authenticated                  | `API-ACTIVITY-LIST-002`        | ✅     |
| AC-003 | Returns activities filtered by table name                   | `API-ACTIVITY-LIST-003`        | ✅     |
| AC-004 | Returns activities filtered by action type                  | `API-ACTIVITY-LIST-004`        | ✅     |
| AC-005 | Returns activities filtered by user ID                      | `API-ACTIVITY-LIST-005`        | ✅     |
| AC-006 | Returns activities filtered by date range                   | `API-ACTIVITY-LIST-006`        | ✅     |
| AC-007 | Returns activities sorted by creation date descending       | `API-ACTIVITY-LIST-007`        | ✅     |
| AC-008 | Supports pagination with page and pageSize parameters       | `API-ACTIVITY-LIST-008`        | ✅     |
| AC-009 | Returns empty array when no activities exist                | `API-ACTIVITY-LIST-009`        | ✅     |
| AC-010 | Returns 400 when page parameter is invalid                  | `API-ACTIVITY-LIST-010`        | ✅     |
| AC-011 | Returns 400 when pageSize exceeds maximum                   | `API-ACTIVITY-LIST-011`        | ✅     |
| AC-012 | Includes user metadata in activity logs                     | `API-ACTIVITY-LIST-012`        | ✅     |
| AC-013 | Excludes activities older than 1 year (retention policy)    | `API-ACTIVITY-LIST-013`        | ⏳     |
| AC-014 | Returns 400 when action filter has invalid value            | `API-ACTIVITY-LIST-014`        | ⏳     |
| AC-015 | Returns 401 Unauthorized when auth is not configured        | `API-ACTIVITY-LIST-015`        | ✅     |
| AC-016 | Includes null user metadata for system-logged activities    | `API-ACTIVITY-LIST-016`        | ⏳     |
| AC-017 | Allows non-admin user to filter by their own userId         | `API-ACTIVITY-LIST-017`        | ⏳     |
| AC-018 | Returns 403 when non-admin filters by another user's userId | `API-ACTIVITY-LIST-018`        | ⏳     |
| AC-019 | Allows admin to filter by any userId                        | `API-ACTIVITY-LIST-019`        | ⏳     |
| AC-020 | User can retrieve and filter activity logs (regression)     | `API-ACTIVITY-LIST-REGRESSION` | ⏳     |

### Implementation References

- **Schema**: `src/presentation/api/routes/activity.ts`
- **E2E Spec**: `specs/api/activity/get.spec.ts`

---

## US-API-ACTIVITY-002: Get Activity Details

**As a** business admin,
**I want to** retrieve details of a specific activity log entry,
**so that** I can view the full context of an action.

### API Request

```
GET /api/activity/act_123
```

### Response

```json
{
  "id": "act_123",
  "action": "update",
  "table": "orders",
  "recordId": 456,
  "changes": {
    "status": { "from": "pending", "to": "approved" },
    "amount": { "from": 100.0, "to": 150.0 }
  },
  "user": { "id": 1, "name": "Alice", "email": "alice@example.com" },
  "timestamp": "2025-01-15T10:30:00Z",
  "metadata": {
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

### Acceptance Criteria

| ID     | Criterion                                                   | E2E Spec                          | Status |
| ------ | ----------------------------------------------------------- | --------------------------------- | ------ |
| AC-001 | Returns 200 OK with activity details                        | `API-ACTIVITY-DETAILS-001`        | ✅     |
| AC-002 | Returns 401 when user is not authenticated                  | `API-ACTIVITY-DETAILS-002`        | ✅     |
| AC-003 | Returns 404 when activity does not exist                    | `API-ACTIVITY-DETAILS-003`        | ✅     |
| AC-004 | Includes user metadata in activity details                  | `API-ACTIVITY-DETAILS-004`        | ✅     |
| AC-005 | Returns activity with null changes for delete action        | `API-ACTIVITY-DETAILS-005`        | ✅     |
| AC-006 | Returns 400 when activityId is invalid format               | `API-ACTIVITY-DETAILS-006`        | ✅     |
| AC-007 | Returns 401 Unauthorized when auth is not configured        | `API-ACTIVITY-DETAILS-007`        | ✅     |
| AC-008 | User retrieves specific activity with metadata (regression) | `API-ACTIVITY-DETAILS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/presentation/api/routes/activity.ts`
- **E2E Spec**: `specs/api/activity/{activityId}/get.spec.ts`

---

## US-API-ACTIVITY-003: Activity API Rate Limiting

**As a** business admin,
**I want to** have rate limiting on activity API endpoints,
**so that** the system is protected from abuse and excessive API calls.

### Configuration

```yaml
api:
  rateLimit:
    activity:
      list:
        requests: 100
        window: 60 # seconds
      detail:
        requests: 200
        window: 60 # seconds
```

### Acceptance Criteria

| ID     | Criterion                                                  | E2E Spec                       | Status |
| ------ | ---------------------------------------------------------- | ------------------------------ | ------ |
| AC-001 | Returns 429 after exceeding list activity rate limit       | `API-ACTIVITY-RATE-001`        | ✅     |
| AC-002 | Returns 429 after exceeding activity detail rate limit     | `API-ACTIVITY-RATE-002`        | ✅     |
| AC-003 | Resets activity rate limit after window expires            | `API-ACTIVITY-RATE-003`        | ✅     |
| AC-004 | Includes Retry-After header in 429 response                | `API-ACTIVITY-RATE-004`        | ✅     |
| AC-005 | Rate limits by IP address, not by authenticated user       | `API-ACTIVITY-RATE-005`        | ✅     |
| AC-006 | Applies rate limit to filtered activity queries equally    | `API-ACTIVITY-RATE-006`        | ✅     |
| AC-007 | Rate limiting protects activity API endpoints (regression) | `API-ACTIVITY-RATE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/activity/rate-limiting.spec.ts`

---

## Regression Tests

| Spec ID                           | Workflow                                       | Status |
| --------------------------------- | ---------------------------------------------- | ------ |
| `API-ACTIVITY-LIST-REGRESSION`    | User retrieves and filters activity logs       | ⏳     |
| `API-ACTIVITY-DETAILS-REGRESSION` | User retrieves specific activity with metadata | ⏳     |
| `API-ACTIVITY-RATE-REGRESSION`    | Rate limiting protects activity API endpoints  | ⏳     |

---

## Coverage Summary

| User Story          | Title                   | Spec Count            | Status      |
| ------------------- | ----------------------- | --------------------- | ----------- |
| US-API-ACTIVITY-001 | List Activity Logs      | 19                    | Not Started |
| US-API-ACTIVITY-002 | Get Activity Details    | 7                     | Not Started |
| US-API-ACTIVITY-003 | Activity API Rate Limit | 6                     | Not Started |
| **Total**           |                         | **32 + 3 regression** |             |
