# User Management

> Where the first administrator comes from on a fresh database, and the admin API every later user passes through.

Users are provisioned and managed without ever touching the database. Each operation is role-gated and audit-logged, and the whole surface exists only when authentication is configured — there is no separate flag.

## Where the first admin comes from

It cannot be created by another admin, because there is none, and it must not come from self-registration, because a stranger would claim the seat. Three complementary paths provision that account.

| Path                  | For                                      | Mechanism                                                             |
| --------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| Environment variables | Automated deploys                        | An email and password applied on first boot                           |
| One-time token        | Deploys that keep credentials out of env | A token printed once in the startup banner and claimed once over HTTP |
| CLI                   | Interactive provisioning                 | `sovrium admin create <email>`, with no configuration file required   |

### The environment-variable path

```bash
AUTH_ADMIN_EMAIL=admin@example.com
AUTH_ADMIN_PASSWORD=SecureP@ssw0rd!
AUTH_ADMIN_NAME=System Administrator
```

On first boot against a fresh database the admin is provisioned with a verified address and full access. The name is optional and defaults to "Administrator"; the password must meet the minimum length.

On later startups the path **no-ops**. It never creates a duplicate and never modifies an existing user, even where the address already maps to a different role — so leaving the variables set in a deployment is safe. Success is logged without the password.

The path is gated on a configured auth block, and is a no-op once any user exists.

### The one-time token

Booting with no admin email set **and** no users in the database generates a 256-bit token, prints it once in the startup banner, and accepts a single claim.

```bash
curl -X POST http://localhost:3000/api/admin/bootstrap/claim \
  -H 'Content-Type: application/json' \
  -d '{ "token": "<64-hex-token>", "email": "admin@example.com", "password": "SecureP@ssw0rd!", "name": "Admin" }'
```

Three properties make the window safe to leave open:

- Only the **hash** is persisted; the plaintext is printed to stdout exactly once and never logged.
- The token expires after an hour and can be claimed **once** — a replay answers `401`.
- Once any admin exists the route answers **404**, so even a leaked valid token cannot reopen the window.

This is the path that makes "run the binary on a fresh server, open the URL, build the app live" possible.

## The admin API

Every user-lifecycle operation runs through it. Each endpoint needs an authenticated admin session: an unauthenticated request answers `401`, and a non-admin session answers `404` — the admin surface is invisible to anyone who cannot use it, so its existence is not discoverable.

| Operation      | Endpoint                                   | Notes                                                         |
| -------------- | ------------------------------------------ | ------------------------------------------------------------- |
| Create user    | `POST /api/auth/admin/create-user`         | You choose the password, and **no email is sent**             |
| List users     | `GET /api/auth/admin/list-users`           | Paged, with count metadata and search by email or name        |
| Get user       | `GET /api/auth/admin/get-user/:id`         | Role, ban status and verification flag; `404` for unknown ids |
| Set role       | `POST /api/auth/admin/set-role`            | A built-in or a declared custom role                          |
| Set password   | `POST /api/auth/admin/set-user-password`   | Resets a password administratively                            |
| List sessions  | `GET /api/auth/admin/list-user-sessions`   | A user's active sessions                                      |
| Revoke session | `POST /api/auth/admin/revoke-user-session` | Force-logout of one session                                   |
| Impersonate    | `POST /api/auth/admin/impersonate-user`    | Starts and stops impersonation for support                    |

### What the server refuses

Creating a user answers `400` for a missing or malformed address, a missing password, or an address that already exists.

An assigned role must be one the app knows about — a built-in, an operator role, or a name declared in the roles array — and anything else is refused with the valid roles listed, rather than stored verbatim.

A role change that would remove the last admin able to sign in is refused outright. That refusal is the one worth knowing about before you need it: it is what stops a routine demotion from locking everybody out of the instance.

## Creating a user is not onboarding one

`create-user` requires you to invent the password and transmit it yourself, and sends the person nothing. For onboarding a real human, issue an invitation instead — it lets them set their own password and never puts a credential in a chat message.
