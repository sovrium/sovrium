# Create, Read and Update

> The single-record lifecycle — the three request shapes, the status each answers with, and the one token that protects a write from overwriting a change it never saw.

Every write body carries the canonical `{ "fields": { … } }` envelope.

## Create

```json
{
  "fields": {
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

`POST /api/tables/:tableId/records` answers `201` with the stored record: the generated id, the field echo, and the authorship the server stamped.

| Status | Meaning                                                  |
| ------ | -------------------------------------------------------- |
| `201`  | Created                                                  |
| `400`  | A required field is missing, or a value fails its type   |
| `401`  | No session                                               |
| `404`  | The table does not exist, or the caller may not reach it |
| `409`  | A unique constraint already holds that value             |

## Read

`GET /api/tables/:tableId/records/:recordId` answers `200`, or `404` when the record is absent **or** invisible to the caller — the two are deliberately indistinguishable.

<!-- sovrium:options getRecordResponseSchema -->

Fields the caller may not read are omitted, so the same row answers with a different field set depending on who asks. `?includeDeleted=true` reaches a soft-deleted row.

On this endpoint `format` accepts **only `display`**. `?format=raw` answers `400`, and omitting the parameter is how raw values are requested — a difference from the list endpoint, which accepts `raw` as a no-op.

## Update

`PATCH` is partial: only the fields present in the body are written, and an omitted field is left as it was.

```json
{
  "fields": {
    "status": "active"
  }
}
```

| Status | Meaning                                            |
| ------ | -------------------------------------------------- |
| `200`  | Updated; `updatedBy` and `updatedAt` re-stamped    |
| `400`  | An invalid value, or a constraint violation        |
| `401`  | No session                                         |
| `404`  | Absent, invisible, **or visible but not writable** |
| `409`  | The optimistic-lock token was stale                |

**A refused write answers `404`, not `403`.** A caller who may read a row but not change it gets the same answer as one asking about a row that never existed, so the write boundary cannot be mapped by probing it. The practical consequence for a client: a `404` from `PATCH` is not evidence the record is gone.

## Guarding against a lost update

Send a top-level `updatedAt` beside `fields`. The server compares it against the row's stored timestamp and refuses a write whose author had read an older version.

```json
{
  "fields": { "status": "active" },
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

A stale token answers `409` with a message telling the caller to reload and retry.

The comparison is **skipped entirely** in three cases: the token is absent, the stored row carries no timestamp, or either value will not parse as one. Locking is therefore opt-in per request rather than a property of the table, and a client that omits the token silently gets last-write-wins. That is a deliberate default — making it mandatory would break every integration that writes a row it did not first read — but it means the protection exists only where a client asks for it.

The column the token is compared against is bumped by the server on every write from any source, so a change made through the admin console or by an automation invalidates a token held by an API client just as another API write would.
