# Assignments & Landing Guards

> The token that resolves which records a user may reach, and the page that stops an anonymous visitor before the landing resolver ever runs.

Post-login landing routes a session to the right page. Two mechanisms make that routing _correct_.

## The assignment token

`$currentUser.assignments.<table>` resolves to the set of record ids from the user's access rows for a table declared in `scopeTables`. It appears in two forms, and they behave differently.

### Indexed, in a landing URL

The single-record form substitutes the **first** assignment id, producing a deep link straight to that record.

```yaml
roles:
  - name: customer-admin
    defaultLanding: /portal/clients/$currentUser.assignments.clients[0]
    pickerLanding: /portal/select/clients
```

A role may carry **at most one** such token: with two, the resolver cannot infer which scope to count against. A picker landing must carry **none**, since by definition the multi-record case has no single id to substitute. Both rules are enforced when the configuration is decoded.

### Un-indexed, in a data-source filter

The bare form resolves to the full id list, so a picker page lists exactly the records the user can reach and no others.

```yaml
pages:
  - name: client-picker
    path: /portal/select/clients
    access: authenticated
    components:
      - type: list
        props: { id: clients }
        dataSource:
          table: clients
          filter:
            - field: id
              operator: in
              value: $currentUser.assignments.clients
        children:
          - type: text
            content: $record.name
```

A grant carries a role, so the token can name one: `$currentUser.assignments.clients.customer-admin` resolves to the records granted under `customer-admin` only, leaving out those the same person holds under another role. The structured form takes the same `role` beside `tableSlug`. A role no grant is made under resolves to no records here; in a row rule, a role `auth.roles` does not declare is refused before the app starts.

This is what makes the picker safe to expose: the filter is resolved **server-side** from the session, so a user cannot widen it by editing a request.

## Managing access grants

The access rows behind the token are grants: an account, the records of one table listed in `scopeTables`, and a role from `auth.roles`. A table listed in `scopeTables` is keyed by a generated text id rather than a number, so one column can name records of any of them; every records route that addresses one record — reading, updating and deleting it, a batch update naming ids in its body, the update an edit form posts without scripts — takes that text id as it takes a number on any other table.

An admin manages grants through `/api/tables/user_access/records`:

| Request                                      | Does                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `POST /api/tables/user_access/records`       | Mints a grant: `{ fields: { user_id, table_slug, record_ids, role } }`, answered `201`                 |
| `GET /api/tables/user_access/records`        | Lists grants, oldest first — narrowed by `?user_id=`, `?user_email=`, `?table_slug=` and `?record_id=` |
| `GET /api/tables/user_access/records/:id`    | Reads one grant                                                                                        |
| `PATCH /api/tables/user_access/records/:id`  | Changes a grant's `record_ids`, its `role`, or both                                                    |
| `DELETE /api/tables/user_access/records/:id` | Revokes a grant, answered `204`                                                                        |

The filters combine: `?user_email=` names an account by its address, matched without regard to case, and an address no account holds lists nothing; `?table_slug=&record_id=` answers who holds access to one record. Each listed grant also reads back, without a second request, `user_email` and `user_name` for its account — both absent when the grant names an account that no longer exists — and `record_labels`, one label per entry of `record_ids` in the same order: the value of the table's first `single-line-text` field that is not `writeOnly` (a write-only value is never read back, not even to an admin), or the record id itself when the table has no such field, the value is empty, or no record has that id. These three are computed when the list is read; a write never accepts them. On an app that lists no `scopeTables`, an admin's listing is empty, and minting a grant is answered `404`.

A change is validated as a new grant is — `record_ids` names at least one record, `role` is declared — and keeps the grant's account and table: a body naming `user_id` or `table_slug` is refused, because moving access to someone else is a revocation and a new grant. A revoked grant is erased, not hidden. Whatever changes, the account reads what its grants now name on its next request, and its open realtime connections are closed so that they reconnect under the grants as they now stand.

Every one of these routes is for an admin-equivalent role only: anyone else — the grant's own holder included — is answered `404`, as if the grant did not exist, and nothing changes. An automation can grant, revoke and list them too, through the `auth` actions.

### Seeding grants

`sovrium seed` gives an account its grants from `seed/users.yaml`, naming the records with the same `@<table>.<key>` references a table seed file uses:

```yaml
# seed/users.yaml
users:
  - email: nadia@quayside.example
    name: Nadia Benali
    role: member
    grants:
      - table: projects
        records: ['@projects.harbour-refit', '@projects.quay-lighting']
        role: client
```

Each grant names one table listed in `scopeTables`, at least one record of that table, and a role the app declares. A record written as a reference into another table, or as a bare id, is refused when the file is read; a key no seed file defines, a table that is not a scope table, or an undeclared role is refused before anything is written, naming the account. Grants are written after the tables, once every key has an id. A run restricted with `--table` writes the grants over the tables it seeds and leaves the others alone, and a replay in `upsert` mode leaves each grant once.

## The mount path's page is the access guard

`landingPath` must be backed by a page declared at the same path. That page is the unauthenticated-access guard: its access block bounces an anonymous visitor to the sign-in page before the landing resolver runs. For an authenticated visitor the resolver redirects away first, so the page itself is typically empty and never renders.

```yaml
auth:
  landingPath: /portal

pages:
  - name: portal-landing
    path: /portal
    access:
      require: authenticated
      redirectTo: /login
    components: []
```

**Forgetting that page is the most common mistake here.** A mount path with no page behind it leaves an anonymous visitor unguarded at exactly the URL the whole mechanism points at. Always pair the two.

The collision between a page path and the mount path is the **mechanism**, not a conflict to avoid: the colliding page is required.
