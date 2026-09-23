# Troubleshooting: Auth, Email & MCP

> The warnings and errors that appear once Sovrium is running — signing keys and stored credentials the current encryption key cannot read, email and AI disabled when the config needs them, and MCP refusing to start over a retired credential variable.

Once the server boots, the next class of problem comes from the services layered on top. These are the ones that most often surprise people — the first two because they are warnings rather than failures, so the app looks healthy while something quietly does not work, and the MCP ones because they are the opposite: a hard refusal to start, on a variable that used to be correct.

## Auth: "JWT signing keys could not be read"

```text
⚠ 2 JWT signing keys could not be read with the current auth secret and were
  regenerated — previously issued tokens are no longer valid
⚠ 5 stored connection tokens encrypted with a different key — affected users
  must reconnect
```

Two warnings, one cause: the encryption key changed between this start and the last one. Unless you set `AUTH_SECRET` yourself it is derived from that key, so a new key rotates the signing secret as well, and everything sealed under the old one stops opening.

Almost always the key was never persisted in the first place. Read the line above them in the same banner:

```text
✓ Encryption key: generated at /var/lib/sovrium/encryption-key
```

`generated at` on a restart — where a settled install says `from` — means the data directory did not survive, so the key is new on every boot while the database keeps the old ciphertext. That is the ephemeral-filesystem shape: a container with no volume, or a platform that rebuilds the filesystem on each deploy. Pin `SOVRIUM_ENCRYPTION_KEY` to a fixed value and it stops recurring.

The two are handled differently on purpose. A signing key is derived material, so Sovrium regenerates it and the only cost is that already-issued tokens no longer verify. A connection token is a delegated credential to somebody's third-party account, so it is left exactly as it is and reported instead. Those users reconnect the integration themselves; nothing is discarded on their behalf.

**Adopt the key before you drop the variable.** Removing `SOVRIUM_ENCRYPTION_KEY` from a working deployment produces exactly these warnings, because the next start finds no key file and generates one. Run `sovrium secret adopt` first — it persists the key you already have, so removing the variable changes nothing.

## "Email sending disabled — SMTP not configured"

```text
⚠ Email sending disabled — SMTP not configured (set SMTP_HOST to enable)
```

A **warning, not a failure** — and the more dangerous for it. The app boots and a magic-link request still returns 200. The message is composed and then dropped, so the link never arrives and the flow looks broken from the user's side only.

### When it appears

The warning is **gated on the configuration**: it prints only when email is load-bearing, meaning the app declares something that cannot work without a transport. That is one of four things:

- a `magicLink` strategy, where the message _is_ the credential;
- email OTP — the `auth.emailTemplates.emailOtp` template, whose presence mounts the flow;
- `emailAndPassword` with `requireEmailVerification: true`, which holds a new account until it has verified;
- an `email` automation action.

An app declaring none of them boots silently, because there is nothing to warn about. In particular a **bare `emailAndPassword` app is not warned**: passwords still work without a transport, and the recovery flow that would need one is not half-broken but absent — the forgot-password and reset-password routes are not mounted, and the recovery link is pruned from the sign-in card. Nothing is offered that cannot be delivered.

### Where an undeliverable message goes

In **development**, the message is written to the journal instead of being discarded, so the link you need in order to click it is in the terminal you are already watching:

```text
14:02:11 [email] Email not sent — SMTP not configured (set SMTP_HOST to enable); the message follows
14:02:11 [email] To: admin@example.com
14:02:11 [email] Subject: Reset your password
14:02:11 [email] Link: http://localhost:3000/reset-password?token=…
```

The body follows the headline as well, and one `Link:` row is printed per link the message carries — the URL being the one part nobody can reconstruct by hand.

In **production** you get a single line and nothing else:

```text
Email sending disabled (SMTP not configured) — skipped sending to "admin@example.com" with subject "Reset your password"
```

No body, no links. A reset link is a bearer credential, and a production log is shipped, retained, and read by people who are not the developer — writing one there would hand account takeover to anyone holding log access.

### Enabling delivery

