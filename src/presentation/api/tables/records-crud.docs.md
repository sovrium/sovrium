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

`POST /api/tables/:tableId/records` answers `201` with the stored record: the generated id, the field echo, and the authorship the server stamped. Every write that hands a record back — create, update, restore, a batch or an upsert with `returnRecords`, and the MCP create and update tools — hands it back as the writer's own read of it would show it: a field, lookup, rollup, count or formula she may not read is left out.

### Creating in a table you may not read

A caller granted `create` on a table whose `read` refuses them — a public form's twin, `create: all` with `read: [admin]`, or members filing into a register only admins read — files the record, and is handed back none of it: the answer is `201` with the body `{ "created": 1 }`, carrying no field value and no record id, so a client tells "created, nothing echoed" from a failure by the status and the `created` count. A refusal that would describe the table — a malformed body, an unknown or missing field, a value the column refuses, a duplicate of a unique value — answers that caller the `404` of a table that does not exist instead of a `400`, `409` or `422`.

A record's `id` is a string in every response — create, list, read, update, restore and batch — whatever the table's primary key column holds. A string stays exact beyond the 2^53 a JSON number can carry, so compare ids as strings. A relationship value is the related record's id as a string — `"1"`, or `["1", "2"]` for many-to-many — and either spelling is accepted on input and in filters.

| Status | Meaning                                                  |
| ------ | -------------------------------------------------------- |
| `201`  | Created                                                  |
| `400`  | A required field is missing, or a value fails its type   |
| `401`  | No session                                               |
| `404`  | The table does not exist, or the caller may not reach it |
| `409`  | A unique constraint already holds that value             |

### Linking to a row you may not read

A relationship value is judged by **your** read rules on the related table. A value naming a row you may not read — the related table refuses your role, or a row-level rule hides that row from you — answers exactly as a value naming a row that does not exist: `400`, the same body, and nothing written. A many-to-many value naming any such row is refused whole, and a refused create stores no record, not even the one its links were for. Links to rows you may read, and every link an admin writes, are unaffected.

A record may carry nothing but its many-to-many links: it is created with every other field at its default, singly or in a batch. A required field with no default is still refused as missing.

## Read

`GET /api/tables/:tableId/records/:recordId` answers `200`, or `404` when the record is absent **or** invisible to the caller — the two are deliberately indistinguishable.

<!-- sovrium:options getRecordResponseSchema -->

Fields the caller may not read are omitted, so the same row answers with a different field set depending on who asks. `?includeDeleted=true` reaches a soft-deleted row.

On this endpoint `format` accepts **only `display`**. `?format=raw` answers `400`, and omitting the parameter is how raw values are requested — a difference from the list endpoint, which accepts `raw` as a no-op.

### Revalidating a read

A record read, like a records list, carries an `ETag` and `Cache-Control: private, no-cache`. Send the tag back in `If-None-Match` and an unchanged answer is `304 Not Modified` with no body; any change to what you would receive — the record, or the fields you may read — produces a new tag and a full `200`. Browsers do this on their own, so a page that re-reads the same records on every visit pays for the body only when it has changed.

The tag describes the answer **you** receive, and it is checked after every permission check: a tag taken from another caller never turns a `404` into a `304`. Responses are never marked `public`, so no proxy or CDN stores them, and there is no `max-age`: a read that follows a write always sees the write.

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

A relationship value is judged as on create: a row you may not read answers as a row that does not exist, `400` with nothing written. A many-to-one value equal to the key the record already holds is not a new link and is accepted, so a record filed under a row you cannot see can still be saved with its other changes. A many-to-many value is refused whole if it names any row you may not read, even one already linked; leave the field out and the links you cannot see stay as they are.

A many-to-many value in an update **adds** links: `["2"]` on a record linked to `["1", "3"]` leaves it linked to all three. Only an empty list or `null` removes links, and it removes every link you may read. To drop one link, clear the field, then send the links to keep.

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
