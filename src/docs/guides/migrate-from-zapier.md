# Migrate from Zapier to Sovrium

> Replace a Zap with a self-hosted Sovrium automation — map the trigger and action steps, declare them in config, and run the workflow on your own server.

A Zapier "Zap" is a trigger followed by one or more action steps. A Sovrium automation is the same shape — declared in config, run on your own server, with no task limits.

## Map the steps

| Zapier                         | Sovrium                                             |
| ------------------------------ | --------------------------------------------------- |
| Trigger (app + event)          | an automation `trigger` on a table's `create` event |
| Action: Webhooks by Zapier     | an `http` action with the `post` operator           |
| Action: send email             | an `email` action with the `send` operator          |
| Action: create/update a record | a `record` action with the `create` operator        |
| Filter step                    | an automation `filter`                              |
| `{{field}}` mapping            | `{{trigger.data.field}}` template variables         |

Each trigger and action type has its own article; **Automations Overview** is the map.

## Declare the automation

This app posts every new `leads` row to an outbound webhook — a complete, runnable config:

```yaml
name: lead-intake
version: 1.0.0
tables:
  - id: 1
    name: leads
    fields:
      - id: 1
        name: email
        type: email
        required: true
      - id: 2
        name: source
        type: single-line-text
automations:
  - name: notify-on-new-lead
    trigger:
      type: record
      table: leads
      events: [create]
    actions:
      - type: http
        operator: post
        name: postToWebhook
        props:
          url: https://hooks.example.com/new-lead
          body:
            email: '{{trigger.data.email}}'
```

## Run and verify

```bash
sovrium start app.yaml
```

Create a `leads` record with `POST /api/tables/leads/records` and the webhook fires. Inspect every run in the admin dashboard's automation-run history.

## What does not map

Zapier's hosted third-party **app connectors** have no drop-in equivalent — Sovrium's `http` action calls any API directly, and OAuth-based services use a connection. Multi-step branching becomes automation flow control.
