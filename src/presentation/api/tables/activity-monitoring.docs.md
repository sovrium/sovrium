# Activity Monitoring

> System-wide activity logging — record CRUD, authentication events and administrative actions — with filtering, pagination, and an audit trail that outlives the rows it describes.

Sovrium records every meaningful action across the application — record create, update, delete and restore, authentication events, and administrative operations — into a system-wide activity log. The log is queryable through an authenticated API with filtering and pagination, giving operators and auditors a single place to answer "who did what, when".

This is the read surface over the platform's canonical audit-log event store. Each entry is immutable and outlives the rows it references where compliance requires it: an `account.deletion.purged` event survives the erasure of the user who triggered it.

## What gets tracked

| Category                   | Examples                                                            |
| -------------------------- | ------------------------------------------------------------------- |
| **Record CRUD**            | `create`, `update`, `delete`, `restore` on any table record.        |
| **Authentication events**  | Sign-in, sign-up, password reset, session revocation.               |
| **Administrative actions** | User creation, role changes, bans, schema publishes, force-deletes. |
| **System events**          | Migrations, account-deletion scheduling and purge.                  |

Each entry carries the action, the affected table and record id (when applicable), a timestamp, and the acting user (id, name, email). The actor reference is FK-linked with `ON DELETE SET NULL`, so an audit entry remains a valid compliance record even after the actor's account is erased.

## Querying the activity log

```text
GET /api/activity?page=1&pageSize=20&table=orders&action=update
```

```json
{
  "activities": [
    {
      "id": "act_123",
      "action": "update",
      "tableName": "orders",
      "recordId": 456,
      "createdAt": "2025-01-15T10:30:00Z",
      "user": { "id": "1", "name": "Alice", "email": "alice@example.com" }
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

| Parameter  | Type   | Description                                                    |
| ---------- | ------ | -------------------------------------------------------------- |
| `page`     | number | Page number (default: `1`).                                    |
| `pageSize` | number | Entries per page (default: `50`, from `1` to `100`).           |
| `table`    | string | Filter to a single table by name.                              |
| `action`   | string | Filter by action (`create`, `update`, `delete`, `restore`, …). |
| `userId`   | string | Filter to one actor. See the access rule below.                |

### Who may read it

**This endpoint is authenticated, and that is the whole of the gate — it is not admin-only, and it does not read the caller's role. Reason about exposure from that, not from an assumed role fence.**

- An **anonymous** request is refused `401`, whether or not the app configures auth.
- **Any signed-in caller reads the whole feed**, whatever role they hold — admin, member, viewer, or no role at all. It is a cross-table operational stream, so a reader sees every table's entries, including tables their role could not read directly.
- `?userId=` naming **someone other than yourself** is refused `404`, not `403`, unless you are an admin — the same anti-enumeration posture the rest of the platform takes. A non-admin cannot discover whether an account exists by filtering for it. This is the one place the caller's role is resolved.

The single role check is the `userId` filter. If the actions recorded here are sensitive on your deployment, the lever is not a setting on this endpoint: put the accounts that must not read it outside the app's session system, or do not expose the route.

## Activity log against record history

**They answer different questions and have different lifetimes; conflating them is the usual mistake.** The activity log is a cross-table, system-wide stream answering "what happened across the app". For the field-level before-and-after change set of a single record, read **Record History** — it captures the diff of each individual edit. Activity for breadth, history for depth.

## Retention

**Activity entries are retained for one year, then deleted.** A sweep runs daily at 03:15 UTC and physically removes every activity row whose `created_at` is older than one calendar year — the same boundary the record-history API uses to hide expired entries, so what you can no longer read is also what is no longer stored. The deletion is a real `DELETE`, not a `deleted_at` tombstone: an activity row's change set holds the before-and-after field values of the record it describes, and a tombstone would retain exactly the data the window says is gone.

Two neighbouring stores have deliberately different lifetimes:

| Store                        | Lifetime                    | Why                                                                                                                                                                                  |
| ---------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Activity log** (this page) | 1 year, swept daily         | An operational change feed. It carries record content, so it ages out.                                                                                                               |
| **Canonical audit log**      | Retained — no expiry window | The compliance record of who did what, including the `account.deletion.purged` entry that proves an erasure happened. A control that must outlive a person cannot expire on a timer. |
| **Soft-deleted source rows** | Kept until you remove them  | Recoverable tombstones. There is no platform timer that purges them; when they go is your decision.                                                                                  |

**There is no `ECO_RETENTION_PURGE_DAYS`.** Earlier documentation described soft-deleted rows ageing out on that horizon. The variable was removed because nothing ever read it — no purge job existed behind it — and a documented retention horizon that nothing enforces is worse than none. Soft-deleted rows are kept until you delete them.

## Compliance use

The same shape is returned to every signed-in reader, so SOC 2 and GDPR review documentation reflects exactly what operators see. Combined with the immutable canonical event store, the activity log provides the audit trail of erasure required when honouring a right-to-be-forgotten request: the deletion is itself logged, with the actor reference null-ified once the account is purged.

## Related reading

- **Record History** — field-level before-and-after diffs per record.
- **Soft Delete** — recoverable deletes and the `deleted_at` tombstone.
- **Admin Dashboard** — the operator read API over the rest of the platform.
- **GDPR & Privacy** — erasure records and the audit trail of deletion.
- **User Management** — the admin actions that produce activity entries.
