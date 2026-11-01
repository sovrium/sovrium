# API Keys

> A credential a script can hold: minted by a signed-in user, presented in one header, and carrying that user's role live.

A session cookie suits a browser and nothing else. When a script, a CI job or a service has to call your instance, it needs a credential it can hold.

Keys are off by default. One boolean turns them on.

```yaml
auth:
  strategies:
    - type: emailAndPassword
  apiKeys: true
```

`apiKeys` mounts the key endpoints and makes `x-api-key` a valid credential on every auth-gated route. When it is absent (the default), the surface does not acknowledge its own existence: the endpoints answer **404**, and an `x-api-key` header is simply ignored.

## Authenticating with a key

```bash
curl -H "x-api-key: $SOVRIUM_API_KEY" \
  http://localhost:3000/api/tables/notes/records
```

**`Authorization: Bearer` authenticates nothing.** Exactly two credential forms are accepted: the session cookie and `x-api-key`. A valid key presented as a bearer token resolves no session and answers `401`. This is a deliberate contract, so a long-lived credential travels on exactly one audited path rather than two. When a request that should work answers `401`, check the header name first.

## Minting, listing and revoking

Four endpoints, each scoped to the calling session: a user manages **their own** keys and nobody else's. They need the person signed in; a key can only revoke itself (see below).

| Method | Path                       | Body or query             | Does                                             |
| ------ | -------------------------- | ------------------------- | ------------------------------------------------ |
| `POST` | `/api/auth/api-key/create` | `{ "name": "CI deploy" }` | Mints a key; the response carries the value once |
| `GET`  | `/api/auth/api-key/list`   | —                         | Lists the caller's keys, metadata only           |
| `GET`  | `/api/auth/api-key/get`    | `?id=<keyId>`             | Reads one of the caller's keys back by id        |
| `POST` | `/api/auth/api-key/delete` | `{ "keyId": "<keyId>" }`  | Revokes a key                                    |

### Shown once, then never again

Only the create response carries the plaintext value. Listing and reading describe a key (id, name, timestamps) but never re-issue it under any field name, **because the server does not have it**: the stored column holds a digest, not the credential.

Somebody who can read your database still cannot authenticate with what they find there. Lose the value and the remedy is to revoke and mint a new one.

Revocation is a **deletion** rather than a flag: the row is removed, and the identical request that succeeded a moment earlier answers `401`.

Give each key the name of the job that will carry it. Names are how you tell, six months later, which key belongs to the CI pipeline and which to the reporting script you decommissioned.

## What a key is allowed to do

A key carries the role of the user who minted it, **resolved live on every request** rather than frozen at creation.

- A member's key does exactly what that member can do, and never more.
- Promote or demote the owner and their existing keys follow immediately. Demoting somebody narrows every key they hold without invalidating any of them.
- A caller cannot widen their own key: supplying a permissions payload to the create endpoint does not produce an escalated key, because the grant is a function of who asked rather than of what they asked for.

That is why a key needs no permission configuration of its own. It is a second way to present an identity you already have, not a new identity.

A key is for your data, not for the account it belongs to. On the auth endpoints under `/api/auth/*`, a request authenticated by a key may do exactly two things: ask whose key it is (`GET /api/auth/get-session`), and revoke **itself** (`POST /api/auth/api-key/delete` with its own id, which `sovrium login --logout` sends). Every other auth endpoint answers a keyed request `404`, whoever owns the key, an administrator included, and changes nothing. That covers account management under `/api/auth/admin/*` (the user list, roles, bans, impersonation, invitations), every change to the organisation and its groups, and the owner's own account: a key cannot mint another key, list or revoke the owner's other keys, add a passkey, turn two-step verification on or off, change the profile, the address or the notification preferences, link or unlink a sign-in provider, end sessions, or ask for the account to be deleted. Those acts need the person signed in, so a leaked key can read and write what its owner can, but never promote an account, take one over, give itself a way back in, or remove the account. An administrator's key can still set an account's groups through `PUT /api/admin/users/:userId/groups`.

### What ends a key besides revoking it

A key outlives the session it was minted from, so the acts that shut out whoever else holds an account end its keys too:

- **A password reset** revokes every API key of the account, on top of ending every session.
- **Turning on two-step verification** revokes every API key of the account and ends every session but the one that turned it on.

A job that relied on a revoked key needs a new one, minted by the owner once signed in again.

### The owner is told when a key is added

Every time a key is added to an account (minted on the account page, through the endpoint, or redeemed by the CLI's sign-in), the account's address receives an email naming the key and saying what to do if it was not them. The email never carries the key's value. It is sent through the instance's mail settings, like the other account emails.

### A ban suspends a key; lifting it restores them

Banning a user stops their keys authenticating immediately, on every route. The key rows survive untouched, so lifting the ban restores the same keys. That matters because a temporary ban clears on its own once it expires, and destroying the credentials would make that expiry meaningless.

A key expires one year after it is minted. To give it a shorter life, send `expiresIn` with the create request, in seconds, between one day (`86400`) and one year (`31536000`); a year is the longest a key can live. An expired key answers `401` like a revoked one, so a job that needs a key for longer mints its replacement before the year is out. A key minted by a version that set no expiry keeps none until you revoke it. Treat a key as you would a password: store it in a secret manager and revoke it when the job ends. A key cannot be scoped: it always carries its owner's full, live role. To limit what a job can do, mint its key from a dedicated account created for that job, holding the lowest role that does it, never from an admin account.

## Not the same thing as a connection

Two features involve something called an API key, and they point in opposite directions.

|                      | API keys (this page)                    | Connections                                |
| -------------------- | --------------------------------------- | ------------------------------------------ |
| Direction            | **Inbound**: credentials Sovrium issues | **Outbound**: credentials Sovrium presents |
| Who is authenticated | A caller, to your instance              | Your instance, to a third-party service    |
| Declared in          | `auth.apiKeys`                          | the `connections` block                    |

Turning one on says nothing about the other.
