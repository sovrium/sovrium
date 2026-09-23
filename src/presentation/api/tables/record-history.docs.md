# Record History and Comments

> Two activity surfaces every record carries — a change history the server maintains on its own, and a comment thread its users write.

| Method and path                                                     | Description                   |
| ------------------------------------------------------------------- | ----------------------------- |
| `GET /api/tables/:tableId/records/:recordId/history`                | The record's change history   |
| `GET /api/tables/:tableId/records/:recordId/comments`               | List comments                 |
| `GET /api/tables/:tableId/records/:recordId/comments/:commentId`    | Read one comment              |
| `POST /api/tables/:tableId/records/:recordId/comments`              | Create a comment              |
| `PATCH /api/tables/:tableId/records/:recordId/comments/:commentId`  | Edit a comment                |
| `DELETE /api/tables/:tableId/records/:recordId/comments/:commentId` | Delete a comment              |
| `POST /api/tables/:tableId/records/:recordId/comments/read`         | Mark the thread read (opt-in) |

## Change history

History is tracked for every table with nothing to enable. Each create, update, delete and restore is recorded with the acting user and a field-level diff.

<!-- sovrium:options recordHistoryEntrySchema -->

```json
{
  "history": [
    {
      "id": 1,
      "action": "update",
      "changes": { "status": { "from": "pending", "to": "approved" } },
      "user": { "id": 1, "name": "Alice" },
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

The trail records changes from **every** source — API writes, admin edits, automations and batch operations — which is what makes it an audit trail rather than a log of one client's activity. It complements the authorship stamped on the record itself: those keys name the latest actor, while the history keeps the ones before them.

**Retention and per-field tracking are not configurable.** History is kept for every table, for every field, indefinitely. An app storing personal data in a tracked field should know that a permanent delete of the row does not by itself remove the field values the history recorded.

## Comments

A comment is a user-authored note attached to a record. The author is injected from the session, so a request supplies only the content.

```json
{
  "content": "This looks good! @alice can you confirm the numbers?"
}
```

A successful create answers `201` with the stored comment inside a `comment` envelope.

<!-- sovrium:options commentSchema -->

`content` is required and capped at 10,000 characters.

**Mentions are not parsed out of the text.** Writing `@alice` in the body creates no mention; supply the mentioned user ids yourself in an optional `mentions` array on the request. They reach automations as the trigger's `mentions`, so a comment trigger can notify the people named.

### Reading, editing and deleting

```
GET    /api/tables/orders/records/123/comments
GET    /api/tables/orders/records/123/comments/2
PATCH  /api/tables/orders/records/123/comments/2
DELETE /api/tables/orders/records/123/comments/2
```

Editing replaces the content; deleting removes the comment. Both honour the role's grants and the table's permissions — typically a user may edit and delete their own comments, with broader rights for elevated roles.

The `user` object on a comment is projected to a display shape carrying `id` and `name` only. Email and everything else a user record holds are never returned here, so a comment thread cannot be used to read the directory behind it.

## Read state is opt-in

```yaml
tables:
  - name: tickets
    comments:
      readTracking: true
    fields:
      - { name: subject, type: single-line-text }
```

`comments.readTracking` is off by default. Turning it on adds two things: a per-user `unreadCount` on the comment read response, and the `comments/read` endpoint above, which marks the record's thread read for the calling user.

Without it the endpoint is **inert and answers `404`** rather than an error naming the missing option — the same uniform not-found every other denial on this path gives, so a caller cannot use it to learn whether a table exists. Turn the option on before wiring a client to that route.

## What holds across both surfaces

| Concern        | Behaviour                                                           |
| -------------- | ------------------------------------------------------------------- |
| Authentication | A session is required; without one the answer is `401`              |
| Existence      | An unknown table, record or comment answers `404`                   |
| Author safety  | The author comes from the session; a client-supplied one is ignored |
| Personal data  | The author projection exposes `id` and `name` and nothing else      |
