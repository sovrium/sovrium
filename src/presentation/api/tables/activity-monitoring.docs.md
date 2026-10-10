# Activity Monitoring

> System-wide activity logging — record CRUD, authentication events and administrative actions — with filtering, pagination, and an audit trail that outlives the rows it describes.

Sovrium records every meaningful action across the application — record create, update, delete and restore, authentication events, and administrative operations — into a system-wide activity log. The log is queryable through an authenticated API with filtering and pagination, giving operators and auditors a single place to answer "who did what, when".

This is the read surface over the platform's canonical audit-log event store. Each entry is immutable and outlives the rows it references where compliance requires it: an `account.deletion.purged` event survives the erasure of the user who triggered it.

Role changes, impersonations, bans, lifted bans and admin-set passwords are recorded here too (`user.role.changed`, `user.impersonation.started`, `user.impersonation.stopped`, `user.banned`, `user.unbanned`, `user.password.set`; an admin filters them with `GET /api/admin/audit-log?action=`, since `GET /api/activity` filters record actions only). Like the purge entry, they survive the erasure of the account they name, which they identify by id alone.

## What gets tracked

| Category                   | Examples                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------- |
| **Record CRUD**            | `create`, `update`, `delete`, `restore` and `permanent_delete` on any table record. |
| **Authentication events**  | Sign-in, sign-up, password reset, session revocation.                               |
| **Administrative actions** | User creation, role changes, bans, schema publishes, force-deletes.                 |
| **System events**          | Migrations, account-deletion scheduling and purge.                                  |

Each entry carries the action, the affected table and record id (when applicable), a timestamp, and the acting user. An admin reads the actor's id, name and email; any other reader reads her own email on her own entries, and only the id and name of another actor. The actor reference is FK-linked with `ON DELETE SET NULL`, so an audit entry remains a valid compliance record even after the actor's account is erased; the erasure also removes the actor's email address from every entry they made, leaving the act and the actor's tier.

## Querying the activity log

```text
GET /api/activity?page=1&pageSize=20&tableName=orders&action=update
```

```json
{
  "activities": [
    {
      "id": "act_123",
      "action": "update",
      "tableName": "orders",
      "recordId": "456",
      "createdAt": "2025-01-15T10:30:00Z",
      "user": { "id": "1", "name": "Alice" }
    }
  ],
  "pagination": { "total": 150, "page": 1, "pageSize": 20, "totalPages": 8 }
}
```

| Endpoint                        | Description                                     |
| ------------------------------- | ----------------------------------------------- |
| `GET /api/activity`             | Paginated, filterable list of activity entries. |
| `GET /api/activity/:activityId` | Full detail for a single activity entry.        |

### Query parameters

| Parameter   | Type   | Description                                                                      |
| ----------- | ------ | -------------------------------------------------------------------------------- |
| `page`      | number | Page number (default: `1`).                                                      |
| `pageSize`  | number | Entries per page (default: `50`, from `1` to `100`).                             |
| `tableName` | string | Filter to a single table by name.                                                |
| `action`    | string | Filter by action: `create`, `update`, `delete`, `restore` or `permanent_delete`. |
| `userId`    | string | Filter to one actor. See the access rule below.                                  |
| `startDate` | string | Only entries created at or after this ISO 8601 date.                             |

### Who may read it

**The feed shows a reader only what the records API would show her.** An entry is a record's values at a moment, so it is gated exactly as a read of that record.

- An **anonymous** request is refused `401`, whether or not the app configures auth.
- An **admin** reads the whole feed. Here, and everywhere below, an admin is the built-in `admin` role or the app's top role (the highest-level role, at or above the built-in admin).
- **Any other signed-in caller**, viewer included, reads only the entries of tables and rows the records API lets her read: the table's `read` permission, then its row-level read rule, judged on the record as it stands. An entry of a table the app no longer declares is shown to an admin only. Leaving entries out happens before pagination, so `pagination.total` counts what she is shown.
- One entry by id (`GET /api/activity/:activityId`) follows the same rule for every role, viewer included: an entry she may not read answers the same `404` as one that does not exist, and an entry she may read keeps, in `changes`, only the fields she may read — a field she may not read is absent from `before` and `after` alike.
- A **viewer** reads the list through the same gate as every other role: the entries of the tables and rows the records API lets her read, nothing else. The list itself carries no `changes`; an entry she opens from it by id keeps only her readable fields.
- `?userId=` naming **someone other than yourself** is refused `404`, not `403`, unless you are an admin — the same anti-enumeration posture the rest of the platform takes. A non-admin cannot discover whether an account exists by filtering for it.
- Another actor's **email** is never shown to a non-admin: an entry names her by id and name, the rule the comment thread, the record history and the user directory follow. Your own email stays on your own entries.

