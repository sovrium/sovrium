# Secrets and the env block

## Contents

- Where a secret may live
- The env block
- What `$env` resolves, and what it never does
- Connections
- The two deployment secrets
- Backups
- Checks

Manual: `sovrium docs automations/automation-env-vars`, `sovrium docs automations/automation-connections`, `sovrium docs operations/security-hardening`, `sovrium docs cli-api/cli-admin`, `sovrium docs cli-api/backup-restore`.

## Where a secret may live

Only in the environment: `.env` (never committed; its names listed in `.env.example`), or the host's secret store. Never inline in the config, in a record field, in a template, in a code step's source, in a URL, or in a commit message. An inlined value is an ordinary string: run history, step outputs and the configuration views print it. A value resolved from `$env` is masked in all of them.

## The env block

Every `$env.NAME` the config uses is declared in the top-level `env` block; an undeclared one refuses to boot and to validate, and `sovrium validate` names it.

```yaml
env:
  - { key: STRIPE_SECRET, description: Stripe API secret }
  - { key: SLACK_WEBHOOK_URL, description: Slack incoming webhook, required: false }
  - { key: REGION, description: Default region, required: false, default: eu-west, secret: false }
```

- `required` defaults to `true`: a required variable with no value and no `default` stops the boot, naming the key.
- `secret` defaults to `true`: a `default` is redacted wherever the configuration is shown to an operator. Set `secret: false` only for a harmless default (a region, a port, a public URL).
- Masking skips a secret shorter than six characters inside other text. Keep real credentials six characters or longer.
- A key starting with `SOVRIUM_PLATFORM_SSO_` is refused: it would expose a platform secret to every automation.

## What `$env` resolves, and what it never does

`$env.NAME` is resolved in the configuration you wrote, before any `{{…}}` template is filled. Text arriving from outside (a webhook body, a form answer, a record field, a step's output) that contains `$env.STRIPE_SECRET` stays those characters; data can never read a secret by naming it. A code step reads variables from `context.env`, never by building a `$env.` string.

## Connections

Credentials for an external service go in a connection under the top-level `connections` list, referenced as `$connection.NAME`, with every secret value an `$env.NAME`. Stored OAuth tokens are encrypted with the encryption key and never shown in the console or an export. An app-wide OAuth connection is shared by every automation that names it, including runs no person started.

## The two deployment secrets

- **The encryption key**: `SOVRIUM_ENCRYPTION_KEY`, or the `encryption-key` file Sovrium writes in the data directory when it is unset. It protects stored connection credentials. `sovrium secret generate encryption` prints a fresh one. Lose it and stored tokens are unreadable; back it up apart from the database.
- **`AUTH_SECRET`**: the session-signing secret, derived from the encryption key unless set. Leave it unset unless you need to rotate sessions and credentials separately. A new one signs everyone out and invalidates signed links.

Rotating either has a cost (people sign in again, integrations reconnect). Plan it; do it at once after a leak.

## Backups

A `sovrium backup` archive holds every row and, when the key lives in the data directory, the key file: whoever holds it can decrypt stored credentials and, unless `AUTH_SECRET` is set separately, sign a session as any user. Encrypt archives before they leave the machine, restrict who reads them, keep them off shared drives, and test a restore.

## Checks

```
- [ ] grep the config tree for key-shaped strings (sk_, pk_, ghp_, xox, Bearer, password:) → none
- [ ] every $env.NAME in the config is declared in env → sovrium validate passes
- [ ] git ls-files | grep -E '(^|/)\.env' → only .env.example
- [ ] every env entry holding a credential keeps secret at its default
- [ ] the console's environment page lists no declared variable without a use (safe to remove)
- [ ] the encryption key exists in a second, offline place
```
