# Endpoint Reference

> Every path the REST API serves, grouped by what it operates on. The authentication model, the error envelope and the cross-cutting behaviour that govern all of them are one article away.

## Health

| Method | Path          | Description                                                                                                                   |
| ------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/health` | Server status. No credential required; an app with authentication answers `{ status, version }` unless the caller is an admin |

## Tables

Read table definitions, and manage outgoing table webhooks.

| Method | Path                                                      | Description           |
| ------ | --------------------------------------------------------- | --------------------- |
| `GET`  | `/api/tables`                                             | List all tables       |
| `GET`  | `/api/tables/{tableId}`                                   | Get one table         |
| `GET`  | `/api/tables/{tableId}/permissions`                       | Get table permissions |
| `GET`  | `/api/tables/{tableId}/export`                            | Export records as CSV |
| `GET`  | `/api/tables/{tableId}/webhooks`                          | List table webhooks   |
| `POST` | `/api/tables/{tableId}/webhooks/{webhookName}/test`       | Send a test delivery  |
| `GET`  | `/api/tables/{tableId}/webhooks/{webhookName}/deliveries` | List deliveries       |
| `GET`  | `.../deliveries/{deliveryId}`                             | Get one delivery      |
| `POST` | `.../deliveries/{deliveryId}/retry`                       | Retry a delivery      |

In an app with no `auth`, `GET /api/tables` lists the tables every visitor may read.

With `auth`, `GET /api/tables` names a table exactly when its records answer the caller — group grants, `inherit` and `override` resolved as the records route resolves them. A table that declares no `read` is listed to every caller its records serve, and to no one else. No role is refused the list itself: a viewer is named the tables her records serve, and a caller whose records serve no table gets `200` with an empty list. `GET /api/tables/{tableId}` answers exactly the callers the table's records answer, an admin always; anyone else gets the same `404` as for a table that does not exist.

The five webhook routes are for admins. Any other signed-in caller gets the same `404` as for a table that does not exist, and a retry or a test from such a caller sends nothing.

## Records

### Create, read, update, delete

| Method   | Path                                       | Description     |
| -------- | ------------------------------------------ | --------------- |
| `GET`    | `/api/tables/{tableId}/records`            | List records    |
| `POST`   | `/api/tables/{tableId}/records`            | Create a record |
| `GET`    | `/api/tables/{tableId}/records/{recordId}` | Get one record  |
| `PATCH`  | `/api/tables/{tableId}/records/{recordId}` | Update a record |
| `DELETE` | `/api/tables/{tableId}/records/{recordId}` | Delete a record |

`DELETE` soft-deletes by default; `?permanent=true` and `?purge=true` hard-delete on the same route, and both are reserved for an admin-equivalent role. Two form-post equivalents exist for HTML forms: `POST .../records/{recordId}/update` and `POST .../records/{recordId}/delete`.

### Buttons

| Method | Path                                                           | Description                  |
| ------ | -------------------------------------------------------------- | ---------------------------- |
| `POST` | `/api/tables/{tableId}/records/{recordId}/buttons/{fieldName}` | Invoke a record button field |

### Batch

| Method   | Path                                          | Description                        |
| -------- | --------------------------------------------- | ---------------------------------- |
| `POST`   | `/api/tables/{tableId}/records/batch`         | Create many records, 1 to 1000     |
| `PATCH`  | `/api/tables/{tableId}/records/batch`         | Update many records, 1 to 100      |
| `DELETE` | `/api/tables/{tableId}/records/batch`         | Soft-delete many records, 1 to 100 |
| `POST`   | `/api/tables/{tableId}/records/batch/delete`  | Soft-delete, alternate verb        |
| `POST`   | `/api/tables/{tableId}/records/batch/restore` | Restore many records, 1 to 100     |
| `POST`   | `/api/tables/{tableId}/records/upsert`        | Create or update records, 1 to 100 |

`POST .../records/bulk-delete` and `bulk-update` back HTML form submissions. Batch delete reads `permanent` from the JSON body only; the query-string form belongs to single-record delete and does nothing here.

`bulk-update` applies one change to every listed record under the same rules as a PATCH of each — the row as written included — refuses a key that names no field with `400`, and clears a field with JSON `null`.

### Trash and history

| Method | Path                                               | Description              |
| ------ | -------------------------------------------------- | ------------------------ |
| `GET`  | `/api/tables/{tableId}/trash`                      | List trashed records     |
| `POST` | `/api/tables/{tableId}/records/{recordId}/restore` | Restore a deleted record |
| `GET`  | `/api/tables/{tableId}/records/{recordId}/history` | Get the change history   |

### Comments

| Method   | Path                                                     | Description               |
| -------- | -------------------------------------------------------- | ------------------------- |
| `GET`    | `/api/tables/{tableId}/records/{recordId}/comments`      | List comments on a record |
| `POST`   | `/api/tables/{tableId}/records/{recordId}/comments`      | Add a comment             |
| `POST`   | `/api/tables/{tableId}/records/{recordId}/comments/read` | Mark comments read        |
| `GET`    | `.../{recordId}/comments/{commentId}`                    | Get one comment           |
| `PATCH`  | `.../{recordId}/comments/{commentId}`                    | Update a comment          |
| `DELETE` | `.../{recordId}/comments/{commentId}`                    | Delete a comment          |

### Realtime

| Method | Path                                  | Description                 |
| ------ | ------------------------------------- | --------------------------- |
| `GET`  | `/api/tables/{tableId}/subscribe`     | Subscribe to record changes |
| `GET`  | `/api/tables/{tableId}/subscribe/sse` | Server-sent events stream   |
| `GET`  | `/api/realtime/presence`              | Current presence            |

## Views

| Method | Path                                           | Description                |
| ------ | ---------------------------------------------- | -------------------------- |
| `GET`  | `/api/tables/{tableId}/views`                  | List views for a table     |
| `GET`  | `/api/tables/{tableId}/views/{viewId}`         | Get one view               |
| `GET`  | `/api/tables/{tableId}/views/{viewId}/records` | Get records through a view |

Unlike the `view` parameter on the records list, this endpoint applies the view's **full** configuration, including its field selection and grouping.

## Activity

| Method | Path                         | Description           |
| ------ | ---------------------------- | --------------------- |
| `GET`  | `/api/activity`              | List activity entries |
| `GET`  | `/api/activity/{activityId}` | Get activity detail   |

## Analytics

| Method | Path                       | Description               |
| ------ | -------------------------- | ------------------------- |
| `POST` | `/api/analytics/collect`   | Collect a page-view event |
| `POST` | `/api/analytics/click`     | Collect an outbound click |
| `GET`  | `/api/analytics/overview`  | Overview                  |
| `GET`  | `/api/analytics/pages`     | Top pages                 |
| `GET`  | `/api/analytics/referrers` | Top referrers             |
| `GET`  | `/api/analytics/devices`   | Device breakdown          |
| `GET`  | `/api/analytics/campaigns` | Campaign stats            |
| `GET`  | `/api/analytics/events`    | Custom events             |
| `GET`  | `/api/analytics/targets`   | Click split for one link  |

## Authentication

Authentication is mounted at `/api/auth/*` — email and password, social sign-in, sessions, password reset, email verification, two-factor, magic links, email one-time codes, organizations and admin user management.

A signed-in user updates their own profile with `POST /api/auth/update-user` — their display name, or `image: null` to clear their avatar. A body carrying `role` is refused with `400` and changes nothing: roles change only through the admin routes below.

A few routes are served directly rather than by the auth library:

| Method  | Path                                     | Description                       |
| ------- | ---------------------------------------- | --------------------------------- |
| `POST`  | `/api/auth/session/refresh`              | Refresh the active session        |
| `PATCH` | `/api/auth/admin/users/{id}`             | Change a user's role (admin only) |
| `GET`   | `/api/auth/organization/list-teams`      | List teams in an organization     |
| `POST`  | `/api/auth/organization/add-team-member` | Add a member to a team            |

A role change made through `PATCH /api/auth/admin/users/{id}` is handed to set-role — same callers, same rules, `404` for an unknown id — and applies on that user's next request; no one is signed out, and the response sets no cookie.

When API keys are enabled, four further routes let a signed-in user manage their own long-lived credentials. **Without the opt-in these four answer `404`** rather than `501` or `403`, so a client cannot tell a disabled feature from an absent route.

| Method | Path                       | Description                            |
| ------ | -------------------------- | -------------------------------------- |
| `POST` | `/api/auth/api-key/create` | Mint a key; the value is returned once |
| `GET`  | `/api/auth/api-key/list`   | List the caller's own keys             |
| `GET`  | `/api/auth/api-key/get`    | Read one of the caller's keys by id    |
| `POST` | `/api/auth/api-key/delete` | Revoke a key                           |

Admins can browse the whole machine-readable surface at `/api/scalar` and fetch the raw OpenAPI documents.
