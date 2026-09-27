# API checks

## Contents

- What to check after a change
- Discovering the routes
- Records endpoints and expected answers
- Authenticating
- curl templates
- Reading a surprising answer

## What to check after a change

For every table your change touched, call its records endpoint at least twice: once as a role that should see the data, once as a role (or anonymous caller) that should not. For every automation you touched, see the automations skill. For pages, the browser pass already covers the HTML.

## Discovering the routes

- `sovrium docs records/records-overview` — every records route and what it does.
- `sovrium docs platform-apis/openapi` — the OpenAPI documents.
- `GET /api/openapi.json` (application API) and `GET /api/auth/openapi.json` (authentication) exist **only when the app configures `auth`**, and answer only an **admin**: `401` without a session, `404` for a signed-in non-admin, `200` for an admin. `/api/scalar` is the interactive explorer over both, same rule.

## Records endpoints and expected answers

`:tableId` accepts the numeric table id or the table name. Write bodies use the `{ "fields": { … } }` envelope.

| Call                                            | Success                                                      | Expected failures                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `GET /api/tables/:tableId/records`              | `200`                                                        | `401` no session where one is required; `404` table unknown or not readable by this caller |
| `GET /api/tables/:tableId/records/:recordId`    | `200`                                                        | `404` absent **or** invisible to this caller — indistinguishable on purpose                |
| `POST /api/tables/:tableId/records`             | `201`                                                        | `400` missing or invalid value; `404` table not writable; `409` unique value already taken |
| `PATCH /api/tables/:tableId/records/:recordId`  | `200`                                                        | `400`; `404` absent, invisible, or visible but not writable; `409` stale `updatedAt` token |
| `DELETE /api/tables/:tableId/records/:recordId` | `204` (soft delete; `200` when a cascade rewrote dependants) | `400` a restrict policy blocked it; `404`                                                  |

Fields a caller may not read are omitted from the response, so the same record answers with different keys for different roles. Filtering, grouping or aggregating on a field the caller may not read answers `404`.

Read `sovrium docs records/records-crud` and `sovrium docs tables/table-permissions` before calling a `404` a bug.

## Authenticating

Two credential forms work on `/api/*`:

- **A session cookie.** Sign in through the app's sign-in page in the browser, or with `curl` and a cookie jar against the email sign-in endpoint of the auth API.
- **An API key** in the `x-api-key` header, when the app sets `auth.apiKeys`. A key carries its creator's role. `Authorization: Bearer` is not accepted on these routes.

Create the first admin with `sovrium admin create <email>`. Never paste a real credential into a transcript or a commit; read it from the environment.

## curl templates

```bash
BASE=http://localhost:3000   # the URL sovrium start printed

# Anonymous: expect 401 or 404 on a private table, 200 on a public one
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/tables/contacts/records"

# Sign in as a test user and keep the session cookie
curl -s -c /tmp/sovrium.jar -H 'content-type: application/json' \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  "$BASE/api/auth/sign-in/email" > /dev/null

# Read as that user
curl -s -b /tmp/sovrium.jar "$BASE/api/tables/contacts/records?limit=5"

# Or with an API key
curl -s -H "x-api-key: $SOVRIUM_API_KEY" "$BASE/api/tables/contacts/records?limit=5"

# Create, then read back
curl -s -b /tmp/sovrium.jar -H 'content-type: application/json' \
  -d '{"fields":{"email":"ada@example.com","name":"Ada Lovelace"}}' \
  "$BASE/api/tables/contacts/records"

# The OpenAPI document, as an admin
curl -s -H "x-api-key: $SOVRIUM_ADMIN_API_KEY" "$BASE/api/openapi.json" -o app.openapi.json
```

## Reading a surprising answer

| You got                               | Likely meaning                                                                  | Do                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `404` on a table you just added       | The server has not restarted onto the new config, or the caller may not read it | Check what `sovrium start --watch` printed; retry as admin           |
| `404` for one role, `200` for another | Permissions working as written                                                  | Compare with the permissions you intended                            |
| `401`                                 | No session or key was sent                                                      | Re-run sign-in; check the cookie jar path                            |
| `400` with a field name               | Value fails the field's type or a required field is missing                     | Read the message; check `sovrium docs config tables[].fields[].type` |
| `409` on create                       | A unique field already holds that value                                         | Use a different value, or the upsert endpoint                        |
| A key missing from the JSON           | Field-level read permission hides it from this caller                           | Expected; test with the role that should see it                      |
