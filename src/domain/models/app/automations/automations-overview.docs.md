# Automations Overview

> One trigger paired with an ordered list of actions — how data flows between steps, and what the whole run is bounded by.

An automation pairs **one trigger** — the event that starts it — with an **ordered list of actions**. When the trigger fires the actions run in sequence, passing data forward through template variables, until the run completes, stops or fails.

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

Exactly one `trigger`, at least one entry in `actions`. Everything else is optional.

<!-- sovrium:options AutomationSchema depth=1 -->

`name` is the automation's identity everywhere it is referenced: in its webhook URL, and as the target of a call from another automation. `timeout` bounds the whole run, accepts 1000 to 900000 milliseconds, and defaults to 300000 — five minutes.

`aiAccess` declares a **manual-trigger** automation invokable through the MCP server. Setting it on an automation triggered any other way is a decode error rather than a no-op, because an assistant cannot meaningfully fire a cron.

## Template variables

Every string property of an action can interpolate runtime values.

| Source           | Syntax                     | Notes                                                                                     |
| ---------------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| Trigger payload  | `{{trigger.data.field}}`   | What the trigger carried — a record row, a webhook body, form values                      |
| Previous step    | `{{stepName.result}}`      | The output of any earlier action, by its `name`                                           |
| Environment      | `$env.VAR_NAME`            | Resolved from the declared `env` block, and redacted in logs                              |
| Connection       | `$connection.NAME`         | Resolved credentials for an external service                                              |
| Helper functions | `{{helperName arg "lit"}}` | Formatting helpers for text, numbers, dates, logic and collections; nest with parentheses |

### Dates

`{{formatDate value pattern [timezone] [locale]}}` renders an instant and `{{parseDate text pattern [timezone]}}` reads one back. Both accept a **closed** set of tokens: anything else is an error and renders an empty string, so a mistyped pattern fails visibly rather than producing a wrong date.

| Token          | Meaning                               | Example  |
| -------------- | ------------------------------------- | -------- |
| `yyyy`         | Year, four digits (alias `YYYY`)      | `2026`   |
| `MM`           | Month, two digits                     | `03`     |
| `dd`           | Day of month, two digits (alias `DD`) | `15`     |
| `HH`           | Hour, two digits, 24-hour             | `14`     |
| `mm`           | Minute, two digits                    | `05`     |
| `ss`           | Second, two digits                    | `09`     |
| `MMMM` / `MMM` | Month name, full or short, localised  | `March`  |
| `EEEE` / `EEE` | Weekday name, full or short           | `Sunday` |

The name tokens are format-only: `parseDate` cannot read them back, because a localised month name is ambiguous across languages. The twelve-hour `h` and the AM/PM `A` of other template languages are **not** tokens. To emit a literal letter, quote it — `{{formatDate value "dd MMMM 'at' HH:mm"}}`.

`timezone` is an IANA zone name and defaults to `UTC`; `locale` is a BCP-47 tag that drives the name tokens.

```yaml
subject: '{{formatDate trigger.data.created_at "dd MMMM yyyy" "Europe/Paris" "fr-FR"}}'
```

`{{now}}` and `{{today}}` take no value argument, and the template engine only calls a zero-argument helper in helper position. Passed bare to another helper, `now` becomes a variable lookup that resolves to nothing and the whole expression renders empty — silently. Wrap it in parentheses: `{{formatDate (now) "yyyy-MM-dd"}}`, never `{{formatDate now "yyyy-MM-dd"}}`.

## Concurrency

Each automation has an independent FIFO semaphore. With `concurrency.limit` set, triggers arriving beyond the limit are persisted as queued and promoted as in-flight slots free. Without the block, the global `AUTOMATION_CONCURRENCY_DEFAULT` applies, which is `5`. Queueing is in-memory and single-process, which matches the single-tenant deployment model and is the reason the limit is per automation rather than global.

## The blocks automations reach for

| Block         | Holds                                                     |
| ------------- | --------------------------------------------------------- |
| `automations` | The workflows themselves                                  |
| `actions`     | Reusable action templates, referenced by the `ref` action |
| `connections` | Stored credentials for authenticated HTTP and AI calls    |
| `env`         | Declared environment variables and secrets                |
