# Automation Runs

> Every trigger firing records a run — its statuses, how to inspect one, and what replay does and does not repeat.

Each time a trigger fires, Sovrium records a **run**: the trigger payload, each step's status and output, and the final outcome. The runs API lists, inspects, replays and cancels them.

## The API

| Method and path                                                   | Purpose                                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `GET /api/automations/runs`                                       | List runs, paginated and filterable by status or name                                       |
| `GET /api/automations/runs/:id`                                   | One run in detail: per-step results, logs and retries                                       |
| `GET /api/automations/:name/runs`                                 | One automation's runs in detail, newest first; `404` for a name the config does not declare |
| `POST /api/automations/runs/:id/replay`                           | Replay a run, resuming from the first failed step                                           |
| `POST /api/automations/runs/:id/cancel`                           | Cancel a run that is pending or running                                                     |
| `POST /api/automations/runs/:runId/approvals/:approvalId/approve` | Resolve a paused approval: named approvers or an admin                                      |
| `POST /api/automations/runs/:runId/approvals/:approvalId/reject`  | Reject a paused approval: named approvers or an admin                                       |
| `GET /api/automations/approvals`                                  | The approval requests the caller may resolve                                                |

```bash
curl -fsS '/api/automations/runs?status=failed&automationName=welcome-email'
```

A run's detail lists each step with its status, output and error, plus `logs` — the entries a code step wrote with `context.log`, secrets masked — and, at the run level, `attempts`: the attempt history of the last step that ran under a retry policy, each with its number, time and error. Every field the response carries is declared in the published OpenAPI document. A run waiting on an approval carries its `approvalId` in the detail.

**Who may read a run.** A run — its trigger payload and step outputs — is read, replayed and cancelled only by an admin, by the person who started it by hand (a manual trigger or a record button), and by an approver a request on that run names. Anyone else signed in gets the `404` an unknown run gets, and a caller with no session gets `401`. The run lists hold only the runs the caller may read, and their total counts only those.

**What a non-admin reader sees of a step.** A step reads under the run's authority, not the reader's, so a named approver sees a step's output only when what that step could read stays within what she may read through the records API. An agent step counts as reading every table its agent's declared role may read; a record step, every column and row of its table. The reader must read each such table with every column the step reads and no row-level rule narrowing her — and every related value those columns carry: no lookup, rollup, count or formula among them may read a table or field she may not read, and no lookup among them may read, at any hop, through a table whose row-level rule narrows her. A record step that read records — a read or a list — is judged by the records it holds instead when a row-level rule narrows her: she sees its output when her rules admit every one of them, every record their relationships name and every record their lookups read through, at every hop. From the first step beyond her reach on, every step's `output` and `error` read `null` and carry no `logs`, because later steps can carry what it read forward; step names, statuses and timings stay, so a failed step still reads `failed`. A run's own `error` reads `null` whenever any step's would. A script step reads what the actions it called read — each action it calls through `context.actions` is recorded as it runs — and is judged like them; a script that called an action whose reads are not judged — reading a stored file, a transcription, a digest, a link or stored state — is beyond every non-admin reader. A synchronous call is judged by what the run it started actually read, record by record. A value a step wrote into a record is judged as that record is, whoever reads it next. The run data of an automation the config no longer declares is withheld. An admin sees every step whole, and so does the person who started a run by hand: that run read as her, its record steps under her rules and its agent steps within what both the agent and she may read.

**What a non-admin reader sees of a run's trigger data.** A record or comment trigger captures the record that fired it — and the records its relationships link to, column by column — with the engine's authority. A named approver sees that `triggerData`, in the run lists and in the run's detail, only when she may read all of it as a record step's output is judged: every column of the trigger's table and of each linked record's table, no related value her role may not read, and every record it carries, links to or looks up through admitted by her row-level rules. Otherwise it reads `null`. The trigger data of other triggers, such as a webhook's request or a form's answers, is shown as captured.

**Runs started by another run.** A call (`automation:call`) and a failure handler (`automation-failure`) start a run whose trigger data is what another run handed on. Each records which run fed it, and what it was handed is judged by what that run had read before handing it on — all of it, conservatively, not only the value passed: its trigger data and every step before the call or the failure. The check follows the chain back through every run that fed it, up to 10 runs and 1 000 records; past that, the data is withheld. A value that came from outside the app — a webhook's request, a form's answers, a replay payload an admin supplied — is shown as captured wherever it is handed on. A call or failure run recorded before 0.30.0 carries no record of what fed it and is withheld from everyone who does not read every run. When a run's trigger data is withheld from a reader, so is every step's output, logs and error. A replay keeps the record of what fed the run it replays.

**What a non-admin reader sees of a request.** `GET /api/automations/approvals` renders each message from what the run carries, so the message is judged as the request step's output is: it reads `null` to an approver who may not read what fed it.

**Runs after an account is erased.** Every run that read one of the erased person's records, a record naming her, or a record removed with hers keeps its steps, their statuses and its timings, and loses every value it captured or produced: its trigger data, each step's input, output, error and logs, and its own error. Its detail then carries `valuesErasedAt`, the date the values were erased. A run another run fed from such a run keeps what it was handed, but withholds it from everyone who does not read every run. Values that came from outside the app — a webhook's request, an anonymous form's answers — name nobody the platform can match and are not erased.

**Cancelling a run.** Only a run that is queued, running or waiting for an approval can be cancelled. Cancelling a run that already ended — completed, failed, rejected, stopped by a filter, timed out or already cancelled — is refused with `409`, and the run keeps its status; replay it instead. Cancelling a run that waits for an approval rejects its pending request, so the approver no longer finds it and a later answer resumes nothing.

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
| `skipped`               | A `filter` step stopped the run before its remaining actions, as written           |
| `cancelled`             | Cancelled through the API                                                          |
| `pending`               | Never written by the engine; kept in the list so existing API clients keep working |
| `retrying`              | Never written by the engine; kept in the list so existing API clients keep working |

The admin console's status filter offers a deliberately narrower set — success, failed, partial, waiting for approval, rejected and cancelled — because those are the ones an operator triages by. The API accepts all twelve. Wherever the console shows a run's status — the history grid, the run page and each of its steps — it reads in words in the operator's language (`Waiting for approval`, `Rejected`, `Timed out`, `Skipped` …), and a step a filter stopped reads `Filtered out`, never the engine's raw value.

### Runs interrupted by a restart

A graceful stop does not leave a run behind: a run that an automation's own write started in the background is given a moment to finish when the server receives `SIGTERM`, and one still going is closed as `failed` with the error `Interrupted: the server stopped during this run` before the process exits.

Runs are queued and executed in memory, so a server that stops mid-run without that chance — a crash, a killed process — leaves that run `running` or `queued` with nothing left to finish it. When the server starts again, every run that started before it and is still `running` or `queued` is closed as `failed` with the error `Interrupted: the server stopped during this run`, and the operators are emailed as for any failure. Because it is an ordinary `failed` run, every count of failures already includes it.

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

A replay runs only the steps a failure left `skipped`. A run a filter stopped, a run waiting on an approval or refused one, and a run an early return ended have nothing to resume: their replay runs no step, so a replay never gets past a filter or an approval the original did not. A run a person started by hand replays as that person; any other replays as the system.

A replay body may carry `triggerData` to replay with a different payload, and only an admin may send one — anyone else who may replay the run gets `403` and replays it with its own payload by sending no body.

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
