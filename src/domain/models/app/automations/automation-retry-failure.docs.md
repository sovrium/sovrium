# Retry & Failure Handling

> Retry policies, the two timeout scopes, continuing past a failed step, the dead letter, and why replay is safe to press twice.

An automation is made resilient by configuration: retry the transient failures with backoff, fence a runaway step with a timeout, recover a partially failed run without repeating what already worked, and route an exhausted run to a handler.

## Retry policy

A `retry` block sits at the **automation** level, covering the whole run, or at the **action** level, covering one step. An action-level block overrides the automation's for that step.

<!-- sovrium:options RetryConfigSchema -->

```yaml
env:
  - { key: INVENTORY_API, description: Base URL of the inventory service, secret: false }

automations:
  - name: sync-inventory
    trigger: { type: cron, expression: '0 * * * *' }
    retry: { maxAttempts: 5, delayMs: 2000, strategy: exponential }
    actions:
      - name: pull
        type: http
        operator: get
        props: { url: $env.INVENTORY_API }
        retry: { maxAttempts: 3, strategy: fixed }
```

`maxAttempts` accepts 1 to 10 and is required once the block is present. `delayMs` accepts 100 to 60000 and defaults to 1000. `strategy` defaults to `fixed`.

**Only a failure a second try could fix is retried.** A network error, a timeout, and an answer of `408`, `429` or any `5xx` — from an `http` step or from a provider an `ai` step calls, such as the speech endpoint of `ai/transcribe` — are retried; any other `4xx` — a missing record, a refused credential, a malformed request — would fail the same way every time (as would a recording `ai/transcribe` refuses before sending it), so the step fails at once and the run ends `failed` rather than `exhausted`. When a `429` or `503` carries `Retry-After`, the next attempt waits at least that long, even when `delayMs` is shorter; a server asking for more than 30 seconds is not retried at all, since a run held open that long is worse than one that fails.

Prefer `exponential` against a dependency that might be down rather than merely slow: a fixed delay turns an outage into steady load against a service already struggling, and each attempt costs the same as the first.

## Two timeout scopes

| Scope            | Where                  | Effect                                                           |
| ---------------- | ---------------------- | ---------------------------------------------------------------- |
| Automation       | `automation.timeout`   | Caps total run time; on expiry the run is marked `timed-out`     |
| Action           | `action.timeout`       | Caps one step, with `retry` and `continueOnError` still applying |
| Action, internal | `action.props.timeout` | A per-type fence, for instance on an HTTP call or a code step    |

`automation.timeout` accepts 1000 to 3600000 milliseconds — up to one hour — and `action.timeout` accepts 1000 to 900000.

Without a `timeout`, a run gets **900000 milliseconds, fifteen minutes**. An operator changes that default for every automation of the instance with the `SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS` environment variable, which accepts the same range; an automation that sets its own `timeout` keeps it.

The timeout counts only the time a run is **actually executing**. A run waiting for a concurrency slot has not started yet, and a run suspended on a human approval is not running: neither wait is counted. The run's `startedAt` is the moment it left the queue, and its `durationMs` measures from there — so a run that queued for a minute behind another and then worked for two seconds reports about two seconds.

A `timed-out` run is deliberately **distinct** from a `failed` one, so that duration and error can be told apart in a list of runs. It keeps the steps that finished before the timeout, with their output, and lists every action it never reached as `skipped`.

### Runs the engine lost track of

Every five minutes, a sweep looks for runs still marked `running` long after they should have ended: past their timeout plus one minute of grace. Each one is closed as `timed-out`, with the error `Timed out: the run exceeded its timeout and was closed by the sweep`, and alerts the operators like any other timeout.

When the server starts, it closes the runs a previous process left `running` or `queued` as `failed` with the error `Interrupted: the server stopped during this run`, since nothing in the new process will ever finish them. A run waiting for an approval is resumed rather than closed.

## Continuing past a failure

`continueOnError: true` on an action means its failure does not abort the run: the following actions still execute and the run finishes as `completed-with-errors`.

```yaml
- name: bestEffortLog
  type: analytics
  operator: track
  continueOnError: true
  props: { event: order.created, properties: { id: '{{trigger.data.id}}' } }
```

Reach for it on a step whose failure genuinely does not change what should happen next — telemetry, a courtesy notification. A write that a later step reads is not such a step.

