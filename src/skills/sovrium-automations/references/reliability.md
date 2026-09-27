# Reliability

## Contents

- Assume every step runs twice
- Idempotency keys
- Set, don't increment
- Timeouts
- Which failures to retry
- The two retry presets
- Backoff, jitter and Retry-After
- Per-step failure directives
- Compensation for multi-step work
- The dead letter
- Webhooks in
- Webhooks out
- Checklist

Manual: `sovrium docs automations/automation-retry-failure`, `sovrium docs automations/automation-runs`, `sovrium docs automation-triggers/trigger-webhook-cron`, `sovrium docs automation-integrations/automation-http-actions`.

## Assume every step runs twice

Deliveries repeat: a sender retries a webhook it thinks failed, an operator replays a run, a retry fires after a response was lost on the way back. Design every step so that running it twice with the same input has the same effect as running it once. That property is called idempotency, and it is cheaper to design in than to debug out.

Sovrium helps in two places: a replay resumes from the failed step and never re-executes completed ones, and a webhook trigger can drop duplicate deliveries with `deduplicationKey` and `deduplicationWindow` (seconds, default 300). Everything else is your design.

## Idempotency keys

For every outbound call that creates or changes something:

- Build a key from values that are the same on every delivery of the same event: the record id and the event (`order-{{trigger.data.record.id}}-paid`), or the sender's own event id for a webhook (`{{trigger.data.body.id}}`).
- Send it the way the receiving API asks: many payment and messaging APIs accept an `Idempotency-Key` header; others take a client reference in the body. Read the provider's docs.
- Never build a key from the current time or a random value — a retry would get a new one.
- If the API has no idempotency support, look the object up by your key first ("find, then create") and store the external id on your record.

## Set, don't increment

A replayed "set status to paid" is harmless. A replayed "add 1 to visit_count" counts twice. Prefer computing a value from the source of truth (a `count` or `rollup` field) over maintaining a counter from automations. If you must keep a counter, make the step idempotent with the `state` actions or a guard condition.

## Timeouts

Every call to something you do not control needs a bound:

| Scope                         | Where                       | Range                                         |
| ----------------------------- | --------------------------- | --------------------------------------------- |
| Whole run                     | `timeout` on the automation | 1000–3600000 ms, default 900000               |
| One step                      | `timeout` on the action     | 1000–900000 ms                                |
| One HTTP request or code step | `props.timeout`             | per action type; the HTTP default is 15000 ms |

Set the step timeout to a little above the dependency's normal worst case, not to the maximum. A run that exceeds a timeout is `timed-out`, a different status from `failed`, so slowness and errors stay distinguishable.

## Which failures to retry

| Failure                    | Retry?                                                |
| -------------------------- | ----------------------------------------------------- |
| Timeout, connection reset  | Yes                                                   |
| `429 Too Many Requests`    | Yes, slowly; Sovrium waits out `Retry-After`          |
| `500`, `502`, `503`, `504` | Yes                                                   |
| `400`, `422` (bad input)   | No — it will fail the same way every time             |
| `401`, `403` (credentials) | No — fix the connection                               |
| `404`                      | No, unless the resource is expected to appear shortly |
| `409` (conflict)           | Only after re-reading the current state               |

Sovrium's `retry` block follows this table for `http` steps: a network error, a timeout, `408`, `429` and any `5xx` are retried; any other `4xx` fails at once and the run ends `failed`, not `exhausted`. Still validate input before the call (a `filter` action, or a code step that checks the payload), so a bad request fails early with a message you wrote. Manual: `sovrium docs automations/automation-retry-failure`.

## The two retry presets

```yaml
# Idempotent call (a GET, a PUT with a key, a lookup)
retry: { maxAttempts: 5, delayMs: 2000, strategy: exponential }

# Non-idempotent call (a payment, an email, a POST without a key)
retry: { maxAttempts: 2, delayMs: 5000, strategy: exponential } # only with an idempotency key; otherwise no retry block at all
```

