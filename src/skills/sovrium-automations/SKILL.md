---
name: sovrium-automations
description: Use when building, reviewing or debugging automations in a Sovrium app — record, webhook, cron, form, auth, comment, manual or failure triggers; http, record, email, code, loop, digest or AI actions; connections and secrets for external services; retries, timeouts, duplicate deliveries, runaway loops, failed runs, notifications and digests. Triggers include "when a record changes", "send an email when", "sync with", "call this API", "webhook", "every night", "sovrium library add recipe", "the automation fired twice", and "why did this run fail".
license: BSL-1.1
metadata:
  author: sovrium
  version: '1.0.0'
---

# Sovrium automations

A bare agent writes an automation that fires on every edit of a table, calls an API with no timeout and no idempotency key, retries a payment on any error, pastes the API key inline, sends one email per event, and calls it done after `sovrium validate` passes. The run history then fills with duplicates, loops and silent failures. An automation is a small distributed system: design it for the second delivery, the slow dependency and the failure you did not expect.

Run the core loop from `sovrium-app` underneath this skill. Manual: `sovrium docs automations`, `sovrium docs automation-triggers`, `sovrium docs automation-actions`, `sovrium docs automation-integrations`.

## Recipe first

Before writing an automation from scratch, look for one that already exists:

```bash
sovrium library list --kind recipe
sovrium library search <provider or task>
sovrium library show <id>
sovrium library add <id> --set key=value --dry-run
```

A recipe is a starting point: it installs a fragment you own, lists the environment variables it needs in `.env.example`, and installs the connection it depends on. Read what it wrote, replace every placeholder, then apply this skill's checklist to it. Manual: `sovrium docs cli-api/cli-library`.

## Trigger design

```
- [ ] The trigger fires on the smallest event that matters: record events filtered to create, update or delete as needed
- [ ] On update, watchFields names the fields whose change matters — never "any change"
- [ ] A condition checks what the row now looks like; watchFields checks what changed. Use both
- [ ] "Fire once per record": guard on previousRecord (the value it had before) or on a flag the automation sets
- [ ] Several automations on one table: write down the order they are expected to run in, and make each safe in any order
- [ ] Loop check: no action writes a field its own trigger watches unless a condition makes the second run a no-op
- [ ] An action that creates a record in its own trigger table is guarded the same way
- [ ] Webhooks: authenticated (hmac with the sender's scheme, or a token), deduplicated with deduplicationKey, and respondImmediately when the sender only needs a 202
```

Sovrium stops a chain of automations calling each other at `maxDepth` (default 10). It does **not** detect a record automation that re-triggers itself through its own write today: the guard above is yours. Details: `references/loops.md`.

## Actions

```
- [ ] Every outbound create or update carries an idempotency key built from stable values (the record id plus the event), sent the way the API expects it
- [ ] Prefer "set this value" over "increment": a replayed set is harmless, a replayed increment is not
- [ ] Every HTTP call and code step has a timeout; the automation has one too
- [ ] Retries only for transient failures: 429, 5xx, timeouts. Never for 4xx validation errors
- [ ] Retry strategy exponential against a dependency that can be down; finite maxAttempts
- [ ] Two presets: idempotent calls retry up to 5 times; non-idempotent calls (payments, emails) retry at most once, and only with an idempotency key
- [ ] A step whose failure changes nothing downstream (telemetry, a courtesy notice) sets continueOnError; a write a later step reads never does
- [ ] Multi-step writes to several systems have a written compensation for each step, run in reverse, idempotent, and logged — never a silent partial success
- [ ] Exhausted runs are handled once, centrally: an automation-failure trigger watching them
```

**What Sovrium offers today** (read `sovrium docs automations/automation-retry-failure`): a `retry` block at the automation or action level (`maxAttempts` 1–10, `delayMs`, `strategy: fixed | exponential`); a timeout at the automation level (default 900000 ms of active execution, changed by `SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS`), at the action level, and inside an HTTP or code step; `continueOnError` per action; the `exhausted` status and the `automation-failure` trigger as a dead letter; replay that resumes from the failed step without repeating completed ones; webhook `deduplicationKey` and `deduplicationWindow`.