## The dead letter

A run that fails after exhausting every configured attempt transitions to `exhausted`. Each attempt is recorded with its timestamp, error message and stack trace, and the `automation-failure` trigger then fires with the full attempt history.

That is what makes centralised failure handling possible: one automation watching for failures, instead of a notification step bolted onto the end of every workflow.

## The operator alert email

Independently of any `automation-failure` handler you declare, Sovrium emails the people who operate the instance when a run fails after its last retry, times out, or is interrupted by a restart. Nothing in the config switches it on: it is the platform's safety net, like the "Zap failed" email of hosted automation tools.

**Who receives it:**

- every account with an admin-tier role — `admin`, `admin-editor`, `admin-viewer`, `operator`, and a custom role that reaches the console — that is not banned, and has left **Automation alerts** on in its profile (`/_admin/profile`, Notifications). Every account starts with it on;
- every address listed in `SOVRIUM_NOTIFY_TO`, a comma-separated list. It is the whole audience of an app with no `auth:` block, which has no accounts to email.

An address that appears in both is emailed once. `SOVRIUM_NOTIFY_AUTOMATIONS=off` silences the alert for the whole instance; your `automation-failure` handlers still run.

**What it says.** The subject opens with the app's name in brackets, then the automation:

```text
[acme-ops] Automation failed: nightly-sync
```

The footer carries the app's version and the Sovrium version (`acme-ops v2.3.1 (Sovrium v0.28.0)`), and the email arrives from the app's name unless `SMTP_FROM_NAME` says otherwise.

A run that exceeded its `timeout` reads `Automation timed out: <name>` and says it timed out. The body names the automation, the error — shown as text, never interpreted as markup — and when it happened. The error is summarised before it is sent: its first line only, with a database's detail block removed except the column a duplicate key names, whose value is replaced (`Key (email)=(…)`), any password in a connection URL masked, and at most 200 characters. The full error stays in the run's history in the console. The email itself is headed with the app's name. When `BASE_URL` is set, it links to the console's automations catalogue, where a paused automation is resumed, and, in its footer, to the profile page where each operator switches the email off; without `BASE_URL` no link can be built, so the run id is printed instead.

A run the server stopped under reads `Automation interrupted: <name>`, and its error is `Interrupted: the server stopped during this run` — see _Runs interrupted by a restart_ in the runs article.

A timed-out run is alerted but is still NOT passed to `automation-failure` handlers: a timeout is a question for whoever operates the instance, not a routine failure a workflow should react to.

### One email, then one summary an hour

An automation that fails every minute does not send sixty emails an hour. Its first failure is emailed at once. Every further failure of that automation within the next hour is held back, and at the top of each hour, in the operator timezone (`SOVRIUM_TIMEZONE`), one summary email lists every automation with held-back failures: how many more times it failed, its last error, and — when a later run succeeded — the time it recovered, so nobody investigates a failure that has already fixed itself.

A failure more than an hour after the previous one of the same automation is emailed at once again. An hour with nothing held back sends no summary. The summary is not caught up after a restart: every automation in it already had its first failure emailed.

### Pauses

Pausing or resuming an automation from the console emails the same recipients, naming who did it and leaving that person out. With `SOVRIUM_AUTOMATION_AUTOPAUSE` set, the platform also pauses an automation after that many failures in a row, and emails the recipients to say so — see _Pausing an automation_ in the runs article.

The alert is sent through the instance's SMTP settings (see the Email section of the environment reference). With no SMTP host set, it is logged rather than delivered.

## Partial failure and idempotent resume

When a run fails mid-pipeline, the completed steps read `completed`, the failing step reads `failed`, and everything downstream reads `skipped`. Replaying runs only the steps the failure left `skipped` — the ones after the failed step. Neither a completed step nor the failed step runs again, so the replay is safe to press without auditing what the first attempt got through. A run that stopped on purpose — stopped by a filter, waiting for an approval, or refused one — left no step `skipped`, so its replay runs no step.

Replay creates a new run rather than mutating the original.

## Duplicate triggers

A webhook trigger accepts a `deduplicationKey` — a template over the payload — and a `deduplicationWindow` in seconds, which together drop a duplicate run started by an identical payload. Paired with idempotent resume, that is what makes at-least-once delivery from an external sender safe to accept.
