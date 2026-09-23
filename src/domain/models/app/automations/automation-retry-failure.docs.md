# Retry & Failure Handling

> Retry policies, the two timeout scopes, continuing past a failed step, the dead letter, and why replay is safe to press twice.

An automation is made resilient by configuration: retry the transient failures with backoff, fence a runaway step with a timeout, recover a partially failed run without repeating what already worked, and route an exhausted run to a handler.

## Retry policy

A `retry` block sits at the **automation** level, covering the whole run, or at the **action** level, covering one step. An action-level block overrides the automation's for that step.

<!-- sovrium:options RetryConfigSchema -->

```yaml
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

Prefer `exponential` against a dependency that might be down rather than merely slow: a fixed delay turns an outage into steady load against a service already struggling, and each attempt costs the same as the first.

## Two timeout scopes

| Scope            | Where                  | Effect                                                           |
| ---------------- | ---------------------- | ---------------------------------------------------------------- |
| Automation       | `automation.timeout`   | Caps total run time; on expiry the run is marked `timed-out`     |
| Action           | `action.timeout`       | Caps one step, with `retry` and `continueOnError` still applying |
| Action, internal | `action.props.timeout` | A per-type fence, for instance on an HTTP call or a code step    |

Both the automation and action forms accept 1000 to 900000 milliseconds. The automation timeout defaults to 300000.

A `timed-out` run is deliberately **distinct** from a `failed` one, so that duration and error can be told apart in a list of runs.

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

## Partial failure and idempotent resume

When a run fails mid-pipeline, the completed steps read `completed`, the failing step reads `failed`, and everything downstream reads `skipped`. Replaying resumes from the failed step and skips what already completed, so the replay is safe to press without auditing what the first attempt got through.

Replay creates a new run rather than mutating the original.

## Duplicate triggers

A webhook trigger accepts a `deduplicationKey` — a template over the payload — and a `deduplicationWindow` in seconds, which together drop a duplicate run started by an identical payload. Paired with idempotent resume, that is what makes at-least-once delivery from an external sender safe to accept.
