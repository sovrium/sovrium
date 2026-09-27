# Permissions

## Contents

- The three layers
- Roles
- Table permissions
- Field permissions
- Row-level permissions
- The 404 rule
- Precedence in one paragraph
- Testing permissions
- Common mistakes

Manual: `sovrium docs tables/table-permissions`, `sovrium docs auth-access/auth-roles-rbac`, `sovrium docs auth-access/auth-groups`.

## The three layers

1. **Table**: who may `read`, `create`, `update`, `delete`, `comment` on a table.
2. **Field**: who may read or write one column, inside what the table allows.
3. **Row**: which rows a role sees or may change, as a server-side predicate appended to every query.

## Roles

- Built-in roles, highest to lowest: `admin`, `member`, `viewer`.
- Your own roles go under `auth.roles`, each with a level that decides what it inherits.
- Name roles after **job functions** (`sales`, `accounting`, `support`), never after people. People change jobs; the config should not.
- Give the fewest roles that express real differences. Two roles with identical permissions are one role.

## Table permissions

Each operation takes `all` (everyone, including anonymous visitors), `authenticated` (any signed-in user), or a list of role names.

```yaml
permissions:
  read: authenticated
  create: [admin, sales]
  update: [admin, sales]
  delete: [admin]
```

Two rules decide more than any other:

- **Declaring any operation closes every operation you leave out** to non-admins. A half-written block fails closed.
- **A table with no permissions block** (or one that only sets `fields`) stays open to every non-viewer role. If that is not what you mean, write the block.

Permanent (irreversible) delete is admin-only on every table and cannot be granted.

## Field permissions

```yaml
permissions:
  read: authenticated
  fields:
    - { field: salary, read: [admin, hr], write: [admin] }
```

- An omitted field audience inherits from the table (`read` from `read`, `write` from `create` and `update`).
- Use field rules to **narrow**: hide `salary` from people who can read the rest of the row. Do not use them to widen access beyond the table; put a wider audience on the table, or split the table.
- A field a role cannot read is also not filterable, groupable or aggregatable by that role; those queries answer `404`, and the field is absent from responses and exports.

## Row-level permissions

`rowLevelPermissions` narrows **within** a role: the role gate runs first, then a `when` predicate filters which rows that role sees or writes. The value can come from the caller's session (their own id, their assignments).

Declare it **once, on the table**. A page filter that hides other people's rows is presentation, not security: the API still answers.

## The 404 rule

An unauthorised read, write or query answers **404**, never 403, so a caller cannot map what exists by probing. A `PATCH` that answers 404 does not mean the record is gone; it may be visible and not writable. Treat 404 as the expected result of every denial you test.

## Precedence in one paragraph

Is the caller an admin? Then the table rules do not stop them (permanent delete included). Otherwise: does the table allow this operation for the caller's role? If not, 404. If yes, the row predicate filters which rows are in scope, and field rules remove the columns the role may not read or write. What remains is the answer.

## Testing permissions

For every table whose permissions you changed:

```
- [ ] Anonymous GET /api/tables/<t>/records   → 401 or 404 unless read: all
- [ ] Lowest intended role: sees only its rows and only its fields
- [ ] A role that should not write: POST / PATCH → 404
- [ ] A hidden field: absent from the JSON, and ?filter on it → 404
- [ ] Admin: sees everything
- [ ] The same checks in the browser as that role (a table on a page, a record page)
```

Create test users per role; sign in as each (see `sovrium-app`, `references/api-checks.md`).

## Common mistakes

- Treating "logged in" as authorisation (`read: authenticated` on payroll).
- Leaving a table with no block and assuming it is admin-only.
- Hiding rows with a page filter instead of a row predicate.
- One role per person.
- Reporting a correct 404 as a bug.
