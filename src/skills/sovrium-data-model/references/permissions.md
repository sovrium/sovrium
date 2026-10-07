# Permissions

## Contents

- Start from deny
- The three layers
- Roles
- Table permissions
- Field permissions
- Row-level permissions
- The 404 rule
- Precedence in one paragraph
- Bucket permissions
- Testing permissions
- Common mistakes

Manual: `sovrium docs tables/table-permissions`, `sovrium docs auth-access/auth-roles-rbac`, `sovrium docs auth-access/auth-groups`, `sovrium docs buckets/buckets-permissions`.

## Start from deny

Sovrium's table and bucket defaults are open, so a safe app is one where every table and every bucket says who may do what.

- **Write a `permissions` block on every table**, even one you think is internal. A table with no block stays open to every role except `viewer` — custom roles included.
- **Set `auth.allowSignUp: false` for an internal tool or a customer portal.** It defaults to `true`, and every self-registered account gets the default role, so an open table plus open sign-up means anyone on the internet who fills in the form.
- **Declare `upload` and `delete` on every bucket** (see Bucket permissions below).
- Widen deliberately, one operation and one role at a time, and test each widening.

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
- **A table with no permissions block** (or one that only sets `fields`) stays open to every non-viewer role, custom roles included. Write the block (see Start from deny).

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

A signed-in caller who is refused gets **404**, never 403, so nobody can map what exists by probing. That covers reads, writes, deletes and queries. A `PATCH` that answers 404 does not mean the record is gone; it may be visible and not writable. Treat 404 as the expected result of every denial you test.

A caller with **no session and no API key** gets **401** on the records API instead (unless the table grants that operation to `all`). A 401 only says "sign in first" and carries no signal about whether anything exists, so it does not break the rule. Expect:

- No credential → `401` (or `200` where the operation is `all`).
- A credential, operation not granted → `404`.
- Never `403`.

## Precedence in one paragraph

Is the caller an admin? Then the table rules do not stop them (permanent delete included). Otherwise: does the table allow this operation for the caller's role? If not, 404. If yes, the row predicate filters which rows are in scope, and field rules remove the columns the role may not read or write. What remains is the answer.

## Bucket permissions

Files follow their own block on each bucket, with the same three value shapes. Its defaults are open in a different way (`sovrium docs buckets/buckets-permissions`):

- An undeclared `upload` or `delete` lets **any signed-in user** write or delete files in that bucket, whatever their role. Declare both, usually to a role list.
- `public: true` opens **downloads** to everyone and nothing else; uploads and deletes keep their gate.
- One carve-out: in an app with **no `auth` block**, a public bucket accepts anonymous uploads. Do not add `public: true` to a bucket on such an app unless anonymous uploads are the intent.
- Signed links (`sign`, `signUpload`) are admin-only until declared; `sign: all` lets anyone mint one.

## Testing permissions

For every table whose permissions you changed:

```
- [ ] Anonymous GET /api/tables/<t>/records   → 401, or 200 only where read: all
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
- Leaving `allowSignUp` at its default on an internal tool.
- A bucket with no `upload`/`delete` declared, so any signed-in user can delete its files.
- Hiding rows with a page filter instead of a row predicate.
- One role per person.
- Reporting a correct 404 as a bug.
