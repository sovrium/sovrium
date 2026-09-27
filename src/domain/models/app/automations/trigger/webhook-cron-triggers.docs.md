# Webhook & Cron Triggers

> The two triggers that fire without anyone using your app — an external system calling in, or the clock.

## Webhook trigger

Exposes an HTTP endpoint at `/api/automations/{name}/webhook` that starts the automation when it is hit.

```yaml
trigger:
  type: webhook
  method: [POST]
  auth: { type: hmac, scheme: stripe, secret: $env.STRIPE_SIGNING_SECRET }
  deduplicationKey: '{{trigger.data.body.id}}'
  deduplicationWindow: 600
```

<!-- sovrium:options WebhookTriggerSchema -->

`deduplicationWindow` is in seconds and defaults to 300. `rateLimit` accepts `window` as an alias for `windowSeconds`.

### The caller waits unless you say otherwise

`respondImmediately` is off by default, which takes the **synchronous** path: the HTTP request stays open until the run completes, so a slow automation becomes a slow response for the sender. Set it to `true` for a fire-and-forget receiver that only needs a fast `202` — most payment and repository providers are exactly that, and several will retry a slow delivery as though it had failed.

### Inbound authentication

`auth.type` is one of `bearer`, `apiKey`, `hmac` or `basic`. The credential fields — `token`, `prefix`, `key`, `header`, `secret`, `algorithm`, `username`, `password` — are optional and, with one exception below, unconditioned by `type`; `algorithm` is a free string rather than a closed set.

Nothing validates that a `bearer` block actually carries a `token`, so an incomplete block passes `sovrium validate` and fails at request time instead. Check an inbound auth block by sending a request at it, not by validating the configuration. Every credential value supports `$env.VAR`.

### Signature schemes

An `hmac` webhook checks a signature the way its `scheme` says the provider writes it. Omitted, the scheme is `hex`.

| `scheme` | Signed string                           | Where the signature is read                                                      |
| -------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| `hex`    | the raw body                            | `header` (default `X-Signature`), after `prefix`, as hex                         |
| `base64` | the raw body                            | `header`, after `prefix`, as base64 — Shopify's format                           |
| `stripe` | `<t>.<raw body>`                        | `Stripe-Signature: t=<t>,v1=<hex>`; any of several `v1` entries may match        |
| `slack`  | `v0:<timestamp>:<raw body>`             | `X-Slack-Signature: v0=<hex>`, with the timestamp in `X-Slack-Request-Timestamp` |
| `svix`   | `<svix-id>.<svix-timestamp>.<raw body>` | `svix-signature: v1,<base64>`, any of several; the secret is the `whsec_…` value |

`stripe`, `slack` and `svix` are always HMAC-SHA256 and fix their own headers, so `header`, `prefix` or `algorithm` beside them is refused when the configuration loads. They also sign a timestamp: a request whose timestamp is more than `tolerance` seconds (300 by default) from the server clock is refused as a replay, however valid its signature. `tolerance` beside `hex` or `base64`, which sign no timestamp, is refused too. Every refusal is a `401` that runs nothing, and every comparison is constant-time.

### Answering a provider's subscription handshake

Some providers check an endpoint before they deliver anything to it. Meta — Facebook Pages and Lead Ads, Instagram, WhatsApp Cloud — sends a `GET` with `hub.mode=subscribe`, `hub.verify_token` and `hub.challenge`, and subscribes only an endpoint that answers the challenge back. Declare `verification` and Sovrium answers it:

```yaml
trigger:
  type: webhook
  method: POST
  verification: { style: meta, verifyToken: $env.META_VERIFY_TOKEN }
  auth: { type: hmac, secret: $env.META_APP_SECRET, header: X-Hub-Signature-256, prefix: 'sha256=' }
```

A handshake presenting the verify token you entered in the provider console is answered `200` with the challenge, verbatim, as plain text. It runs nothing — no run is created — and it is answered before the method check and before `auth`, since the verify token is its only credential. A wrong token, another `hub.mode` or a missing challenge gets the same `404` as a webhook that does not exist, echoing nothing. The signed events the provider then posts go through `auth` and run the automation as usual.

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

`expression` is a standard five-field cron expression, or a six-field one carrying seconds. `timezone` is an IANA zone name; when omitted it is the operator timezone (`SOVRIUM_TIMEZONE`, UTC when unset).

There are **no `@daily`, `@hourly` or `@weekly` aliases** — write the numeric equivalent, `0 0 * * *` or `0 * * * *`. A step of zero, `*/0`, is refused.

Both the expression and the timezone are validated offline, against the IANA database in the timezone's case, so a typo fails `sovrium validate` rather than producing an automation that silently never runs.

Set `timezone` whenever the schedule tracks human working hours. `0 9 * * 1-5` in `UTC` drifts an hour against Paris twice a year, while the same expression in `Europe/Paris` stays at 09:00 local through both daylight-saving transitions.