Set `SMTP_HOST` and its companions:

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587          # default
SMTP_USER=apikey
SMTP_PASS=<secret>
```

See **Environment Variables** for the full set, and **Email Integration** for provider setup. Anything with email verification or password reset should be tested against a real SMTP host before it ships.

## "AI disabled — AI_PROVIDER not set"

```text
⚠ AI disabled — AI_PROVIDER not set (agents are inert, ai-* fields fall back to their baseline)
```

The same shape as the email warning, and gated the same way. It prints only when the configuration actually **uses** AI — an `ai-*` field on a table, an `agents` entry, an `ai` automation action, or an AI component on a page — and `AI_PROVIDER` is unset. An app with no AI surface boots without it, because nothing is degraded.

The warning names both consequences on purpose. "AI disabled" alone would leave you to guess what stopped: agents do not run at all, while an `ai-*` field keeps serving its baseline value rather than erroring. Set `AI_PROVIDER` to restore both — see **AI Providers**.

`ECO_AI_PROVIDER_PRECEDENCE=local-only` with an unreachable Ollama refuses the boot — but only for an app that uses AI. A plain marketing site on the same host still starts, because a precedence it never consults cannot fail it.

## MCP: "the MCP static tokens were removed"

```text
MCP_TOKEN_ADMIN is set, but the MCP static tokens were removed. They had no user
identity, so the row-level user_access tier never ran for a token-authenticated
caller. Issue an API key instead (app.auth.apiKeys) and present it on the
x-api-key header, then unset MCP_TOKEN_ADMIN.
```

`MCP_TOKEN_ADMIN`, `MCP_TOKEN_MEMBER` and `MCP_TOKEN_VIEWER` no longer exist. If your instance still sets one and `MCP_ENABLED=true`, the server **refuses to start** — deliberately. Ignoring the variable would be worse: you would believe `/mcp` is guarded by the secret you issued, when it is guarded by something else entirely.

The fix is three steps. First, remove the retired variables:

```bash
unset MCP_TOKEN_ADMIN MCP_TOKEN_MEMBER MCP_TOKEN_VIEWER MCP_AUTH_STRATEGY
```

Second, make sure the app has auth, with self-service keys enabled:

```yaml
name: my-app
auth:
  strategies:
    - type: emailAndPassword
  apiKeys: true
```

Third, sign in as the user whose role the client should inherit, mint an API key, and send it on the **`x-api-key`** header — not `Authorization: Bearer`.

The role is no longer baked into the credential: a key acts as **its owner**, resolved live on every call. Demote that user and every key they hold narrows with them; ban them and the keys stop working. That is what the static tokens could not do — carrying no user, they never triggered row-level record rules at all.

## MCP: "MCP_AUTH_STRATEGY=token names a strategy that no longer exists"

```text
MCP_AUTH_STRATEGY=token names a strategy that no longer exists. /mcp now
dispatches on the header a request carries: x-api-key is verified as an API key,
Authorization: Bearer as an OAuth access token. Unset MCP_AUTH_STRATEGY (oauth2
is still accepted as a deprecated no-op).
```

There is no strategy to choose any more. `/mcp` decides which verifier to use from the header the request actually presents, so both credentials are live at once — a desktop client on OAuth and a CI job holding an API key can call the same instance.

Unset the variable. `MCP_AUTH_STRATEGY=oauth2` is still accepted so a correct config is not punished, but it selects nothing and will be removed.

## MCP: "MCP_ENABLED=true requires app.auth"

```text
MCP_ENABLED=true requires app.auth to be configured. Both MCP credentials — API
keys and OAuth access tokens — are Better Auth plugins, so without app.auth
nobody can authenticate to /mcp. Either configure app.auth or unset MCP_ENABLED.
```

Both surviving credentials are issued by the auth layer, so an app with no `auth` block gives nobody a way in. Mounting `/mcp` there would leave a route that is either unreachable or unguarded, so the boot stops instead. Add an `auth` block, or leave `MCP_ENABLED` off.

All three refusals are scoped to `MCP_ENABLED=true`. A leftover `MCP_TOKEN_*` on an instance that never mounts `/mcp` authorizes nothing, so it does not fail the boot — failing a whole app over an inert string would be hostile.

## Still stuck?

- Run `sovrium validate <config>` to check the configuration on its own.
- An unhandled failure prints `Unexpected failure — Sovrium changed nothing.` with a message and an issue link. That banner is a crash marker: Sovrium reached a failure it has no specific handling for. A rejected config never lands here — it is refused earlier, with its own message. Copy the detail line into the report.
- Open an issue or a discussion at `https://github.com/sovrium/sovrium`.

## Related reading

- **Troubleshooting: Startup & Config** — errors before the server is up.
- **Environment Variables** — every variable Sovrium reads.
- **Security Hardening** — secrets, rotation, and deployment posture.
- **MCP Integration** — connecting an MCP client end to end.
