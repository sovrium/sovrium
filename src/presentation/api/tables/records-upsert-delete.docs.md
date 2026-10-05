# Upsert and Delete

> The two writes that are neither a plain create nor a plain update — merging on a key, and removing a row — plus the parameter that decides how values come back on a read.

## Upsert

Upsert creates records or updates existing ones matched on one or more unique fields, in a single call. It is the endpoint for idempotent synchronisation from an external system: replaying the same payload converges instead of duplicating.

There is **one upsert endpoint and it is inherently multi-record** — the body always carries a `records` array, even for a single row.

```json
{
  "records": [{ "fields": { "email": "john@example.com", "name": "John Doe" } }],
  "fieldsToMergeOn": ["email"],
  "returnRecords": true
}
```

<!-- sovrium:options upsertRecordsRequestSchema -->

`fieldsToMergeOn` also answers to `matchFields`. The response reports counts rather than a per-row verdict:

```json
{ "records": [], "created": 1, "updated": 0 }
```

`records` is populated only when `returnRecords` is true. A body shaped as a single `{ "fields": … }` with no `records` array is refused with `400`.

A `default: $currentUser` fills the rows an upsert creates, never the rows it updates.

An upsert reads the table to find the rows it matches, so it requires reading the table: a caller who may not read it gets the `404` of a table that does not exist, on either branch, and nothing is written. (Answering a match `404` and a miss `200` would tell her which values are on file.)

A relationship value naming a row the caller may not read — a related table their role may not read, or a row a row-level rule hides from them — counts as a foreign-key failure on both branches, exactly as a row that does not exist: `400`, the same body, and the whole upsert rolls back with nothing written. As on an update, a many-to-one value equal to the key the matched row already holds is not a new link and is accepted.

## Delete

`DELETE` is a **soft delete** by default: it stamps `deletedAt` and `deletedBy` and leaves the row recoverable.

```
DELETE /api/tables/contacts/records/42
DELETE /api/tables/contacts/records/42?permanent=true
DELETE /api/tables/contacts/records/42?purge=true
```

| Mode              | Behaviour                                                                           | Success        |
| ----------------- | ----------------------------------------------------------------------------------- | -------------- |
| Default           | Trashes the row; recoverable by restore                                             | `204`, no body |
| `?permanent=true` | Removes the row irreversibly. **Admin-equivalent only**                             | `200`          |
| `?purge=true`     | Deletes the attached storage files, then removes the row. **Admin-equivalent only** | `200`          |

Both irreversible modes are reserved for an admin-equivalent role (see Roles & RBAC). Any other caller, even one the table grants `delete`, receives **404** rather than `403` — the same anti-enumeration rule the rest of the records path follows — and nothing is deleted. `?purge=true` is the mode to reach for when the row owns uploaded files that should not be left orphaned. Both flags are read from the query string, and `permanent` is tested first, so sending both takes the permanent path.

**A soft delete answers `204` with no body, except when a `set-null` cascade ran** — that case answers `200` with a body, because dependent rows were rewritten and the call did more than trash one row. A client must therefore treat both as success on the same route rather than matching on `204`. A `restrict` policy blocking the delete answers `400`.

**Every authorization denial on this endpoint answers `404`.** A missing record, an invisible record, and a visible record the caller may not delete are indistinguishable by design.

A delete requires reading the table, as an update does. On a table whose `read` refuses the caller, a delete — by `DELETE`, the delete form, either batch delete route or bulk-delete — answers the `404` of a missing record even where her `delete` grant admits her, and nothing is deleted.

## Raw values and display values

`format` controls how values are serialised on read endpoints.

| `format`  | Behaviour                                                                    |
| --------- | ---------------------------------------------------------------------------- |
| _omitted_ | Stored values, unchanged — the default, and what a programmatic client wants |
| `display` | A formatted field becomes an object carrying both the raw and rendered value |

```
GET /api/tables/orders/records?format=display&timezone=Europe/Paris
```

Under `format=display` a formatted field **wraps** rather than replaces: the value becomes `{ value, displayValue, … }`, so the raw form is still there to calculate with. Only these types are formatted; everything else comes back unchanged.

| Field type                      | Display formatting                                               |
| ------------------------------- | ---------------------------------------------------------------- |
| Currency                        | Symbol, decimal places and locale grouping                       |
| Date, date-time and time        | The configured format; `?timezone=` overrides the rendering zone |
| Duration                        | `h:mm`, `h:mm:ss` or decimal hours, per the field                |
| Single and multiple attachments | The upload constraints the field declares, where it declares any |

**`?format=raw` is refused on a single-record read.** That endpoint accepts `display` only; any other value, `raw` included, answers `400`. Omit the parameter to get raw values. On the list endpoint `raw` is accepted and is a no-op — the two endpoints disagree, and the single-record one is the stricter.

Round-tripping is not supported: read with `display`, and write back the raw value rather than the rendered one. Signed attachment URLs are added by a separate step and appear whatever `format` says.
