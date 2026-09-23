# Table Permissions

> Role-based access control for a table, per-field read and write audiences, row-level predicates — and why an unauthorized read answers 404.

Sovrium controls record access at three levels: **role-based access control** on the table, **field-level permissions** for individual columns, and optional **row-level predicates** for scoping within a role. Unauthorized access returns **404**, never 403, so that probing for status codes cannot be used to discover which records or tables exist.

## Permission values

Every operation accepts one of three shapes.

| Value                 | Meaning                                      |
| --------------------- | -------------------------------------------- |
| `all`                 | Everyone, including unauthenticated visitors |
| `authenticated`       | Any signed-in user                           |
| `['admin', 'editor']` | Only the listed role names                   |

The three built-in roles are `admin`, `member` and `viewer`, highest to lowest. A custom role name declared under `auth.roles` is accepted in the array form.

## Table-level permissions

<!-- sovrium:options TablePermissionsSchema -->

```yaml
permissions:
  read: all
  comment: authenticated
  create: [admin, editor]
  update: [admin, editor]
  delete: [admin]
```

Declaring **any** operation turns the table into a gated one, and every operation left out is then denied to non-admins. A table with no `permissions` block at all — or one that sets only `fields`, `inherit` or `override` — declares no operation and stays open to every non-viewer role. That asymmetry is deliberate: a half-written permissions block should fail closed.

### Restore and permanent delete have no grant of their own

**Restore shares the `delete` grant.** Restoring is the inverse of soft-deleting, so both directions pass through one door: whoever may soft-delete a record may restore it. A separate grant would let the two drift apart, leaving one of them a weaker door onto the same operation.

**Permanent delete is admin-only and not configurable.** `?permanent=true` erases the row irreversibly, so it is reserved for the `admin` role on every table regardless of what `permissions` says. A non-admin attempt answers `404`, like any other unauthorized access.

## Field-level permissions

Each entry names a `field` and optionally its `read` and `write` audiences, in the same three shapes. An omitted audience inherits from the table — `read` from the table's `read`, `write` from `create` and `update`.

<!-- sovrium:options FieldPermissionSchema -->

```yaml
permissions:
  read: authenticated
  fields:
    - { field: salary, read: [admin, hr], write: [admin] }
    - { field: department, read: all, write: [admin] }
```

A field a role cannot read is also not **queryable** by that role: `filter`, `groupBy` and `aggregate` on it answer `404`. A hidden column would otherwise leak its values through the result set — `groupBy` returns its distinct values and `aggregate` its minimum and maximum, so hiding the column while leaving it queryable hides almost nothing.

The rule holds at any nesting depth, so a restricted field inside an `and` or `or` group is refused exactly like a top-level one, and it covers **CSV export**: `?filterField=` on an export request is checked against the same field-read permissions. Leaving export out would leak the column through which _rows_ come back, one answer per request, even though the column itself is absent from the file.

## Row-level permissions

`rowLevelPermissions` scopes within a role rather than instead of it. Each operation may carry a server-side `when` predicate that is appended as a filter to every record-returning request; the role gate runs first, and the predicate then narrows what that role sees.

<!-- sovrium:options RowLevelPredicateSchema -->

`field` may be a relation chain such as `project.client_id`, and `value` may be a literal or a reference resolved per request from the caller's session.

```yaml
rowLevelPermissions:
  read:
    when:
      field: client_id
      operator: in
      value: { kind: currentUser, path: { kind: assignment, tableSlug: clients } }
  write:
    when:
      field: client_id
      operator: in
      value: { kind: currentUser, path: { kind: assignment, tableSlug: clients } }
```

## Resource and action permissions

A broader permission context — the admin surface, an API key — is expressed as a map of resource to allowed actions, where `*` means every action.

```yaml
users: [read, list]
posts: [create, read, update, delete]
analytics: ['*']
```
