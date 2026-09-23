# Webhook & Cron Triggers

> The two triggers that fire without anyone using your app — an external system calling in, or the clock.

## Webhook trigger

Exposes an HTTP endpoint at `/api/automations/{name}/webhook` that starts the automation when it is hit.

```yaml
trigger:
  type: webhook
  method: [POST]
  auth: { type: hmac, secret: $env.STRIPE_SIGNING_SECRET, algorithm: sha256 }
  deduplicationKey: '{{trigger.data.body.id}}'
  deduplicationWindow: 600
```

<!-- sovrium:options WebhookTriggerSchema -->

`deduplicationWindow` is in seconds and defaults to 300. `rateLimit` accepts `window` as an alias for `windowSeconds`.

### The caller waits unless you say otherwise

`respondImmediately` is off by default, which takes the **synchronous** path: the HTTP request stays open until the run completes, so a slow automation becomes a slow response for the sender. Set it to `true` for a fire-and-forget receiver that only needs a fast `202` — most payment and repository providers are exactly that, and several will retry a slow delivery as though it had failed.

### Inbound authentication

`auth.type` is one of `bearer`, `apiKey`, `hmac` or `basic`. The credential fields — `token`, `prefix`, `key`, `header`, `secret`, `algorithm`, `username`, `password` — are **all optional and unconditioned by `type`**, and `algorithm` is a free string rather than a closed set.

Nothing validates that a `bearer` block actually carries a `token`, so an incomplete block passes `sovrium validate` and fails at request time instead. Check an inbound auth block by sending a request at it, not by validating the configuration. Every credential value supports `$env.VAR`.

### What the payload looks like

The body is **not** at `{{trigger.body}}`. The available paths are `{{trigger.data.body.*}}`, `{{trigger.data.headers.*}}` and `{{trigger.data.query.*}}`, plus `{{trigger.data.method}}`, `{{trigger.data.path}}` and `{{trigger.data.ip}}`. Scalar body fields are additionally flattened to `{{trigger.data.<field>}}`, which is a convenience rather than the contract — a nested object is only reachable through the full path.

## Cron trigger

Runs the automation on a schedule.

```yaml
trigger:
  type: cron
  expression: '0 9 * * 1-5'
  timezone: Europe/Paris
```

<!-- sovrium:options CronTriggerSchema -->

`expression` is a standard five-field cron expression, or a six-field one carrying seconds. `timezone` is an IANA zone name and defaults to `UTC`.

There are **no `@daily`, `@hourly` or `@weekly` aliases** — write the numeric equivalent, `0 0 * * *` or `0 * * * *`. A step of zero, `*/0`, is refused.

Both the expression and the timezone are validated offline, against the IANA database in the timezone's case, so a typo fails `sovrium validate` rather than producing an automation that silently never runs.

Set `timezone` whenever the schedule tracks human working hours. `0 9 * * 1-5` in `UTC` drifts an hour against Paris twice a year, while the same expression in `Europe/Paris` stays at 09:00 local through both daylight-saving transitions.
