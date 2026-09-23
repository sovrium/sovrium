# Environment Variables

> Declare the variables and secrets an app needs under `env`, then reference them with `$env.NAME` — resolved at runtime and redacted from every log.

The top-level `env` array documents each environment variable the app depends on, whether it must be set, and what to fall back to. At runtime, `$env.VAR_NAME` resolves a value anywhere a template or a connection property is accepted.

```yaml
env:
  - { key: SLACK_WEBHOOK_URL, description: Slack incoming webhook URL }
  - { key: STRIPE_SECRET, description: Stripe API secret, required: true }
  - { key: REGION, description: Default region, required: false, default: eu-west, secret: false }
```

## Properties

<!-- sovrium:options EnvVarSchema -->

`key` is uppercase snake case and must be unique across the app. `required` defaults to `true`: a required variable that is unset fails validation at boot rather than at the first template that reads it. Where both `required` and `default` are present, the default is the fallback and the boot succeeds.

`secret` defaults to **`true`**, and that default is the safe direction. Leave it alone and the `default` value is redacted wherever the configuration is reflected back to an operator. Set `secret: false` only for a default that is genuinely harmless — a port, a region, a base URL — so it renders verbatim in the operator console's view of the configuration as booted, instead of as asterisks.

## Referencing a value

```yaml
connections:
  - name: openai-key
    type: bearer
    props: { token: $env.OPENAI_API_KEY }

automations:
  - name: notify
    trigger: { type: record, table: orders, events: [create] }
    actions:
      - name: ping
        type: http
        operator: post
        props:
          url: $env.SLACK_WEBHOOK_URL
          body: { text: 'New order {{trigger.data.id}}' }
```

## Secrets never reach a log

A value resolved from `$env` is redacted from run logs, from the step outputs the operator console shows, and from the runs API. That is why a credential belongs in `env` or in a connection rather than inline in an action's properties: an inlined secret is an ordinary string, and every one of those surfaces prints it.

## This block is the app's, not the operator's

`env` is what the configuration **declares it needs**. It is a different thing from the variables that govern the running instance's own footprint — the `ECO_*` family, the database URL, the storage provider — which are set by whoever operates the deployment and are not part of the app schema at all. An automation's AI actions honour the operator's routing precedence automatically; nothing in `env` overrides it.
