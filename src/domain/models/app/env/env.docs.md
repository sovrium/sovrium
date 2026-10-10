# Environment Variables

> Declare the variables and secrets an app needs under `env`, then reference them with `$env.NAME` — resolved at runtime and redacted from every log.

The top-level `env` array documents each environment variable the app depends on, whether it must be set, and what to fall back to. At runtime, `$env.VAR_NAME` resolves a value anywhere a template or a connection property is accepted.

```yaml
env:
  - { key: SLACK_WEBHOOK_URL, description: Slack incoming webhook URL, required: false }
  - { key: STRIPE_SECRET, description: Stripe API secret, required: true }
  - { key: REGION, description: Default region, required: false, default: eu-west, secret: false }
```

## Properties

<!-- sovrium:options EnvVarSchema -->

`key` is uppercase snake case and must be unique across the app. `required` defaults to `true`, and boot enforces that default: a required variable with no value and no `default` stops the server at startup with an error naming the key, rather than failing at the first template that reads it. Declare an optional variable with `required: false`. Where both `required` and `default` are present, the default is the fallback and the boot succeeds.

> **Upgrading from 0.28 or earlier:** a variable declared without `required` used to be treated as optional at startup. It is now required, so an app that relied on that leniency stops at boot when the variable has no value and no `default`. Mark each genuinely optional variable `required: false`.

`secret` defaults to **`true`**, and that default is the safe direction. Leave it alone and the `default` value is redacted wherever the configuration is reflected back to an operator. Set `secret: false` only for a default that is genuinely harmless — a port, a region, a base URL — so it renders verbatim in the operator console's view of the configuration as booted, instead of as asterisks.

## Referencing a value

```yaml
env:
  - { key: OPENAI_API_KEY, description: OpenAI API key }
  - { key: SLACK_WEBHOOK_URL, description: Slack incoming webhook URL, required: false }

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

Every `$env.NAME` must be declared in `app.env` — as the `env` block above declares `OPENAI_API_KEY` and `SLACK_WEBHOOK_URL` — or the app does not boot, and `sovrium validate` names the variable to declare. A `default` is used as written: a `$env.NAME` inside it is not resolved, so one variable cannot default to another.

## Only what you wrote is resolved

`$env.NAME` is a reference in the configuration you author, never in data. It is resolved in the text you wrote, before any `{{...}}` template is filled in, so a value a template brings in from outside stays exactly as it arrived: a webhook body, a form submission, a record field or a step's output that contains `$env.STRIPE_SECRET` is stored, sent or echoed as those characters, never as the secret, and text naming a variable nobody declared is kept as written. Mixing both in one value works as you would expect: `$env.BASE_URL/rate?ticket={{trigger.data.record.id}}` resolves the base URL and fills in the id.

Code that needs a variable at runtime reads it from `context.env` in a `code` action rather than building a `$env.` string from data.

Every action resolves the `$env.NAME` references written in its properties, including the actions that read their own properties — `data`, `filter`, `flow`, `digest`, `state` `filterNew`, the file actions, `record` batch writes and `ai` transcription. The one exception is `sovrium` `validateConfig`, which checks its `config` exactly as written. There is no escape: a property that must carry the literal text `$env.NAME` takes it from data, such as a trigger field or a step's output, which is never scanned.

An env value is used as it is stored. A token or a password that contains `{{` or `}}` reaches the action unchanged: it is never read as a template.

Inside a `{{…}}` expression, `$env.NAME` is read as a value, quoted or not: `{{uppercase $env.REGION}}` passes the value to the helper as a string, `{{lookup trigger.data $env.FIELD}}` reads the trigger field the value names, and `{{$env.NAME}}` alone renders it. The value never becomes part of the expression, so an expression kept as written (an unknown helper, a syntax error, or a `regex` whose pattern is not a quoted string) shows `$env.NAME`, never the value. A reference cannot be spliced into a path: `{{trigger.data.$env.FIELD}}` reads a key named `$env`, not the field; use `lookup`.

## Secrets never reach a log

A value resolved from `$env` is redacted from run logs, from the step outputs the operator console shows, and from the runs API. That is why a credential belongs in `env` or in a connection rather than inline in an action's properties: an inlined secret is an ordinary string, and every one of those surfaces prints it.

## This block is the app's, not the operator's

`env` is what the configuration **declares it needs**. It is a different thing from the variables that govern the running instance's own footprint — the `ECO_*` family, the database URL, the storage provider — which are set by whoever operates the deployment and are not part of the app schema at all. An automation's AI actions honour the operator's routing precedence automatically; nothing in `env` overrides it.

A key starting with `SOVRIUM_PLATFORM_SSO_` is refused: those variables carry the client secret of **Sign in with Sovrium Cloud**, which the Cloud sets for an app it hosts, and a declared key would make that secret readable as `$env` by every automation.
