# Approval & Delay Actions

> The two families that pause a running workflow — one waiting on a person, the other on time or on an external system.

## Approval — a human in the loop

One operator. It suspends the run, notifies the approvers, and resumes once a decision is recorded or the timeout fires. It requires authentication to be configured, since an approver is an account.

<!-- sovrium:options ApprovalRequestActionSchema -->

```yaml
- name: approveRefund
  type: approval
  operator: request
  props:
    approvers: all-admins
    message: 'Approve refund of {{trigger.data.amount}} for order {{trigger.data.id}}?'
    options:
      - { value: approve, label: 'Approve refund' }
      - { value: reject, label: 'Deny' }
    timeout: 48h
    onTimeout: reject
    notifyVia: email
```

`approvers` is either `all-admins` or an array of addresses and role names; `message` is required. `options` needs at least two choices and defaults to approve and reject. Once the request is resolved, the step's output is `{ decision, resolvedBy, resolverId }` — see below. `timeout` is a duration such as `24h` or `7d`, with no timeout by default. `notifyVia` defaults to email.

### Who may resolve it

A request is resolved by an approver it names, by its timeout, or by an admin. An admin — the built-in `admin` role or the app's top role, never a read-only operator role such as `admin-viewer` — may resolve any request — the way out of one that names nobody who can still answer it. Otherwise only a named approver can: with `all-admins`, any such admin; with a list, a caller whose role appears in it, or the account that held a listed address (case ignored) when the request was made — an account registered later with that address is not an approver. A request recorded before addresses were tied to accounts matches no address; the roles it names, or its timeout, resolve it. Leaving `approvers` out means `all-admins`. Anyone else is answered `404`, exactly as for an approval that does not exist, and a caller with no session `401`; the run stays paused. An app without an `auth` block has no sessions, so nobody can resolve its approval requests. `GET /api/automations/approvals?status=pending` lists the requests waiting on the signed-in person — every pending request, for an admin — each with its `runId` and `approvalId`, so a page can put an Approve and a Reject button on every row.

### Decide what a timeout means

`onTimeout` is `approve` or `reject`, and there is no safe default for it — which is why omitting `timeout` means waiting indefinitely rather than silently choosing one. A `timeout` must name its `onTimeout`, and `escalate` is not supported yet: either is refused when the config is validated, with a message saying what to write instead. An approval that auto-approves on timeout is a different control from one that auto-rejects, and only the workflow's author knows which is correct here.

Once `timeout` has passed, the engine resolves the request with `onTimeout` — `approve` resumes the run, `reject` ends it (or continues it under `onReject: continue`) — within a minute, and at start-up for a request that expired while the server was stopped. An answer that arrives after the timeout is refused with `409`; the timeout's outcome stands.

### Branch on the decision

The step's output reads what was decided, `{{<step>.result.decision}}` — `approved` or `rejected` — which feeds naturally into a branch so that approve and reject take different paths. Beside `decision`, the output carries `resolvedBy` — `user` or `timeout` — and, for a person, `resolverId`, the account that answered, so a later step can tell "nobody answered" from "finance said no": `{{<step>.result.resolvedBy}}`. The paused run's log records the same output on the approval step.

A rejection ends the run by default (`onReject: stop`): no later step runs. With `onReject: continue`, a rejection resumes the run past the approval exactly as an approval does, and the step's output names what was decided — `{{<step>.result.decision}}` reads `approved` or `rejected` — so one later step can record either outcome.

```yaml
- name: managerDecision
  type: approval
  operator: request
  props:
    message: 'Time off for {{trigger.data.subject}}?'
    onReject: continue
- name: recordDecision
  type: record
  operator: create
  props:
    table: time_off_decisions
    data: { decision: '{{managerDecision.result.decision}}' }
```

## Delay — wait, queue, callback

Three operators that pause execution in different ways.

<!-- sovrium:options DelayActionSchema -->

### `wait`

