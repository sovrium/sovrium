# Triggers Overview

> The nine trigger types at a glance — what starts each one, and the context it exposes to the actions that follow.

A trigger is the single event that starts an automation. Every automation declares exactly one `trigger` object whose `type` selects the variant; the remaining properties configure it.

```yaml
automations:
  - name: order-webhook
    trigger:
      type: webhook
      method: POST
    actions:
      - { name: ack, type: webhook, operator: response, props: { status: 202 } }
```

## The catalogue

| `type`               | Fires when                                                 | Key context exposed                         |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| `webhook`            | An inbound HTTP request hits the automation's endpoint     | `{{trigger.data.body.*}}`, headers, query   |
| `cron`               | A cron schedule elapses                                    | the scheduled time                          |
| `record`             | A record is created, updated or deleted in a watched table | `{{trigger.data.record.*}}`                 |
| `auth`               | An authentication event occurs                             | the auth event and the user                 |
| `form`               | A top-level form is submitted                              | `{{trigger.data.*}}`, the form values       |
| `manual`             | An operator presses a button, or the trigger API is called | `{{trigger.input.*}}`                       |
| `automation-call`    | Another automation invokes this one                        | `{{trigger.input.*}}`, `{{trigger.caller}}` |
| `automation-failure` | A watched automation fails                                 | the failed run and its error                |
| `comment`            | A comment is created on a record                           | the comment and its record                  |

## The trigger namespace is an allowlist

`{{trigger.body}}` and `{{trigger.inputData}}` do not resolve. What lives under `trigger.*` is fixed: a webhook payload is at `{{trigger.data.body.*}}` and caller input at `{{trigger.input.*}}`. `inputData` is the property name on the **calling** side only, which is why it reads as though it should work from inside the callee and does not.

Everything a trigger carries is reachable under `{{trigger.data.*}}`. Eight keys are additionally lifted to the shorter `{{trigger.*}}` — `record`, `comment`, `threadParticipants`, `mentions`, `mentionedEmails`, `input`, `caller` and `depth` — so a record trigger answers to both `{{trigger.record.name}}` and `{{trigger.data.record.name}}`. The short form exists for the triggers whose payload is the point; nothing else is lifted, which is why `{{trigger.body}}` fails while `{{trigger.record}}` works.

A template referencing a path that does not resolve renders empty rather than failing, so this is worth checking directly rather than inferring from a run that produced a blank field.

## Where each one is configured

The nine types are documented in four articles, grouped by what an operator is usually setting up at the time:

- **Webhook and cron** — an endpoint to receive, or a schedule to keep.
- **Record and comment** — reacting to a change in the data.
- **Auth and form** — reacting to something a person did.
- **Manual, sub-automation and failure** — runs started by an operator, by another automation, or by a failure.
