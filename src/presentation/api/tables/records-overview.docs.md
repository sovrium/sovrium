# Records Overview

> Every declared table exposes a full REST API for its rows — the URL layout, the response envelope, the authorship the server stamps, and the rules every records endpoint obeys.

There is no resolver to write and no endpoint to register. The moment a table exists in the config, its rows are reachable under `/api/tables/:tableId/records`. Tables declare the columns; records hold the values, and this API is the canonical read/write path for them — pages render it, forms write to it, automations react to it, and external integrations consume it.

`:tableId` accepts either the numeric table id or the table name.

| Method and path                                                                  | Description                                                |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `POST /api/tables/:tableId/records`                                              | Create one record                                          |
| `GET /api/tables/:tableId/records`                                               | List records, with filtering, sorting, paging and grouping |
| `GET /api/tables/:tableId/records/:recordId`                                     | Read one record                                            |
| `PATCH /api/tables/:tableId/records/:recordId`                                   | Partially update one record                                |
| `DELETE /api/tables/:tableId/records/:recordId`                                  | Soft-delete one record                                     |
| `POST /api/tables/:tableId/records/upsert`                                       | Create or update, matched on a key                         |
| `POST \| PATCH \| DELETE /api/tables/:tableId/records/batch`                     | Batch create, update and soft-delete                       |
| `POST /api/tables/:tableId/records/:recordId/restore`                            | Restore a soft-deleted record                              |
| `POST /api/tables/:tableId/records/batch/restore`                                | Restore many records                                       |
| `GET /api/tables/:tableId/records/:recordId/history`                             | The record's change history                                |
| `GET \| POST \| PATCH \| DELETE /api/tables/:tableId/records/:recordId/comments` | The record's comment thread                                |
| `GET /api/tables/:tableId/trash`                                                 | Browse soft-deleted records                                |
| `GET /api/tables/:tableId/subscribe`                                             | Real-time subscription                                     |

## The `fields` envelope

Write bodies carry a `fields` object mapping field names to values.

```json
{
  "fields": {
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

A body with no `fields` key — `{ "email": "john@example.com" }` — is wrapped into the canonical shape automatically. The envelope form is preferred, and it is the only shape the batch and upsert endpoints accept.

## What a record carries

A stored record answers with its generated id, the field values, and the authorship the server stamped.

<!-- sovrium:options recordSchema -->

`_aiCompute` appears only on a table declaring AI fields, and reports for each of them whether the value is the model's answer or the locally computed fallback. `_display` appears only where a relationship or a user field needs a human-readable label beside its stored key. Neither is present otherwise, so a client reading a plain table sees neither.

## Record ids and relationship values are strings

A record's `id` is a string — `"42"`, never `42` — and so is every relationship value that points at a record: `"7"` for a single link, `["7", "9"]` for a many-to-many. The same spelling holds on every wire that names a record: every records-API response, table webhook payloads (including the previous values of an update or a delete), real-time events, the record an automation is triggered with (`{{trigger.data.record.id}}` and its relationship fields, and so the data a code step reads from the trigger), record history, comments and activity entries, and the actions an AI chat turn reports. A string stays exact beyond the 2^53 a JSON number can carry, and it is the same shape whatever the table's key column holds.

Input is unchanged: a write body or a filter may spell an id or a relationship value as a number or as a string.

> **Upgrade note.** Versions up to 0.29.1 answered some of these as numbers: reading or updating one record returned `"id": 1`, relationship values were numbers everywhere, and update and delete webhooks, delete events and AI chat actions carried numeric ids. **Code that compares an id with a number now never matches, and raises no error.** A webhook receiver testing `record.company === 1`, a code step checking `trigger.data.record.id === 42`, or a client keying a map on numeric ids silently stops finding its records. To migrate, compare as strings — `record.company === '1'`, or `String(value)` on the side you compare against — and store the ids you persist as text. Code that already compared with `==` or converted with `String()` keeps working. `sovrium changelog --since <the version you run>` lists every breaking change between your version and the one you install.

## The list envelope

A list answers with an envelope, never a bare array: `records` is the page, and `pagination` carries the total matching-row count beside the window that produced this page.

```json
{
  "records": [{ "id": "1", "fields": {} }],
  "pagination": { "total": 128, "limit": 20, "offset": 0 }
}
```

## Authorship is stamped, never accepted

The server sets authorship on every write, and values supplied in a request body are ignored — which is what makes the trail worth reading.

| Field                             | Set when                     | Afterwards                                        |
| --------------------------------- | ---------------------------- | ------------------------------------------------- |
| `createdBy` / `createdAt`         | The record is created        | Never changes                                     |
| `updatedBy` / `updatedAt`         | Created, and on every update | Re-stamped on each write                          |
| `deletedBy` / `fields.deleted_at` | Soft-deleted                 | Cleared on restore; a live record carries neither |

The three actor keys resolve to the authenticated user's id. They are also readable as ordinary columns through the `created-by`, `updated-by` and `deleted-by` field types, and `updated-at` auto-bumps on every write — which is the column the optimistic-locking token compares against.

## Rules every records endpoint obeys

| Concern                 | Behaviour                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication          | A session is required; without one the answer is `401`                                                                                                                                |
| Table existence         | An unknown `:tableId` answers `404`                                                                                                                                                   |
| Table permissions       | Create, read, update and delete are gated per table and per role                                                                                                                      |
| Field-level permissions | Responses omit fields the caller may not read; writes to fields it may not write are refused                                                                                          |
| Validation              | Values are checked against the field type; a missing required field answers `400`                                                                                                     |
| Anti-enumeration        | An existing record the caller may not reach answers `404`, never `403`                                                                                                                |
| Record ids              | An id that is not a record key answers `404`, as a key no record holds does; in a batch body, an update skips it and a delete or restore answers `404`, as each does for a missing id |

**`404` rather than `403` is the deliberate answer to every denial here.** A `403` states that the thing exists, which is exactly the fact an attacker is probing for. Making "absent" and "forbidden" indistinguishable means a caller walking ids learns nothing from the difference — and it means a `404` on a write is not proof the row is gone.

## Raw values and display values

Values come back stored-as-written by default, which is what a programmatic client wants. Pass `?format=display` to receive currency, dates, durations and attachment names rendered for a human, in the caller's locale and timezone.