### AI agent entries

Beside `activities`, the list response carries `entries`: what your AI agents did and the human decisions on the actions they queued for approval. They follow one audience rule.

- An **approval decision** (`approval.approved` or `approval.rejected`) carries the `approvalId`, the `agentName` and the `actor` who decided, named by `id` and `name`. An admin reads every decision, with the email of whoever decided. Any other caller reads two kinds of decision only: the ones she made herself, and the ones made on a run she started. Both are matched on her account id, never on her role or her email, and another person's email never reaches her.
- An **agent action** carries the `agentName`, an `actor` of type `agent`, its `targetTable` and, when the action named one, its `recordId`. A non-admin reads it exactly as she would read that record through the records API: the table's `read` permission, then its row-level read rule judged on the row. An action that kept no row id, such as a creation, is judged on its table alone; on a table whose row-level read rule applies to her, it is left out, since there is no row to judge. An action that touched no table is shown to whoever started its run.
- A scheduled run has no starter, so its decisions reach a non-admin only when she decided them.

## Activity log against record history

**They answer different questions and have different lifetimes; conflating them is the usual mistake.** The activity log is a cross-table, system-wide stream answering "what happened across the app". For the field-level before-and-after change set of a single record, read **Record History** — it captures the diff of each individual edit. Activity for breadth, history for depth.

## Retention

**Activity entries are retained for one year, then deleted.** A sweep runs daily at 03:15 in the operator timezone (`SOVRIUM_TIMEZONE`, UTC when unset) and physically removes every activity row whose `created_at` is older than one calendar year, counted on that zone's calendar — the same boundary the record-history API uses to hide expired entries, so what you can no longer read is also what is no longer stored. The deletion is a real `DELETE`, not a `deleted_at` tombstone: an activity row's change set holds the before-and-after field values of the record it describes, and a tombstone would retain exactly the data the window says is gone.

Two neighbouring stores have deliberately different lifetimes:

| Store                        | Lifetime                    | Why                                                                                                                                                                                       |
| ---------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Activity log** (this page) | 1 year, swept daily         | An operational change feed. It carries record content, so it ages out.                                                                                                                    |
| **Canonical audit log**      | Retained — no expiry window | The compliance record of who did what, including the `account.deletion.purged` entry that proves an erasure happened. A control that must outlive a person cannot expire on a timer.      |
| **Soft-deleted source rows** | Kept until you remove them  | Recoverable tombstones. No timer purges them unless the table declares a `retention` window (see Table Retention), which deletes them with the rest of its rows once they are old enough. |

**There is no `ECO_RETENTION_PURGE_DAYS`.** Earlier documentation described soft-deleted rows ageing out on that horizon. The variable was removed because nothing ever read it — no purge job existed behind it — and a documented retention horizon that nothing enforces is worse than none. Soft-deleted rows are kept until you delete them, or until the `retention` window of their table removes them.

A table declaring `activityLog: false` writes no activity entry for its records, so they appear neither here nor in a record's history.

## Compliance use

An admin reads every entry whole, so SOC 2 and GDPR review documentation reflects exactly what operators see; other readers get the same entries narrowed to what the records API shows them. Combined with the immutable canonical event store, the activity log provides the audit trail of erasure required when honouring a right-to-be-forgotten request: the deletion is itself logged, with the actor reference and address removed from the erased person's entries once the account is purged. The one retained copy of the address is on the `account.deletion.purged` entry, as the proof that the erasure happened.

## Related reading

- **Record History** — field-level before-and-after diffs per record.
- **Soft Delete** — recoverable deletes and the `deleted_at` tombstone.
- **Admin Dashboard** — the operator read API over the rest of the platform.
- **GDPR & Privacy** — erasure records and the audit trail of deletion.
- **User Management** — the admin actions that produce activity entries.
