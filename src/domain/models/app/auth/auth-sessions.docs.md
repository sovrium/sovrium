# Sessions

> The server-managed session a successful sign-in issues, the endpoints that inspect and revoke it, and the active-scope cookie a multi-tenant app adds on top.

Authenticating issues a session: an `httpOnly` cookie backed by a row in the auth schema. Sessions are inspectable, listable and revocable through the API.

## Session lifetime is not schema

Core session behaviour — lifetime, refresh window — is managed at the authentication-server level rather than in the app configuration. There is no session block to write.

| Concern                      | Lives in                                                       |
| ---------------------------- | -------------------------------------------------------------- |
| Session lifetime and refresh | The auth server's defaults, not exposed in the app schema      |
| Signing and encryption       | `AUTH_SECRET`, or a value derived from the root key when unset |
| Cookie security              | The bind address — see below. Not `NODE_ENV`                   |

Changing the signing secret invalidates **every** active session and signs every user out. That happens when you rotate the secret, when you set one for the first time, and when the root key it derives from changes. Treat it as a credential and rotate deliberately.

### What decides whether the session cookie is `Secure`

The address the app is reachable at, not an environment name. Bound to loopback, the cookie omits `Secure` and origin-checking is off, so `http://localhost` works while you develop. Bound to anything else — which the app reads from `BASE_URL`, then `HOSTNAME` — `Secure` is forced on and origin-checking is enforced.

Two consequences follow, and both cut against the usual expectation. Setting `NODE_ENV=production` does not harden the session cookie, because nothing in this decision reads it. And the wildcard binds `0.0.0.0` and `::` are deliberately _not_ treated as loopback: they are every interface the machine has, which is the most exposed bind there is, so the ordinary container idiom keeps the hardened posture.

## Inspecting and ending a session

These endpoints mount automatically once authentication is configured.

| Method | Endpoint                          | Does                                                 |
| ------ | --------------------------------- | ---------------------------------------------------- |
| `GET`  | `/api/auth/get-session`           | Returns the current session and user, or a null body |
| `GET`  | `/api/auth/list-sessions`         | Lists the authenticated user's own active sessions   |
| `POST` | `/api/auth/sign-out`              | Invalidates the current session                      |
| `POST` | `/api/auth/revoke-session`        | Revokes one session by id                            |
| `POST` | `/api/auth/revoke-other-sessions` | Revokes every session except the current one         |

Three behaviours worth relying on:

- `get-session` returns a **null body rather than an error** when unauthenticated or after sign-out, so a client can poll it to render auth state without treating the unauthenticated case as a failure.
- `list-sessions` is session-isolated: a user only ever sees their own.
- `sign-out` is **idempotent** — calling it without a session, or twice, still succeeds.

## Active-scope sessions

An app that scopes data per tenant uses an access junction, where one user can hold several access rows for the same table — a fractional finance director assigned to three client companies. The active-scope API lets that user pick which assignment is currently in context, persisted in a per-table cookie and resolved by `$currentUser.activeAssignment`.

```yaml
auth:
  strategies:
    - type: emailAndPassword
  roles:
    - name: customer-admin
  scopeTables: [clients]
  landingPath: /portal
```

`scopeTables` is a non-empty array of table names with no duplicates, validated against the app's own tables at startup. There is nothing else to configure: the endpoints mount for every entry.

| Method   | Path                                   | Does                                                                       |
| -------- | -------------------------------------- | -------------------------------------------------------------------------- |
| `POST`   | `/api/session/active-scope/:tableSlug` | Sets the cookie when the record is in the user's access rows; `403` if not |
| `GET`    | `/api/session/active-scope/:tableSlug` | Returns the current scope, or null when unset                              |
| `DELETE` | `/api/session/active-scope/:tableSlug` | Clears the cookie                                                          |

A table slug outside `scopeTables` answers `404`.

### Why the cookie is safe to trust

One cookie per scope table, `httpOnly` and `SameSite=Lax`, so it is not readable by client JavaScript. Unlike the session cookie above, this one takes its `Secure` attribute from `NODE_ENV=production` rather than from the bind address — so on a public deployment that does not set `NODE_ENV`, set it, or the two cookies on the same request disagree about whether the connection can be trusted.

Beyond that, **every write and every read is re-validated server-side**. A write verifies the record is in the user's access rows before setting anything; a read re-checks the cookie against those rows when resolving the token, and discards a tampered, stale or now-revoked value in favour of the user's first accessible record.

That is what makes context-switching safe without re-authenticating: the cookie is a _preference_, and the access rows remain the authority.

`$currentUser.activeAssignment` is consumable in data-source filters and in row-level permission predicates, so every assignment-bound view refreshes when the active scope changes.
