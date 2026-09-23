# Batch Operations

> Writing many records in one request — the five endpoints, their per-request ceilings, and the all-or-nothing rule that makes a partial import impossible.

Each batch runs in a single transaction: if any record fails validation the whole batch rolls back and nothing is written. Pass `returnRecords: true` to receive the affected rows; otherwise the response is a summary.

| Method and path                                   | Operation   | Maximum per request |
| ------------------------------------------------- | ----------- | ------------------- |
| `POST /api/tables/:tableId/records/batch`         | Create      | 1000                |
| `PATCH /api/tables/:tableId/records/batch`        | Update      | 100                 |
| `DELETE /api/tables/:tableId/records/batch`       | Soft delete | 100                 |
| `POST /api/tables/:tableId/records/batch/restore` | Restore     | 100                 |
| `POST /api/tables/:tableId/records/upsert`        | Upsert      | 100                 |

Every batch body requires the canonical envelope form. The flat shorthand that single-record create accepts is **not** available here, and every batch must carry at least one entry.

## Create

```json
{
  "records": [
    { "fields": { "email": "alice@example.com", "name": "Alice" } },
    { "fields": { "email": "bob@example.com", "name": "Bob" } }
  ],
  "returnRecords": true
}
```

<!-- sovrium:options batchCreateRecordsRequestSchema -->

| Status | Meaning                                                        |
| ------ | -------------------------------------------------------------- |
| `201`  | Every record created                                           |
| `400`  | Empty array, over the ceiling, or any record failed validation |
| `401`  | No session                                                     |
| `404`  | Table absent or invisible                                      |
| `409`  | A record collided with a unique constraint                     |

The last two rows of that table are the same event seen twice: a `400` and a `409` both mean **no row was written**, including the ones that were perfectly valid.

## Update

Each entry names the record `id` — string or number, both accepted — plus the fields to patch. Updates stay partial per record. A missing `id` or an invalid value rolls the transaction back.

```json
{
  "records": [
    { "id": "1", "fields": { "status": "active" } },
    { "id": 2, "fields": { "status": "archived" } }
  ]
}
```

## Delete

```json
{
  "ids": ["1", "2", 3],
  "permanent": false
}
```

**`permanent` goes in the body.** This route reads the flag from the JSON body, where the schema validates it; a `?permanent=true` query string has no effect here, so a request relying on it soft-deletes and reports success. Permanent batch delete is irreversible and is reserved for the admin role.

## Restore

```json
{ "ids": ["1", "2", "3"] }
```

Records that are not currently deleted are skipped rather than failing; a missing `id` rolls the whole batch back. Each restore clears `deletedAt` and `deletedBy`, and is written to the record's change history.

## Upsert

Create-or-update many records matched on one or more unique fields, in one transaction. Name the merge key with `fieldsToMergeOn`, or its alias `matchFields`. An existing match is patched; anything else is inserted. This is the canonical path for idempotent synchronisation from an external source of truth.

## What holds across all five

| Property        | Behaviour                                                         |
| --------------- | ----------------------------------------------------------------- |
| Atomicity       | One transaction per batch — all or nothing                        |
| `returnRecords` | `false` unless asked; `true` returns the affected rows            |
| Minimum size    | At least one entry, otherwise `400`                               |
| Unique conflict | `409` on create, update and upsert — the code a single write uses |
| Authorship      | Stamped per record, exactly as on a single write                  |
| Permissions     | Table and field-level permissions are enforced per record         |

A **uniqueness collision answers `409`** on every batch path, matching the single-record write. Other constraint failures — a check, a foreign key, a not-null — stay `400`, because those reject the value that was sent, whereas a unique collision is a clash with a row that already exists. Either way the transaction rolls back whole.
