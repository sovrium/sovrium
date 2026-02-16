# Record History & Comments

> **Feature Area**: Records API - Activity Tracking
> **Schema**: `src/domain/models/app/table/`
> **API Routes**: `GET /api/tables/:tableId/records/:recordId/history`, `*/comments/*`
> **E2E Specs**: `specs/api/tables/{tableId}/records/{recordId}/`

---

## Overview

Sovrium tracks all record changes through an activity log and supports a comments system for collaboration. History entries capture field-level changes, user attribution, and timestamps. Comments support @mentions for notifications.

---

## US-API-RECORD-HISTORY-001: View Record History

**As a** developer,
**I want to** retrieve the change history of a record,
**so that** users can see who changed what and when.

### API Request

```
GET /api/tables/1/records/123/history
```

### Response

```json
{
  "history": [
    {
      "id": 1,
      "action": "update",
      "changes": {
        "status": { "from": "pending", "to": "approved" }
      },
      "user": { "id": 1, "name": "Alice" },
      "timestamp": "2025-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "action": "create",
      "changes": null,
      "user": { "id": 2, "name": "Bob" },
      "timestamp": "2025-01-14T09:00:00Z"
    }
  ],
  "total": 2
}
```

### Configuration

> **Note**: History tracking configuration is not yet available in the current schema. History is tracked automatically by the system for all tables. Retention policies and field tracking options will be configurable in a future schema version.

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                                 | Status |
| ------ | ------------------------------------------------------ | ---------------------------------------- | ------ |
| AC-001 | Returns 200 OK with chronological history entries      | `API-ACTIVITY-RECORD-HISTORY-001`        | ✅     |
| AC-002 | Includes action type (create, update, delete, restore) | `API-ACTIVITY-RECORD-HISTORY-002`        | ✅     |
| AC-003 | Includes user who performed the action                 | `API-ACTIVITY-RECORD-HISTORY-003`        | ✅     |
| AC-004 | Includes field-level change details for updates        | `API-ACTIVITY-RECORD-HISTORY-004`        | ⏳     |
| AC-005 | Returns 404 Not Found for non-existent record          | `API-ACTIVITY-RECORD-HISTORY-005`        | ⏳     |
| AC-006 | Returns 401 when not authenticated                     | `API-ACTIVITY-RECORD-HISTORY-006`        | ⏳     |
| AC-007 | Returns 403 when user lacks history view permission    | `API-ACTIVITY-RECORD-HISTORY-007`        | ⏳     |
| AC-008 | Respects retention policy (excludes expired entries)   | `API-ACTIVITY-RECORD-HISTORY-008`        | ⏳     |
| AC-009 | Supports pagination with limit and offset              | `API-ACTIVITY-RECORD-HISTORY-009`        | ⏳     |
| AC-010 | Orders entries by timestamp descending (newest first)  | `API-ACTIVITY-RECORD-HISTORY-010`        | ✅     |
| AC-011 | User views record change history (regression)          | `API-ACTIVITY-RECORD-HISTORY-REGRESSION` | ⏳     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/{recordId}/history/get.spec.ts`

---

## US-API-RECORD-HISTORY-002: List Record Comments

**As a** developer,
**I want to** retrieve comments on a record,
**so that** users can see the discussion thread.

### API Request

```
GET /api/tables/1/records/123/comments
```

### Response

```json
{
  "comments": [
    {
      "id": 1,
      "content": "Great progress on this task! @bob please review.",
      "mentions": [{ "userId": 2, "username": "bob", "position": 31 }],
      "author": { "id": 1, "name": "Alice" },
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": null
    }
  ],
  "total": 1
}
```

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                                      | Status |
| ------ | ------------------------------------------------------ | --------------------------------------------- | ------ |
| AC-001 | Returns 200 OK with array of comments                  | `API-TABLES-RECORDS-COMMENTS-LIST-001`        | ✅     |
| AC-002 | Returns 200 OK with empty array when no comments       | `API-TABLES-RECORDS-COMMENTS-LIST-002`        | ✅     |
| AC-003 | Includes author information for each comment           | `API-TABLES-RECORDS-COMMENTS-LIST-003`        | ✅     |
| AC-004 | Includes @mention metadata (user, position)            | `API-TABLES-RECORDS-COMMENTS-LIST-004`        | ✅     |
| AC-005 | Returns 404 Not Found for non-existent record          | `API-TABLES-RECORDS-COMMENTS-LIST-005`        | ✅     |
| AC-006 | Returns 401 when not authenticated                     | `API-TABLES-RECORDS-COMMENTS-LIST-006`        | ✅     |
| AC-007 | Returns 403 when user lacks comments view permission   | `API-TABLES-RECORDS-COMMENTS-LIST-007`        | ✅     |
| AC-008 | Supports pagination with limit and offset              | `API-TABLES-RECORDS-COMMENTS-LIST-008`        | ✅     |
| AC-009 | Orders comments by created_at ascending (oldest first) | `API-TABLES-RECORDS-COMMENTS-LIST-009`        | ✅     |
| AC-010 | Includes updated_at if comment was edited              | `API-TABLES-RECORDS-COMMENTS-LIST-010`        | ✅     |
| AC-011 | User lists comments on a record (regression)           | `API-TABLES-RECORDS-COMMENTS-LIST-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/{recordId}/comments/get.spec.ts`

---

## US-API-RECORD-HISTORY-003: Create Comment

**As a** developer,
**I want to** add comments to records,
**so that** users can collaborate and discuss data.

### API Request

```
POST /api/tables/1/records/123/comments
Content-Type: application/json