**Design as if** the rest existed. A `retry` block retries only transient failures — a network error, a timeout, an `http` answer of `408`, `429` or any `5xx` — and a `429` or `503` carrying `Retry-After` waits at least that long before the next attempt; a server asking for more than 30 seconds is not retried at all. Any other `4xx` fails at once and the run ends `failed`, not `exhausted`. There is no jitter, and each wait is capped at 30 seconds. So keep attempts low against rate-limited APIs, and prefer a scheduled catch-up (a cron with `filterNew`) over hammering. Details: `references/reliability.md`.

## Connections and secrets

- Credentials for an external service go in a **connection** under the top-level `connections` list and are referenced as `$connection.NAME`. Manual: `sovrium docs automations/automation-connections`.
- Every secret value is `$env.NAME`, with `NAME` declared in the app's top-level `env` block (an undeclared one refuses to boot), the value in `.env` (never committed) and the name in `.env.example`. `sovrium secret generate` prints fresh auth and encryption secrets.
- Never a key or token inline in the config, in a record field, in a template, or in a code step's source.
- An app-scoped OAuth connection is shared by every automation that references it, including cron and webhook runs that have no user.

## Code actions

A `code` action runs a TypeScript `execute(context)` function, type-checked when the server starts. Manual: `sovrium docs automation-actions/automation-code-actions`.

```
- [ ] Inputs declared in inputData, from templates; nothing read from anywhere else (there is no context.trigger)
- [ ] Inputs validated against an allowlist before use (expected keys, types, lengths); reject, do not coerce
- [ ] Returns a small object; that return value is the step's visible output in run history
- [ ] No secrets in the source; read them from context.env
- [ ] Pure where possible: the same inputs give the same output
- [ ] props.timeout set to the smallest value that works
- [ ] Throws a clear error on bad input rather than returning a half result
```

`context.log.info`, `warn`, `error` and `debug` are kept in call order in the step's run log — read them in `GET /api/automations/runs/:id` under `steps[].logs`, with the app's secrets masked. Each entry is cut at 500 characters once stored, so log the fact you need, not a whole payload.

## Notifications

- Batch by default: a `digest` collect step in the event-triggered automation, a `release` step in a cron-triggered one. One summary beats twenty pings.
- Classify urgency: immediate (a person must act now), batched (daily or hourly summary), silent (visible in the app, no message). Most events are batched or silent.
- Let people snooze or opt out of anything that is not immediate.
- Email needs SMTP configured; without it a send is logged, not delivered, and the run still reads green.
- Anything sent in bulk needs a sending domain with SPF, DKIM and DMARC, and a one-click unsubscribe. Sovrium's `email` action does not set custom headers today, so bulk or marketing email goes through a dedicated email provider's API. Details: `references/notifications.md`.

## Test with one record before enabling

1. Point the trigger at a narrow condition (one test record, one test email address) or use a `manual` trigger copy.
2. Fire it once: `POST /api/automations/<name>/trigger` for a manual trigger, the webhook URL `/api/automations/<name>/webhook` for a webhook, or an edit of the watched field for a record trigger.
3. Read the run: `GET /api/automations/runs?automationName=<name>` then `GET /api/automations/runs/<id>`, or the run history in the operator console at `/_admin`.
4. Confirm the effect through the records API or the external system, not only the run status.
5. Fire it a second time with the same input and confirm nothing was duplicated.
6. Only then widen the condition.

## Verify in production

- Watch the failure rate per automation (share of runs `failed`, `timed-out` or `exhausted`), not every failed step.
- A green run of an email step is not proof of delivery on an instance without SMTP.
- A run stuck `pending` may be waiting on a concurrency slot, not broken.

## Anti-patterns

- A record trigger on `update` with no `watchFields`.
- An action writing the field its trigger watches, unguarded.
- Retrying everything, forever, at a fixed short delay.
- An inline API key "just for testing".
- One email per event with no digest.
- A code step that reads the trigger payload through a template string it assembles itself instead of `inputData`.
- `continueOnError` on a write that a later step depends on.
- Declaring success because `sovrium validate` passed.

## References

- [references/reliability.md](references/reliability.md) — read before calling any external service: idempotency keys, retry presets, timeouts, compensation, webhooks in and out.
- [references/loops.md](references/loops.md) — read when an automation writes to a table any automation watches.
- [references/notifications.md](references/notifications.md) — read before sending email or notifications: urgency tiers, digests, email authentication and unsubscribe.
- [references/triggers-and-actions.generated.md](references/triggers-and-actions.generated.md) — read for the exact trigger and action options of the binary you run; generated from it.
- [references/sources.md](references/sources.md) — where the practices in this skill come from.
