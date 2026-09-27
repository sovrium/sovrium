# Automation Runs

> Every trigger firing records a run — its statuses, how to inspect one, and what replay does and does not repeat.

Each time a trigger fires, Sovrium records a **run**: the trigger payload, each step's status and output, and the final outcome. The runs API lists, inspects, replays and cancels them.

## The API

| Method and path                                                   | Purpose                                               |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| `GET /api/automations/runs`                                       | List runs, paginated and filterable by status or name |
| `GET /api/automations/runs/:id`                                   | One run in detail: per-step results, logs and retries |
| `POST /api/automations/runs/:id/replay`                           | Replay a run, resuming from the first failed step     |
| `POST /api/automations/runs/:id/cancel`                           | Cancel a run that is pending or running               |
| `POST /api/automations/runs/:runId/approvals/:approvalId/approve` | Resolve a paused approval, named approvers only       |
| `POST /api/automations/runs/:runId/approvals/:approvalId/reject`  | Reject a paused approval, named approvers only        |
| `GET /api/automations/approvals`                                  | The approval requests the caller may resolve          |

```bash
curl -fsS '/api/automations/runs?status=failed&automationName=welcome-email'
```

A run's detail lists each step with its status, output and error, plus `logs` — the entries a code step wrote with `context.log`, secrets masked — and, at the run level, `attempts`: the attempt history of the last step that ran under a retry policy, each with its number, time and error. Every field the response carries is declared in the published OpenAPI document. A run waiting on an approval carries its `approvalId` in the detail.

## Run statuses

Twelve values, and the list is closed — filtering `?status=` by anything else matches nothing.

| Status                  | Meaning                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `queued`                | Waiting for a concurrency slot                                                     |
| `running`               | Executing now                                                                      |
| `waiting-approval`      | Paused on an approval step until someone decides                                   |
| `completed`             | Every action succeeded                                                             |
| `completed-with-errors` | Finished, but a step failed under `continueOnError`                                |
| `failed`                | An action errored, or the server stopped while the run was in progress (see below) |
| `timed-out`             | Exceeded the automation-level or action-level timeout                              |
| `exhausted`             | Failed after every configured retry attempt — the dead letter                      |
| `skipped`               | The run did not execute                                                            |
| `cancelled`             | Cancelled through the API                                                          |
| `pending`               | Never written by the engine; kept in the list so existing API clients keep working |
| `retrying`              | Never written by the engine; kept in the list so existing API clients keep working |

The admin console's status filter offers a deliberately narrower set — success, failed and partial — because those are the three an operator triages by. The API accepts all twelve.

### Runs interrupted by a restart

Runs are queued and executed in memory, so a server that stops mid-run — a crash, a deploy, a killed process — leaves that run `running` or `queued` with nothing left to finish it. When the server starts again, every run that started before it and is still `running` or `queued` is closed as `failed` with the error `Interrupted: the server stopped during this run`, and the operators are emailed as for any failure. Because it is an ordinary `failed` run, every count of failures already includes it.

Two kinds of run survive a restart and are left alone: a run waiting for an approval, and a run whose delayed step is still due. Both are resumed from the database rather than from memory.

## Step statuses

Six values, and they are **not** the same vocabulary as the run statuses above.

| Status      | Meaning                                               |
| ----------- | ----------------------------------------------------- |
| `pending`   | Not started yet                                       |
| `running`   | Executing now                                         |
| `completed` | Succeeded                                             |
| `failed`    | Errored                                               |
| `filtered`  | Intentionally stopped by a `filter` action            |
| `skipped`   | Not run — downstream of a failure, or during a replay |

`filtered` and `skipped` are separate on purpose: a filter halting the pipeline is the workflow working as written, while a skipped step is a consequence of something going wrong earlier or of a replay resuming past it. Collapsing them would make a deliberate stop indistinguishable from fallout.

## Duration is not an error

A run that exceeds its timeout is recorded as `timed-out`, not `failed`. The two are separate statuses because an operator looking at a list needs to tell a runaway workflow apart from a genuine error, and collapsing them would hide exactly the distinction that decides what to do next. After the retries are exhausted the status becomes `exhausted`, and the `automation-failure` trigger fires with the full attempt history.

## Replay resumes rather than repeats

Replaying a partially failed run **skips the steps that already completed** and resumes from the first failed one. Completed steps are never re-executed, so a replay cannot send the same email twice or create the same record again.

Replay always creates a **new** run rather than mutating the original. The audit history of what happened the first time survives, which is usually the thing being investigated.

## Pausing an automation

An operator can pause an automation from the console's automations page and resume it the same way. A paused automation starts no new run from any trigger until it is resumed; runs already in progress finish. The pause is operational state, not configuration: it survives a restart, and the config file is never edited. An automation disabled in the config itself cannot be paused or resumed.

Pausing or resuming emails the other recipients of the automation alerts, naming who did it. The operator who acted is not emailed.

### Pausing automatically after repeated failures

Set `SOVRIUM_AUTOMATION_AUTOPAUSE` to a number and the platform pauses an automation itself once that many of its runs **in a row** have failed for good (`failed`, `exhausted` or `timed-out`):

```bash
SOVRIUM_AUTOMATION_AUTOPAUSE=3
```

Only runs that ended count — a skipped or cancelled run neither breaks nor extends the streak — and only runs started after the automation was last resumed, so resuming an automation starts the count again. Unset, which is the default, nothing is ever paused automatically.

An automatic pause is the same pause an operator sets, and it is lifted the same way, with **Resume**. It is told apart in three places: the console marks it as automatic, the recipients of the automation alerts receive an email naming the automation and the number of failures in a row, and the audit log records `automation.auto_paused` rather than the `automation.paused` an operator's click writes.

The console's catalog, `GET /api/admin/automations`, carries a `reason` on each paused automation: `null` for a pause an operator set, `consecutive-failures` for one the platform set. It is absent on an automation that is not paused.