{
  "content": "This looks good! @alice can you confirm the numbers?"
}
```

### Response

```json
{
  "id": 2,
  "content": "This looks good! @alice can you confirm the numbers?",
  "mentions": [{ "userId": 1, "username": "alice", "position": 21 }],
  "author": { "id": 2, "name": "Bob" },
  "created_at": "2025-01-15T11:00:00Z"
}
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                                        | Status |
| ------ | ----------------------------------------------------- | ----------------------------------------------- | ------ |
| AC-001 | Returns 201 Created with new comment                  | `API-TABLES-RECORDS-COMMENTS-CREATE-001`        | ✅     |
| AC-002 | Auto-injects current user as author                   | `API-TABLES-RECORDS-COMMENTS-CREATE-002`        | ✅     |
| AC-003 | Parses @mentions from content and stores metadata     | `API-TABLES-RECORDS-COMMENTS-CREATE-003`        | ✅     |
| AC-004 | Returns 400 when content is empty                     | `API-TABLES-RECORDS-COMMENTS-CREATE-004`        | ✅     |
| AC-005 | Returns 400 when content exceeds max length           | `API-TABLES-RECORDS-COMMENTS-CREATE-005`        | ✅     |
| AC-006 | Returns 404 Not Found for non-existent record         | `API-TABLES-RECORDS-COMMENTS-CREATE-006`        | ✅     |
| AC-007 | Returns 401 when not authenticated                    | `API-TABLES-RECORDS-COMMENTS-CREATE-007`        | ✅     |
| AC-008 | Returns 403 when user lacks comment create permission | `API-TABLES-RECORDS-COMMENTS-CREATE-008`        | ✅     |
| AC-009 | Triggers notification for @mentioned users            | `API-TABLES-RECORDS-COMMENTS-CREATE-009`        | ✅     |
| AC-010 | Logs comment creation to activity history             | `API-TABLES-RECORDS-COMMENTS-CREATE-010`        | ✅     |
| AC-011 | User creates comment with @mentions (regression)      | `API-TABLES-RECORDS-COMMENTS-CREATE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/{recordId}/comments/post.spec.ts`

---

## US-API-RECORD-HISTORY-004: Get Single Comment

**As a** developer,
**I want to** retrieve a specific comment by ID,
**so that** I can display or edit individual comments.

### API Request

```
GET /api/tables/1/records/123/comments/1
```

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                                     | Status |
| ------ | --------------------------------------------------- | -------------------------------------------- | ------ |
| AC-001 | Returns 200 OK with comment details                 | `API-TABLES-RECORDS-COMMENTS-GET-001`        | ✅     |
| AC-002 | Includes full author information                    | `API-TABLES-RECORDS-COMMENTS-GET-002`        | ✅     |
| AC-003 | Includes @mention metadata                          | `API-TABLES-RECORDS-COMMENTS-GET-003`        | ✅     |
| AC-004 | Returns 404 Not Found for non-existent comment      | `API-TABLES-RECORDS-COMMENTS-GET-004`        | ✅     |
| AC-005 | Returns 404 Not Found for non-existent record       | `API-TABLES-RECORDS-COMMENTS-GET-005`        | ✅     |
| AC-006 | Returns 401 when not authenticated                  | `API-TABLES-RECORDS-COMMENTS-GET-006`        | ✅     |
| AC-007 | Returns 403 when user lacks comment view permission | `API-TABLES-RECORDS-COMMENTS-GET-007`        | ✅     |
| AC-008 | User retrieves specific comment (regression)        | `API-TABLES-RECORDS-COMMENTS-GET-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/{recordId}/comments/{commentId}/get.spec.ts`

---

## US-API-RECORD-HISTORY-005: Update Comment

**As a** developer,
**I want to** edit existing comments,
**so that** users can correct mistakes or update information.

### API Request

```
PATCH /api/tables/1/records/123/comments/1
Content-Type: application/json

{
  "content": "Updated: This looks good! @alice confirmed."
}
```

### Acceptance Criteria

