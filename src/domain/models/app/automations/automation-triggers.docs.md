# Triggers Overview

> The nine trigger types at a glance — what starts each one, the context it exposes to the actions that follow, and how one automation starts on several.

A trigger is the event that starts an automation. Most automations declare one `trigger` object whose `type` selects the variant; the remaining properties configure it. An automation that must run on more than one event declares a `triggers` list instead — see [Several triggers](#several-triggers).

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

| `type`               | Fires when                                                 | Key context exposed                                            |
| -------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| `webhook`            | An inbound HTTP request hits the automation's endpoint     | `{{trigger.data.body.*}}`, headers, query                      |
| `cron`               | A cron schedule elapses                                    | the scheduled time                                             |
| `record`             | A record is created, updated or deleted in a watched table | `{{trigger.data.record.*}}`                                    |
| `auth`               | An authentication event occurs                             | the auth event and the user                                    |
| `form`               | A top-level form is submitted                              | `{{trigger.data.*}}`, the form values                          |
| `manual`             | An operator presses a button, or the trigger API is called | `{{trigger.input.*}}`; over the API, also `{{trigger.data.*}}` |
| `automation-call`    | Another automation invokes this one                        | `{{trigger.input.*}}`, `{{trigger.caller}}`                    |
| `automation-failure` | A watched automation fails                                 | the failed run and its error                                   |
| `comment`            | A comment is created on a record                           | the comment and its record                                     |

## The trigger namespace is an allowlist

`{{trigger.body}}` and `{{trigger.inputData}}` do not resolve. What lives under `trigger.*` is fixed: a webhook payload is at `{{trigger.data.body.*}}`, and the input of a manual run — however it was started — or of a run a calling automation hands over is at `{{trigger.input.*}}`; a manual run started over the API also keeps its body's keys at `{{trigger.data.*}}`. `inputData` is the property name on the **calling** side only, which is why it reads as though it should work from inside the callee and does not.

Everything a trigger carries is reachable under `{{trigger.data.*}}`, and every run reads the trigger that started it at `{{trigger.type}}` and `{{trigger.name}}`. Eight keys are additionally lifted to the shorter `{{trigger.*}}` — `record`, `comment`, `threadParticipants`, `mentions`, `mentionedEmails`, `input`, `caller` and `depth` — so a record trigger answers to both `{{trigger.record.name}}` and `{{trigger.data.record.name}}`. The short form exists for the triggers whose payload is the point; nothing else is lifted, which is why `{{trigger.body}}` fails while `{{trigger.record}}` works.

A template referencing a path that does not resolve renders empty rather than failing, so this is worth checking directly rather than inferring from a run that produced a blank field.

## Several triggers

`triggers` takes 1 to 10 trigger objects, each starting the same actions. Declare either `trigger` or `triggers`, never both: `trigger: {…}` means exactly `triggers: [{…}]`.

```yaml
automations:
  - name: sync-stock
    triggers:
      - { name: nightly, type: cron, expression: '0 2 * * *', timezone: Europe/Paris }
      - { name: warehouse, type: webhook, method: POST }
      - { name: operator, type: manual, requiredRole: admin }
    actions:
      - name: pushStock
        type: http
        operator: post
        props:
          url: 'https://erp.example.com/stock-sync'
          body: { startedBy: '{{trigger.name}}' }
```

Every trigger may carry a `name` — kebab-case, at most 50 characters, unique within the automation. Left out, a trigger is named after its type, so the single trigger of an older automation is `webhook`, `cron` and so on. A run reads the trigger that started it at `{{trigger.type}}` and `{{trigger.name}}`, and the run history records and filters on that name.

- **One address each.** A `webhook`, `manual`, `form` or `automation-call` trigger is reached through the automation's one address, so it appears at most once. A `cron`, `record`, `auth`, `comment` or `automation-failure` trigger may repeat, and every repetition needs a `name`. Two record triggers may not watch the same event of the same table: one write would start two runs.
- **One run per event.** An event that matches several entries of the same automation starts one run, under the first matching entry. Two schedules falling due at the same tick — the minute for a five-field expression, the second for a six-field one — start one run, named after the first of them in the list.
- **Each trigger keeps its own rules.** The manual trigger's `requiredRole` gates the trigger endpoint, the MCP tool and the chat; a public webhook beside it does not open that gate, and the role does not close the webhook. The webhook keeps its own auth and signature check.
- **A webhook answer needs a webhook caller.** A `webhook` `response` step answers the webhook caller only: a run another trigger started records the step as `skipped` and goes on.
- **AI access needs a manual trigger.** `aiAccess` is accepted when one of the triggers is manual; an AI client starts the automation through that entry.

To run a different step on one road, branch on `{{trigger.name}}` with a `path` step. When the steps differ throughout, give each road its own automation.

## Where each one is configured

The nine types are documented in four articles, grouped by what an operator is usually setting up at the time:

- **Webhook and cron** — an endpoint to receive, or a schedule to keep.
- **Record and comment** — reacting to a change in the data.
- **Auth and form** — reacting to something a person did.
- **Manual, sub-automation and failure** — runs started by an operator, by another automation, or by a failure.