`maxAttempts` counts the first attempt, so `2` means one retry. With `exponential`, the waits are `delayMs`, `2×`, `4×` …; each wait is capped at 30 seconds.

## Backoff, jitter and Retry-After

Exponential backoff spreads retries out; jitter (a random part of each wait) keeps many clients from retrying in lockstep. Sovrium's automation retry waits out a `Retry-After` on `429` or `503` (and does not retry when the server asks for more than 30 seconds), but it adds no jitter. Three mitigations:

- Keep `maxAttempts` low and `delayMs` generous on calls to rate-limited APIs.
- Use the provider's `connection` operations from the library where they exist (`sovrium library add <provider>/<operation>`): those steps wait out a `Retry-After` on `429` or `503`, up to three times and never longer than 60 seconds.
- For bulk work, move from "call per event" to "cron + `filterNew` + one batch call", which is gentler than any retry policy.

## Per-step failure directives

Decide, for each step, what its failure means for the run:

| Directive                | Sovrium today                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| **Stop** the run         | The default: the step fails, later steps are `skipped`                                                   |
| **Ignore** and continue  | `continueOnError: true`; the run ends `completed-with-errors`                                            |
| **Fallback value**       | Not a built-in; use a `path` branch on the previous step's output, or a code step that returns a default |
| **Park for retry later** | The `exhausted` status plus replay; or write the item to a table a cron retries                          |

`continueOnError` belongs on steps whose failure changes nothing downstream (telemetry, a courtesy message). Never on a write a later step reads.

## Compensation for multi-step work

When a run writes to several systems (create an invoice in accounting, then mark the order invoiced, then email the customer) and a later step fails, the earlier writes stand. Plan compensations:

```
- [ ] For each step that changes an external system, write down the step that undoes it
- [ ] Compensations run in reverse order
- [ ] Each compensation is idempotent itself
- [ ] A compensation that fails is logged and alerts a person — never a silent partial success
- [ ] Prefer ordering steps so the irreversible one (payment, email) comes last
```

In Sovrium, compensations are usually a separate automation on the `automation-failure` trigger, reading which step failed from the failed run.

## The dead letter

A run that fails after every attempt becomes `exhausted` and fires the `automation-failure` trigger with the full attempt history. Handle failures there, once, for all automations (notify the owner, open a ticket, write a row to a `failed_runs` table), rather than bolting a notification onto the end of every automation. Replay from the runs API (`POST /api/automations/runs/:id/replay`) resumes from the failed step.

## Webhooks in

```
- [ ] Authenticated: auth.type hmac with the sender's scheme (hex, base64, stripe, slack, svix), or a bearer or apiKey token; the secret is $env
- [ ] Deduplicated: deduplicationKey from the sender's event id
- [ ] respondImmediately: true when the sender only needs a fast 202 (payment and repository providers retry slow deliveries)
- [ ] Tested by sending a real signed request, not only by validating the config — an incomplete auth block passes validation and fails at request time
```

Many senders follow the Standard Webhooks convention (an id, a timestamp and a signature header over `id.timestamp.body`). Sovrium's `svix` scheme reads the `svix-*` header spelling; if your sender uses the `webhook-*` spelling, check `sovrium docs automation-triggers/trigger-webhook-cron` before assuming it is accepted.

## Webhooks out

When your automation calls another system's webhook:

- Sign the body (the `crypto` action computes an HMAC) and send a timestamp, so the receiver can reject replays.
- Send a stable event id the receiver can deduplicate on.
- Set a timeout; treat a non-2xx as a failure; retry only transient ones.
- Never put a secret in the URL.

## Checklist

```
- [ ] Every outbound write has an idempotency key or a find-then-create guard
- [ ] Every external call has a timeout
- [ ] retry only on steps whose failures are mostly transient; finite attempts
- [ ] continueOnError only on steps nothing depends on
- [ ] Irreversible step last; compensations written for the rest
- [ ] One automation-failure handler for the app
- [ ] Fired twice with the same input: no duplicate effect
```