| ID     | Criterion                                      | E2E Spec                                        | Status |
| ------ | ---------------------------------------------- | ----------------------------------------------- | ------ |
| AC-001 | Returns 200 OK with updated comment            | `API-TABLES-RECORDS-COMMENTS-UPDATE-001`        | ✅     |
| AC-002 | Sets updated_at timestamp                      | `API-TABLES-RECORDS-COMMENTS-UPDATE-002`        | ✅     |
| AC-003 | Re-parses @mentions and updates metadata       | `API-TABLES-RECORDS-COMMENTS-UPDATE-003`        | ✅     |
| AC-004 | Returns 400 when content is empty              | `API-TABLES-RECORDS-COMMENTS-UPDATE-004`        | ⏳     |
| AC-005 | Returns 400 when content exceeds max length    | `API-TABLES-RECORDS-COMMENTS-UPDATE-005`        | ⏳     |
| AC-006 | Returns 404 Not Found for non-existent comment | `API-TABLES-RECORDS-COMMENTS-UPDATE-006`        | ⏳     |
| AC-007 | Returns 401 when not authenticated             | `API-TABLES-RECORDS-COMMENTS-UPDATE-007`        | ⏳     |
| AC-008 | Returns 403 when user is not comment author    | `API-TABLES-RECORDS-COMMENTS-UPDATE-008`        | ⏳     |
| AC-009 | Admin can edit any comment                     | `API-TABLES-RECORDS-COMMENTS-UPDATE-009`        | ⏳     |
| AC-010 | Logs comment edit to activity history          | `API-TABLES-RECORDS-COMMENTS-UPDATE-010`        | ⏳     |
| AC-011 | User updates their own comment (regression)    | `API-TABLES-RECORDS-COMMENTS-UPDATE-REGRESSION` | ⏳     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/{recordId}/comments/{commentId}/patch.spec.ts`

---

## US-API-RECORD-HISTORY-006: Delete Comment

**As a** developer,
**I want to** delete comments,
**so that** users can remove inappropriate or outdated content.

### API Request

```
DELETE /api/tables/1/records/123/comments/1
```

### Acceptance Criteria

| ID     | Criterion                                      | E2E Spec                                        | Status |
| ------ | ---------------------------------------------- | ----------------------------------------------- | ------ |
| AC-001 | Returns 200 OK with deleted comment            | `API-TABLES-RECORDS-COMMENTS-DELETE-001`        | ✅     |
| AC-002 | Soft deletes comment (sets deleted_at)         | `API-TABLES-RECORDS-COMMENTS-DELETE-002`        | ✅     |
| AC-003 | Returns 404 Not Found for non-existent comment | `API-TABLES-RECORDS-COMMENTS-DELETE-003`        | ✅     |
| AC-004 | Returns 404 for already deleted comment        | `API-TABLES-RECORDS-COMMENTS-DELETE-004`        | ✅     |
| AC-005 | Returns 401 when not authenticated             | `API-TABLES-RECORDS-COMMENTS-DELETE-005`        | ✅     |
| AC-006 | Returns 403 when user is not comment author    | `API-TABLES-RECORDS-COMMENTS-DELETE-006`        | ✅     |
| AC-007 | Admin can delete any comment                   | `API-TABLES-RECORDS-COMMENTS-DELETE-007`        | ✅     |
| AC-008 | Logs comment deletion to activity history      | `API-TABLES-RECORDS-COMMENTS-DELETE-008`        | ✅     |
| AC-009 | Supports permanent delete with ?permanent=true | `API-TABLES-RECORDS-COMMENTS-DELETE-009`        | ✅     |
| AC-010 | User deletes their own comment (regression)    | `API-TABLES-RECORDS-COMMENTS-DELETE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/api/tables/{tableId}/records/{recordId}/comments/{commentId}/delete.spec.ts`

---

## Regression Tests

| Spec ID                                         | Workflow                            | Status |
| ----------------------------------------------- | ----------------------------------- | ------ |
| `API-ACTIVITY-RECORD-HISTORY-REGRESSION`        | User views record change history    | `[x]`  |
| `API-TABLES-RECORDS-COMMENTS-LIST-REGRESSION`   | User lists comments on a record     | `[x]`  |
| `API-TABLES-RECORDS-COMMENTS-CREATE-REGRESSION` | User creates comment with @mentions | `[x]`  |
| `API-TABLES-RECORDS-COMMENTS-GET-REGRESSION`    | User retrieves specific comment     | `[x]`  |
| `API-TABLES-RECORDS-COMMENTS-UPDATE-REGRESSION` | User updates their own comment      | `[x]`  |
| `API-TABLES-RECORDS-COMMENTS-DELETE-REGRESSION` | User deletes their own comment      | `[x]`  |

---

## Coverage Summary

| User Story                | Title                | Spec Count            | Status   |
| ------------------------- | -------------------- | --------------------- | -------- |
| US-API-RECORD-HISTORY-001 | View Record History  | 10                    | Complete |
| US-API-RECORD-HISTORY-002 | List Record Comments | 10                    | Complete |
| US-API-RECORD-HISTORY-003 | Create Comment       | 10                    | Complete |
| US-API-RECORD-HISTORY-004 | Get Single Comment   | 7                     | Complete |
| US-API-RECORD-HISTORY-005 | Update Comment       | 10                    | Complete |
| US-API-RECORD-HISTORY-006 | Delete Comment       | 9                     | Complete |
| **Total**                 |                      | **56 + 6 regression** |          |
