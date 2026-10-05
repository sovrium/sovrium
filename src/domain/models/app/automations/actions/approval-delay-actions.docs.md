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
- name: cooldown
  type: delay
  operator: wait
  props: { duration: 15m }
```

`duration` is a number and a unit — `ms`, `s`, `m`, `h` or `d`. `until` is an ISO 8601 datetime, or a template resolving to one.

### `queue`

Process queued items one at a time with configurable spacing, which is what a rate-limited downstream API needs.

```yaml
- name: paceApiCalls
  type: delay
  operator: queue
  props: { interval: 1s, maxQueueSize: 1000 }
```

`interval` is the minimum delay between items and is required. `maxQueueSize` caps the queue, after which new entries are refused; it is unlimited by default, which is worth setting deliberately on anything fed by an external source.

### `webhook`

Pause until an external callback arrives — an asynchronous third-party job finishing, typically.

```yaml
- name: awaitProcessing
  type: delay
  operator: webhook
  props:
    callbackId: 'job-{{trigger.data.id}}'
    timeout: 2h
    onTimeout: error
```

`callbackId` is generated when omitted; supplying one derived from the payload is what lets the caller know which run to resume. `onTimeout` is `continue`, `stop` or `error`, defaulting to `error`. `expectedData` validates the inbound payload's shape before the run resumes.
