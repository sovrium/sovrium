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

`approvers` is either `all-admins` or an array of addresses and role names, and it is required, as is `message`. `options` needs at least two choices and defaults to approve and reject; the chosen `value` becomes the step's output. `timeout` is a duration such as `24h` or `7d`, with no timeout by default. `notifyVia` defaults to email.

### Decide what a timeout means

`onTimeout` is `approve`, `reject` or `escalate`, and there is no safe default for it — which is why omitting `timeout` means waiting indefinitely rather than silently choosing one. An approval that auto-approves on timeout is a different control from one that auto-rejects, and only the workflow's author knows which is correct here.

### Branch on the decision

The step's output is the chosen option's `value`, which feeds naturally into a branch so that approve and reject take different paths.

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
