# API Keys

> A credential a script can hold — minted by a signed-in user, presented in one header, and carrying that user's role live.

A session cookie suits a browser and nothing else. When a script, a CI job or a service has to call your instance, it needs a credential it can hold.

Keys are off by default. One boolean turns them on.

```yaml
auth:
  strategies:
    - type: emailAndPassword
  apiKeys: true
```

`apiKeys` mounts the key endpoints and makes `x-api-key` a valid credential on every auth-gated route. Absent — the default — the surface does not acknowledge its own existence: the endpoints answer **404**, and an `x-api-key` header is simply ignored.

## Authenticating with a key

```bash
curl -H "x-api-key: $SOVRIUM_API_KEY" \
  http://localhost:3000/api/tables/notes/records
```

**`Authorization: Bearer` authenticates nothing.** Exactly two credential forms are accepted: the session cookie and `x-api-key`. A valid key presented as a bearer token resolves no session and answers `401` — a deliberate contract, so a long-lived credential travels on exactly one audited path rather than two. When a request that should work answers `401`, check the header name first.

## Minting, listing and revoking

Four endpoints, each scoped to the calling session: a user manages **their own** keys and nobody else's.

| Method | Path                       | Body or query             | Does                                             |
| ------ | -------------------------- | ------------------------- | ------------------------------------------------ |
| `POST` | `/api/auth/api-key/create` | `{ "name": "CI deploy" }` | Mints a key; the response carries the value once |
| `GET`  | `/api/auth/api-key/list`   | —                         | Lists the caller's keys, metadata only           |
| `GET`  | `/api/auth/api-key/get`    | `?id=<keyId>`             | Reads one of the caller's keys back by id        |
| `POST` | `/api/auth/api-key/delete` | `{ "keyId": "<keyId>" }`  | Revokes a key                                    |

### Shown once, then never again

Only the create response carries the plaintext value. Listing and reading describe a key — id, name, timestamps — but never re-issue it under any field name, **because the server does not have it**: the stored column holds a digest, not the credential.

Somebody who can read your database still cannot authenticate with what they find there. Lose the value and the remedy is to revoke and mint a new one.

Revocation is a **deletion** rather than a flag: the row is removed, and the identical request that succeeded a moment earlier answers `401`.

Give each key the name of the job that will carry it. Names are how you tell, six months later, which key belongs to the CI pipeline and which to the reporting script you decommissioned.

## What a key is allowed to do

A key carries the role of the user who minted it, **resolved live on every request** rather than frozen at creation.

- A member's key does exactly what that member can do, and never more.
- Promote or demote the owner and their existing keys follow immediately. Demoting somebody narrows every key they hold without invalidating any of them.
- A caller cannot widen their own key: supplying a permissions payload to the create endpoint does not produce an escalated key, because the grant is a function of who asked rather than of what they asked for.

That is why a key needs no permission configuration of its own. It is a second way to present an identity you already have, not a new identity.

### A ban suspends a key; lifting it restores them

Banning a user stops their keys authenticating immediately, on every route. The key rows survive untouched, so lifting the ban restores the same keys — which matters because a temporary ban clears on its own once it expires, and destroying the credentials would make that expiry meaningless.

No expiry is set on a key itself: it stays valid until revoked or its owner is banned. Treat one as you would a password — scope it to a job, store it in a secret manager, and revoke it when the job ends.

## Not the same thing as a connection

Two features involve something called an API key, and they point in opposite directions.

|                      | API keys — this page                     | Connections                                 |
| -------------------- | ---------------------------------------- | ------------------------------------------- |
| Direction            | **Inbound** — credentials Sovrium issues | **Outbound** — credentials Sovrium presents |
| Who is authenticated | A caller, to your instance               | Your instance, to a third-party service     |
| Declared in          | `auth.apiKeys`                           | the `connections` block                     |

Turning one on says nothing about the other.
