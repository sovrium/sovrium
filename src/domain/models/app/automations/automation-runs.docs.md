# Automation Runs

> Every trigger firing records a run — its statuses, how to inspect one, and what replay does and does not repeat.

Each time a trigger fires, Sovrium records a **run**: the trigger payload, each step's status and output, and the final outcome. The runs API lists, inspects, replays and cancels them.

## The API

| Method and path                         | Purpose                                               |
| --------------------------------------- | ----------------------------------------------------- |
| `GET /api/automations/runs`             | List runs, paginated and filterable by status or name |
| `GET /api/automations/runs/:id`         | One run in detail, including per-step results         |
| `POST /api/automations/runs/:id/replay` | Replay a run, resuming from the first failed step     |
| `POST /api/automations/runs/:id/cancel` | Cancel a run that is pending or running               |

```bash
curl -fsS '/api/automations/runs?status=failed&automationName=welcome-email'
```

## Run statuses

Ten values, and the list is closed — filtering `?status=` by anything else matches nothing.

| Status                  | Meaning                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| `pending`               | Queued — waiting to execute, or waiting on a concurrency slot             |
| `running`               | Executing now                                                             |
| `retrying`              | A failed attempt is being retried under the run's retry policy            |
| `completed`             | Every action succeeded                                                    |
| `completed-with-errors` | Finished, but a step failed under `continueOnError`                       |
| `failed`                | An action errored, which fires the failure trigger and starts the retries |
| `timed-out`             | Exceeded the automation-level or action-level timeout                     |
| `exhausted`             | Failed after every configured retry attempt — the dead letter             |
| `skipped`               | The run did not execute                                                   |
| `cancelled`             | Cancelled through the API                                                 |

The admin console's status filter offers a deliberately narrower set — success, failed and partial — because those are the three an operator triages by. The API accepts all ten.

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