Pause for a fixed duration, or until a specific instant.

```yaml
- name: waitUntilDayBefore
  type: delay
  operator: wait
  props: { until: '{{steps.dayBefore.instant}}' }
```

`duration` is a number and a unit — `ms`, `s`, `m`, `h` or `d`. `until` is an ISO 8601 datetime, or a template resolving to one. An `until` with an offset or `Z` is that instant; one without — `2026-12-24T09:00`, or a bare date read as its midnight — is read in the operator time zone, `SOVRIUM_TIMEZONE` (UTC when unset), never the host's. An `until` already past continues at once.

A wait of one minute or less sleeps inside the run, so a synchronous webhook still answers with what the steps after it produced. A longer wait **parks** the run: the step answers `{ resumeAt }`, the run turns `waiting-delay` with that `resumeAt`, and the trigger is answered at once with the run's id and the status `waiting-delay`. A sweep resumes the run within about a minute after `resumeAt` — at the next start for a run whose time passed while the server was stopped — and the step then also reads `resumedAt`. Nothing is promised to the second, and nothing is ever shortened.

The run resumes **in its own row**. The steps before the wait never run again; their outputs are restored, so `{{steps.<earlier>.…}}` and `{{trigger.…}}` read what they read before the wait. A value a step returned that was a secret is stored masked and comes back masked: a step after the wait that needs a secret reads it from its own configuration. A waiting run holds no concurrency slot, and the automation `timeout` counts only the time it actually runs, summed over its segments.

A long wait parks the run inside a `loop` or a `path` too, and the run resumes exactly where it stood: in the loop item it paused on, the items before it kept and the ones after it run in full; in the path branch it paused in, without choosing the branch again. A loop that waits once per item parks once per item — two writes and up to a minute of latency each — so for a large list, a `cron` trigger reading the records that are due is the better shape.

**It resumes against the configuration of the day it resumes.** The run finds its wait step again by name, and the loop or path around it by name and kind; what follows the wait is whatever follows it then, so a reminder reworded while it waits goes out reworded. If the automation, the wait step or a loop, path or branch around it was renamed or removed, the run is cancelled, saying the automation changed while it was waiting, and nothing after the wait runs — as it is when the list a loop walks no longer holds the item it paused on. While the automation is paused, a due run keeps waiting until it is resumed. A waiting run can be cancelled (`POST /api/automations/runs/:id/cancel`), and erasing an account whose values a waiting run captured cancels that run, so the step after the wait never acts for an erased person.

**Ninety days at most.** A `duration` longer than `90d` is refused when the configuration is validated; an `until` that resolves more than 90 days ahead fails the step, naming the limit. Further horizons belong to a `cron` trigger reading the records that are due, which also follows a date edited after the run started.

### `queue`

Space the next step of the run by a short interval, which is what a rate-limited downstream API needs.

```yaml
- name: paceApiCalls
  type: delay
  operator: queue
  props: { interval: 1s }
```

`interval` is required and waits that long inside the run before the next step; it may be at most one minute, and a longer one is refused when the configuration is validated. Runs started together are not spaced from one another: a throttle measured in minutes is a schedule, which a `cron` trigger reading the pending records expresses durably. `maxQueueSize` is accepted and not enforced.

### `webhook`

Wait for an external system — an asynchronous third-party job finishing, typically — up to a timeout.

```yaml
- name: awaitProcessing
  type: delay
  operator: webhook
  props:
    callbackId: 'job-{{trigger.data.id}}'
    timeout: 2h
    onTimeout: continue
```

The step answers a `callbackUrl` and a `callbackId` (generated when omitted). No route receives that callback yet, so the timeout is the outcome: once it passes, the run continues past the step, which then reads `timedOut: true` — whatever `onTimeout` says. A timeout of one minute or less waits inside the run; a longer one parks the run exactly like a long `wait`, up to the same 90 days. Without a `timeout` the run continues at once. `expectedData` is accepted for the day callbacks are received.
