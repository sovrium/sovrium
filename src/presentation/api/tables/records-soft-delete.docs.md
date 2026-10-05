# Soft Delete and Restore

> Deleting is non-destructive by default — what a soft delete stamps, what a permanent delete costs, how related rows follow, and how to get a row back.

A deleted row is marked rather than removed: its deletion time and `deletedBy` are stamped, the row disappears from ordinary queries, and it remains recoverable. Permanent erasure is a separate, permission-gated operation for the cases that genuinely demand it.

A live record carries no deletion timestamp: `fields.deleted_at` appears only on a record read from the trash (`GET /api/tables/:tableId/trash`) or from a list with `includeDeleted=true`, where it holds the moment the record was deleted. A restored record comes back without it.

| Method and path                                                | Description                                        |
| -------------------------------------------------------------- | -------------------------------------------------- |
| `DELETE /api/tables/:tableId/records/:recordId`                | Soft-delete a record                               |
| `DELETE /api/tables/:tableId/records/:recordId?permanent=true` | Permanently delete a record                        |
| `DELETE /api/tables/:tableId/records/:recordId?purge=true`     | Permanently delete a record and its attached files |
| `GET /api/tables/:tableId/trash`                               | Browse soft-deleted records                        |
| `POST /api/tables/:tableId/records/:recordId/restore`          | Restore a soft-deleted record                      |
| `POST /api/tables/:tableId/records/batch/restore`              | Restore many records                               |

## Soft delete

```
DELETE /api/tables/orders/records/123
```

The row is stamped with the time and the acting user, then excluded from default list and read responses. The operation is written to the record's change history, so the trail survives the row leaving every normal query.

## Permanent delete

```
DELETE /api/tables/orders/records/123?permanent=true
```

Hard delete removes the row irreversibly and is reserved for an **admin-equivalent role** on **every** table — it is not something table permissions can grant. Admin-equivalent is defined once, under Roles & RBAC: the app's highest role, and the built-in admin. Any other caller, even one granted `delete`, receives `404` rather than `403`, for the same anti-enumeration reason the rest of the records path answers that way, and nothing is deleted.

**Reserve this for genuine erasure**, such as answering a right-to-erasure request over personal data. A financial ledger or anything audit-adjacent should rely on soft delete alone: there is no restore after a permanent delete, and the change history cannot reconstitute the row.

### `?purge=true` — erasure that also takes the files

```
DELETE /api/tables/orders/records/123?purge=true
```

`purge` removes the files attached to the record from storage and then deletes the row, which `permanent=true` does not: a permanent delete leaves every uploaded attachment behind in its bucket. For a right-to-erasure request over a record carrying uploads, `purge` is the parameter that finishes the job.

A file key another record still points at is left alone — each attachment is checked for other references before it is removed, so purging one row never blanks an attachment on a row you kept.

**It is gated exactly as `permanent` is.** A purge erases, so the ordinary `delete` grant is not enough: it is reserved for an admin-equivalent role, and any other caller — a member or a custom role granted `delete` included — receives the `404` of a missing record, while the row and its files stay where they were. A role granted `delete` trashes rows; it never erases them.

If both parameters are present, `permanent` is evaluated first and wins: the row is removed and its files are left in storage.

## What happens to related rows

When a record is deleted, dependents are handled by the relationship field's `onDelete` policy, declared on the field rather than on the delete request.

```yaml
tables:
  - id: 1
    name: orders
    permissions:
      delete: ['admin', 'member']
    fields:
      - id: 1
        name: customer_id
        type: relationship
        relatedTable: customers
        onDelete: cascade
```

| `onDelete` | Effect when the parent is deleted                                 |
| ---------- | ----------------------------------------------------------------- |
| `cascade`  | The dependent rows are deleted too                                |
| `set-null` | The foreign-key reference on dependents is cleared; answers `200` |
| `restrict` | The delete is blocked while dependents exist; answers `400`       |

The status is the part to wire for. An ordinary soft delete answers `204` with no body, but a `set-null` cascade answers `200` **with** one, because the call rewrote rows beyond the one addressed — so a client matching on `204` alone reads a successful cascade as a failure.

The `delete` permission on the table governs restore as well as delete, so a role that can trash a row can always bring it back.

## Restore

```
POST /api/tables/orders/records/123/restore
```

Restore clears `deletedAt`, returning the row to ordinary queries, stamps the time and the restoring user, and writes the operation to history.

| Status | Meaning                   |
| ------ | ------------------------- |
| `200`  | Restored                  |
| `400`  | The record is not deleted |
| `401`  | No session                |
| `404`  | Absent or invisible       |

Batch restore recovers many rows in one transaction: rows that are not currently deleted are skipped, while a missing id rolls the whole batch back.

On a table with row-level rules, a restore is judged on the trashed row itself: its `read` and `delete` rules must admit the caller, counting every role the caller holds, assignment roles included. A row they exclude answers `404`, exactly as a missing one, and stays in the trash; a batch naming one such row is refused whole and restores nothing.

## Reading deleted rows

Soft-deleted rows are excluded from list and read responses by default. Two parameters reach them:

| Parameter              | Result                                     |
| ---------------------- | ------------------------------------------ |
| `?includeDeleted=true` | Active **and** deleted rows in one listing |
| `?deleted=true`        | Deleted rows only — a trash listing        |

`includeDeleted` is compared against the exact string `true`, so any other value is read as "exclude deleted" and narrows nothing. A trash-only listing is `?deleted=true`, or the dedicated trash endpoint above.

The trash listing takes the same `filter` as the live listing, every operator included, and narrows the trash exactly as that filter narrows the live listing. Row-level read rules apply to the trash as they do to live rows.

On a single-record read, `?includeDeleted=true` is what reaches a trashed row; without it the row answers `404` exactly as an absent one would.

Deleted rows are never public. On a table whose `read` is `'all'`, a signed-out visitor asking for `?deleted=true` or `?includeDeleted=true` gets the `401` any anonymous call to a private route gets, and no deleted row.

## Who may do what

| Operation             | Permission                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Soft delete           | The table's `delete` grant, plus the role's own                                                                               |
| Permanent delete      | An admin-equivalent role only, single or batch — not reachable through table permissions                                      |
| Purge (`?purge=true`) | An admin-equivalent role only — not reachable through table permissions                                                       |
| Restore               | The `delete` grant, on both the single and the batch endpoint, and the row-level `read` and `delete` rules on the trashed row |
