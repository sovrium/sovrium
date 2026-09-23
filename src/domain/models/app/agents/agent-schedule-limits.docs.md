# Agent Scheduling & Limits

> When an agent wakes on its own, and how much it may consume once nobody is watching.

An agent that only answers when spoken to needs neither block. One that wakes on its own needs both.

## The schedule

```yaml
schedule:
  cron: '0 9 * * MON'
  timezone: Europe/Paris
  taskPrompt: Summarize last week's new tickets and post the digest.
```

<!-- sovrium:options AgentScheduleSchema -->

`cron` is a standard five-field expression and `timezone` an IANA identifier defaulting to UTC. Both are validated when the configuration is decoded, by the same parser automation cron triggers use, so a malformed expression or an unknown zone fails validation offline — you find out at your desk rather than from a job that never fired.

`taskPrompt` is the difference between a schedule and an alarm clock. The system prompt says who the agent is; the task prompt says what **this run** is for. Write it as an instruction with a definite end state rather than an open remit like "check the tickets", which gives the model nothing to stop at.

**Set `timezone` whenever the schedule means something to a person.** Nine o'clock in the default UTC fires at ten in Paris for half the year and eleven for the other half, and a digest landing before the working day starts is not a digest anyone reads. A named zone handles daylight saving; an offset baked into the expression does not.

Schedules are armed once the server is accepting requests and torn down on shutdown, so a restart leaves no timer firing an agent the new configuration no longer schedules.

### Which gates a cron run passes

A cron run happens **inside** the server, on the timer you wrote, rather than arriving as a request from outside. That placement decides which gates apply.

| Gate                   | On a cron run                                                                  |
| ---------------------- | ------------------------------------------------------------------------------ |
| The trigger grant      | **Not applied** — a timer is not an external caller                            |
| `enabled: false`       | **Skipped** — a disabled agent is never armed                                  |
| No provider configured | **Skipped** — a run that reached no provider is not work the app has done      |
| `maxConcurrentTasks`   | **Skipped** when no slot is free, which stops a fast cron piling up runs       |
| `maxActionsPerMinute`  | **Not applied** — the cron expression _is_ the rate                            |
| `maxTokensPerDay`      | **Charged** — the run's tokens count against the daily budget                  |
| Approval               | **Applied** — `mode: all` queues at three in the morning rather than executing |

### Triggering the task by hand

`POST /api/agents/{name}/schedule/trigger` runs the same task prompt on demand. That one **is** an external caller and passes every gate the execute endpoint passes: the trigger grant, where a refusal answers `404`; `503` where the deployment has no provider; `202` with a queued status when a rate or concurrency cap is exhausted; and `429` with a retry header when the action rate limit trips. Its tokens are charged like any other run's.

## Limits

<!-- sovrium:options AgentLimitsSchema -->

Every field is optional and falls back to a system default: 30 actions a minute, 200,000 tokens a day, and 5 concurrent tasks.

Each addresses a different failure, and the distinction matters when choosing values:

- **Actions per minute** bounds a loop. An agent that misreads its own output and retries can hammer a table hundreds of times a minute; this is the ceiling that turns that into a slow anomaly instead of an outage.
- **Tokens per day** bounds the bill. It is the only limit here with a direct cost in currency, and the only one you can reason about in advance — estimate a run's tokens, multiply by runs per day, add headroom.
- **Concurrent tasks** bounds contention. It matters most for an agent triggered by users rather than by a clock, where ten people can invoke the same one at once.

```yaml
limits:
  maxActionsPerMinute: 20
  maxTokensPerDay: 150000
  maxConcurrentTasks: 3
```

The token budget resets at midnight **UTC**, whatever the agent's own timezone. An agent scheduled for the late evening in a far-eastern zone is spending against a window that turns over mid-afternoon locally — worth knowing before a run mysteriously stops halfway through.

## Sizing a scheduled agent

Work backwards from the cron. A daily agent reading a hundred records and writing one summary might use twenty thousand tokens and thirty actions, so a hundred-thousand-token budget leaves room for a bad day without leaving room for a runaway one.

An agent running every fifteen minutes runs ninety-six times daily, so the same per-run cost needs a budget two orders of magnitude larger — and is usually a sign that the schedule, rather than the budget, is the thing to reconsider.
