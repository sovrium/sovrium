# Automations Overview

> A trigger — or a list of them — paired with an ordered list of actions — how data flows between steps, and what the whole run is bounded by.

An automation pairs **a trigger** — the event that starts it, or a `triggers` list of up to ten events that each start it — with an **ordered list of actions**. When a trigger fires the actions run in sequence, passing data forward through template variables, until the run completes, stops or fails.

Automations are declared under the top-level `automations` array. Triggers react to record changes, schedules, inbound webhooks, auth events, form submissions, manual buttons, calls from another automation, another automation's failure, and comments. Actions span more than twenty families: HTTP, record writes, email, AI, file operations, flow control, approvals.

```yaml
automations:
  - name: new-order-alert
    label: Notify the team about new orders
    trigger:
      type: record
      table: orders
      events: [create]
    actions:
      - name: notifyTeam
        type: email
        operator: send
        props:
          to: '{{trigger.data.owner_email}}'
          subject: 'New order {{trigger.data.id}}'
          body: 'Amount: {{trigger.data.amount}}'
    timeout: 60000
```

## Anatomy

Either `trigger` or `triggers` (1 to 10 entries, never both), and at least one entry in `actions`. Everything else is optional. Triggers Overview covers the rules of a `triggers` list.

<!-- sovrium:options AutomationInputSchema depth=1 -->

`name` is the automation's identity everywhere it is referenced: in its webhook URL, and as the target of a call from another automation. `timeout` bounds the whole run, accepts 1000 to 3600000 milliseconds, and defaults to 900000 — fifteen minutes of active execution, since time spent waiting in the queue or for an approval does not count. The `SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS` environment variable changes that default for the whole instance.

`aiAccess` declares an automation invokable through the MCP server, which starts it through its **manual** trigger. One of its triggers must be manual: setting `aiAccess` on an automation with none is a decode error rather than a no-op, because an assistant cannot meaningfully fire a cron.

## Template variables

Every string property of an action can interpolate runtime values.

| Source           | Syntax                     | Notes                                                                                                                                 |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger payload  | `{{trigger.data.field}}`   | What the trigger carried — a record row, a webhook body, form values                                                                  |
| Trigger          | `{{trigger.name}}`         | The trigger that started the run: its `name`, else its type; `{{trigger.type}}` is its type                                           |
| Previous step    | `{{stepName.result}}`      | The output of any earlier action, by its `name`                                                                                       |
| Environment      | `$env.VAR_NAME`            | Resolved from the declared `env` block in the text you wrote, never in a value a template brings in; redacted in logs                 |
| Connection       | `$connection.NAME`         | Resolved credentials for an external service                                                                                          |
| Helper functions | `{{helperName arg "lit"}}` | Formatting helpers for text, numbers, dates, logic and collections; nest with parentheses. Every helper is listed in Template Helpers |

### What a later step reads about an earlier one

Beside its output, every named step that ran exposes three values under `steps.<name>`:

- `durationMs` — how long the step took, in whole milliseconds, from the moment its action started to the moment it settled. A step with a retry policy counts every attempt and every wait between them, so measure a single request on a step that declares no retry.
- `status` — `completed`, or `failed` for a step whose failure `continueOnError` let the run go past. These are the words the run history uses for the step.
- `error.message` — present when the step failed: the error text the run history records. An `http` step adds `error.code` (HTTP & Webhook Actions lists the codes).

The output always wins: an action whose output already has a `status` or an `error` keeps its own, so `{{steps.ship.status}}` still reads what a `code` step returned. Inside a loop or a path, the steps that follow read these values for the current item or path. They are not added to the step's recorded output; the run history shows `durationMs` on each top-level step it lists (a step inside a loop or a path shows none).

### Dates

`{{formatDate value pattern [timezone] [locale]}}` renders an instant and `{{parseDate text pattern [timezone]}}` reads one back. Both accept a **closed** set of tokens: anything else is an error and renders an empty string, so a mistyped pattern fails visibly rather than producing a wrong date.

| Token          | Meaning                                                | Example  |
| -------------- | ------------------------------------------------------ | -------- |
| `yyyy`         | Year, four digits (alias `YYYY`)                       | `2026`   |
| `MM`           | Month, two digits                                      | `03`     |
| `dd`           | Day of month, two digits (alias `DD`)                  | `15`     |
| `d`            | Day of month, no leading zero (alias `D`), format only | `5`      |
| `HH`           | Hour, two digits, 24-hour                              | `14`     |
| `mm`           | Minute, two digits                                     | `05`     |
| `ss`           | Second, two digits                                     | `09`     |
| `MMMM` / `MMM` | Month name, full or short, localised                   | `March`  |
| `EEEE` / `EEE` | Weekday name, full or short                            | `Sunday` |

The name tokens are format-only: `parseDate` cannot read them back, because a localised month name is ambiguous across languages. The twelve-hour `h` and the AM/PM `A` of other template languages are **not** tokens. To emit a literal letter, quote it — `{{formatDate value "dd MMMM 'at' HH:mm"}}`.

`timezone` is an IANA zone name and defaults to the operator timezone (`SOVRIUM_TIMEZONE`, UTC when unset); `locale` is a BCP-47 tag that drives the name tokens.

```yaml
subject: '{{formatDate trigger.data.created_at "dd MMMM yyyy" "Europe/Paris" "fr-FR"}}'
```

`{{now}}` and `{{today}}` take no value argument, and the template engine only calls a zero-argument helper in helper position. Passed bare to another helper, `now` becomes a variable lookup that resolves to nothing and the whole expression renders empty — silently. Wrap it in parentheses: `{{formatDate (now) "yyyy-MM-dd"}}`, never `{{formatDate now "yyyy-MM-dd"}}`.

The pattern of `{{regex}}` and `{{matchAll}}` must be a quoted string written in the configuration: a pattern that reaches the helper from data — a trigger field, a step output, a variable, an `$env` reference or a subexpression — is refused, and the expression is kept as its own source text, as an unknown helper is. A pattern you write is compiled as written and runs on the server's only thread, so avoid nested quantifiers such as `(a+)+`: past the JavaScript engine's backtracking limit the match reports nothing rather than an error, and the helper renders an empty string even where the text matches. How long the match runs before the engine gives up depends on the server: around half a second on a fast, idle machine, and longer on a slower or busier one, during which that thread does nothing else.

Besides `data`, a few keys sit directly under `trigger`: `type` and `name` on every run, and the payload keys Triggers Overview lists (`record`, `comment`, `input`, `caller` and others) on the runs whose trigger carries them.

## Concurrency

Each automation has an independent FIFO semaphore. With `concurrency.limit` set, triggers arriving beyond the limit are persisted as queued and promoted as in-flight slots free. Without the block, the global `AUTOMATION_CONCURRENCY_DEFAULT` applies, which is `5`. Queueing is in-memory and single-process, which matches the single-tenant deployment model and is the reason the limit is per automation rather than global.

## The blocks automations reach for

| Block         | Holds                                                     |
| ------------- | --------------------------------------------------------- |
| `automations` | The workflows themselves                                  |
| `actions`     | Reusable action templates, referenced by the `ref` action |
| `connections` | Stored credentials for authenticated HTTP and AI calls    |
| `env`         | Declared environment variables and secrets                |
