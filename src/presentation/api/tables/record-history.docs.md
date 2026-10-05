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

The table is addressed by its name or its id, as on every records route.

## Change history

History is tracked for every table with nothing to enable. Each create, update, delete and restore is recorded with the acting user and the record as it was before and after the change.

<!-- sovrium:options recordHistoryEntrySchema -->

```
GET /api/tables/orders/records/42/history
```

```json
{
  "history": [
    {
      "action": "create",
      "createdAt": "2026-10-05T09:12:04.118Z",
      "changes": {
        "after": { "id": 42, "status": "pending", "updated_at": "2026-10-05T09:12:04.101Z" }
      },
      "user": { "id": "7Qm2TbV9xKc4LwP1sN8dRz3YhJ6fGa0E", "name": "Alice" }
    },
    {
      "action": "update",
      "createdAt": "2026-10-05T10:30:00.214Z",
      "changes": {
        "before": { "id": 42, "status": "pending", "updated_at": "2026-10-05T09:12:04.101Z" },
        "after": { "id": 42, "status": "approved", "updated_at": "2026-10-05T10:30:00.198Z" }
      },
      "user": { "id": "7Qm2TbV9xKc4LwP1sN8dRz3YhJ6fGa0E", "name": "Alice" }
    }
  ],
  "pagination": { "total": 2, "limit": 2, "offset": 0 }
}
```

Entries come oldest first. `changes` holds the whole record on each side of the change — every field you may read, not only the ones that moved — so a client computes the difference by comparing `before` with `after`; a create carries `after` alone. The snapshots are the stored row, which is why the record's key reads there as the database holds it — a number, for the default key — rather than as the string the records API answers. `user` names the person who made the change and is absent when no user did. `?limit=` and `?offset=` page through a long history; without them every entry is returned and `limit` equals `total`.

A record's history shows only what a read of the record would: the fields you may read, and nothing of a record you may not open (404). The table's read permission, its row-level read rule and each field's read rule apply exactly as they do on `GET /api/tables/:tableId/records/:recordId`; a change to a field hidden from you still appears as an entry, without that field's values.

The trail records changes from **every** source — API writes, admin edits, automations and batch operations — which is what makes it an audit trail rather than a log of one client's activity. It complements the authorship stamped on the record itself: those keys name the latest actor, while the history keeps the ones before them.

**Retention and per-field tracking are not configurable.** History is kept for every table, for every field, indefinitely. An app storing personal data in a tracked field should know that a permanent delete of the row does not by itself remove the field values the history recorded.

## Comments

A comment is a user-authored note attached to a record. The author is injected from the session, so a request supplies only the content.

```json
{
  "content": "This looks good! @[a1b2c3] can you confirm the numbers?"
}
```

A successful create answers `201` with the stored comment inside a `comment` envelope.

<!-- sovrium:options commentSchema -->

`content` is required and capped at 10,000 characters.

### Mentions

To mention someone, write `@[<user id>]` in the content — the markup the page composer sends when a writer types `@` and picks a person. A plain `@alice` is text and mentions nobody. An optional `mentions` array of user ids on the create request is merged with the markup, so there is one mention list per comment whichever way it arrived. A comment mentions at most **50** distinct people, the markup and the array counted together; a request naming more is refused with `400` and an error naming the limit, and nothing is stored. The mentions reach automations as the trigger's `mentions`, so a comment trigger can notify the people named.

**Only people who can read the record count.** A mention, from the markup or the array, naming someone the record's `read` permission or row-level read rule refuses — or an id that belongs to nobody — is dropped: it never reaches an automation and never fires a `mentionsOnly` trigger. Each person is judged as the records API would judge them: their role, their groups and, on a table with a row-level rule, the roles assigned to them per record, then the rule itself with their own assignments — so someone granted access to another client's records stays out.

The content is stored and returned as written, markup included. Alongside it, the list, create, read-one and edit responses carry `mentions`: the `{ id, name }` of each person the markup names who can read the record, with their current name. A thread renders each token from that list, and any token not in it as a neutral `@unknown user` — never the markup, the id, or the name of someone outside the record's audience.

```
GET /api/tables/orders/records/123/comments/mentionable?q=car
```

answers `{ "users": [{ "id": "…", "name": "Carol Dupont", "image": null }] }`: the people who can read the record, other than the caller, whose name contains `q`, at most 20 of them. It never returns an email. It is the candidate list behind the composer's picker. A caller who cannot read the record — including one the table's row-level read rule hides it from — gets `404`. The picker finds the record's readers however many people who cannot read it sort before them.

### Reading, editing and deleting

```
GET    /api/tables/orders/records/123/comments
GET    /api/tables/orders/records/123/comments/2
PATCH  /api/tables/orders/records/123/comments/2
DELETE /api/tables/orders/records/123/comments/2
```

Editing replaces the content; deleting removes the comment. Both honour the role's grants and the table's permissions — typically a user may edit and delete their own comments, with broader rights for elevated roles.

Every comment route — list, read one, create, edit, delete, mark read and the mention picker — answers to the same gates as a read of the record: the table's read permission, then its row-level read rule, judged on the record the comment belongs to. A `group:` read grant opens the thread of a table with a row-level rule just as a role grant does. A record you may not open answers `404` exactly as a missing one does, and nothing is written.

On a moderated table, reading one comment by its id follows the thread's rule: only an admin reads a pending or rejected comment, and anyone else gets the `404` a comment that does not exist gets. Every comment the list, read-one and edit responses return carries its stored `status` — `approved`, `pending` or `rejected`.

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

| Concern        | Behaviour                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------- |
| Authentication | A session is required; without one the answer is `401`                                             |
| Existence      | An unknown table, record or comment answers `404`                                                  |
| Author safety  | The author comes from the session; a client-supplied one is ignored                                |
| Personal data  | The author projection exposes `id` and `name` and nothing else                                     |
| Row rules      | A record the row-level read rule hides answers every comment route with `404`, as a missing record |
