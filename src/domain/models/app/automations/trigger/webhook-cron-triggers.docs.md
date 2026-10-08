# Webhook & Cron Triggers

> The two triggers that fire without anyone using your app — an external system calling in, or the clock.

## Webhook trigger

Exposes an HTTP endpoint at `/api/automations/{name}/webhook` that starts the automation when it is hit.

```yaml
# Requires env: [{ key: STRIPE_SIGNING_SECRET }] at the top of the app
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

### What the caller gets back

On the synchronous path, the default answer names the run and nothing it read:

```json
{ "id": "550e8400-e29b-41d4-a716-446655440000", "status": "completed" }
```

`status` is `completed`, `completed-with-errors` (a step failed under `continueOnError` and the run went on), `failed`, `skipped`, `cancelled` or `waiting-approval` (the run is paused on an approval request). A run whose step failed is answered `500`, with the same two keys. No step's output and no step's error is ever part of this answer, whatever the last step was: a webhook's caller is whoever holds its URL, often a service signed in to nothing, while the steps read under the run's own authority. The run's steps, their outputs and its error stay in its run history (`GET /api/automations/runs/{id}`) for whoever may read the run.

To send data back, say so with a `webhook/response` action. It answers exactly the status, headers and body it declares, with nothing merged in, and its templates see every earlier step:

```yaml
automations:
  - name: lookup-contact
    trigger: { type: webhook, method: POST }
    actions:
      - name: lookup
        type: record
        operator: read
        props: { table: contacts, id: '{{trigger.data.contactId}}' }
      - name: answer
        type: webhook
        operator: response
        props:
          status: 200
          headers: { X-Lookup: contacts }
          body: { found: true, name: '{{steps.lookup.record.name}}' }
```

A body value that is exactly one template keeps the type of what it names: `'{{steps.lookup.record}}'` returns the whole record as a JSON object, a number field arrives as a number, a checkbox as `true` or `false`, and an empty field as `null`. A template that names nothing leaves its key out of the body. A value that mixes text with a template is always a string:

```yaml
body:
  contact: '{{steps.lookup.record}}' # the record, as a JSON object
  score: '{{steps.lookup.record.score}}' # 42, a number
  summary: 'Contact {{steps.lookup.record.name}} scores {{steps.lookup.record.score}}' # a string
```

A whole record carries every field the step read, so name the fields to return when some of them are not the caller's to see.

`trigger.response` shapes the answer too, but its `body` and `headers` templates see `{{run.id}}` and `{{trigger.data.*}}` only. A `{{steps.*}}` path is not in their reach and renders empty, so step data goes through the `webhook/response` action, which wins when both are present. Setting `trigger.response.status` also keeps that status when a step fails, instead of the `500`. With `respondImmediately: true` the caller gets `202` and `{ "id", "runId" }`, both the run's id, and nothing else.

Whichever shapes it, the answer's body is JSON in which `<`, `>` and `&` are written as `\u003c`, `\u003e` and `\u0026`, even under a declared `Content-Type: text/html`. A JSON parser reads the same value; a browser opening the URL never finds markup that came from the request.

The manual trigger (`POST /api/automations/{name}/trigger`) answers differently, on purpose: it also returns the last step's `output` and a failed step's `error`. Its caller is signed in and started the run herself, and every step of a run started by hand reads within what she may read, so its answer shows her nothing beyond her own reach.

### Inbound authentication

`auth.type` is one of `bearer`, `apiKey`, `hmac` or `basic`. The credential fields — `token`, `prefix`, `key`, `header`, `secret`, `algorithm`, `username`, `password` — are optional and, with one exception below, unconditioned by `type`; `algorithm` is a free string rather than a closed set.

Nothing validates that a `bearer` block actually carries a `token`, so an incomplete block passes `sovrium validate` and fails at request time instead. Check an inbound auth block by sending a request at it, not by validating the configuration. Every credential value supports `$env.VAR`.

### Signature schemes

An `hmac` webhook checks a signature the way its `scheme` says the provider writes it. Omitted, the scheme is `hex`.

| `scheme`         | Signed string                           | Where the signature is read                                                       |
| ---------------- | --------------------------------------- | --------------------------------------------------------------------------------- |
| `hex`            | the raw body                            | `header` (default `X-Signature`), after `prefix`, as hex                          |
| `base64`         | the raw body                            | `header`, after `prefix`, as base64 — Shopify's format                            |
| `stripe`         | `<t>.<raw body>`                        | `Stripe-Signature: t=<t>,v1=<hex>`; any of several `v1` entries may match         |
| `slack`          | `v0:<timestamp>:<raw body>`             | `X-Slack-Signature: v0=<hex>`, with the timestamp in `X-Slack-Request-Timestamp`  |
| `svix`           | `<svix-id>.<svix-timestamp>.<raw body>` | `svix-signature: v1,<base64>`, any of several; the secret is the `whsec_…` value  |
| `hmac-timestamp` | set by the layout                       | the `header` you name, laid out as `format` says or as its keys spell out, as hex |

`stripe`, `slack` and `svix` are always HMAC-SHA256 and fix their own headers, so `header`, `prefix` or `algorithm` beside them is refused when the configuration loads. They also sign a timestamp: a request whose timestamp is more than `tolerance` seconds (300 by default) from the server clock is refused as a replay, however valid its signature. `tolerance` beside `hex` or `base64`, which sign no timestamp, is refused too. Every refusal is a `401` that runs nothing, and every comparison is constant-time.

`hmac-timestamp` is for a sender that signs the way Stripe does but under its own header. Name the header and pick the layout from `format`; the signature is always the hex HMAC-SHA256 of the signed string under `secret`.

| `format`           | Signed string     | Example sender                                                                   |
| ------------------ | ----------------- | -------------------------------------------------------------------------------- |
| `t=<ts>,v1=<sig>`  | `<ts>.<raw body>` | Calendly, in `Calendly-Webhook-Signature`; any of several `v1` entries may match |
| `ts=<ts>;h1=<sig>` | `<ts>:<raw body>` | Paddle Billing, in `Paddle-Signature`                                            |
| `t=<ts>,v0=<sig>`  | `<ts>.<raw body>` | Unipile, in `unipile-signature`                                                  |

```yaml
# Requires env: [{ key: CALENDLY_WEBHOOK_SIGNING_KEY }] at the top of the app
trigger:
  type: webhook
  method: POST
  auth:
    type: hmac
    scheme: hmac-timestamp
    header: Calendly-Webhook-Signature
    format: t=<ts>,v1=<sig>
    secret: $env.CALENDLY_WEBHOOK_SIGNING_KEY
    tolerance: 180
```

A sender whose layout no `format` names is declared by spelling the layout out instead: `timestampKey` and `signatureKey` name the two entries of the header, `separator` the character between entries (`,` by default, or `;`), and `join` the character between the timestamp and the raw body in the signed string (`.` by default, or `:`). Several entries under the signature key may appear; one matching is enough.

```yaml
# Requires env: [{ key: RELAY_WEBHOOK_SECRET }] at the top of the app
trigger:
  type: webhook
  method: POST
  auth:
    type: hmac
    scheme: hmac-timestamp
    header: X-Relay-Signature
    timestampKey: ts
    signatureKey: sig1
    separator: ';'
    join: ':'
    secret: $env.RELAY_WEBHOOK_SECRET
```

`header` is required with `hmac-timestamp`, and so is exactly one layout: `format`, or `timestampKey` with `signatureKey`. Both at once, one key without the other, or `separator` and `join` without the keys is refused when the configuration loads; so are `format` and the four layout keys beside any other scheme, and `prefix` or `algorithm` beside `hmac-timestamp`. Its timestamp follows the same `tolerance` rule as the named schemes, and a refusal is the same `401` that runs nothing.

### Answering a provider's subscription handshake

Some providers check an endpoint before they deliver anything to it. Meta — Facebook Pages and Lead Ads, Instagram, WhatsApp Cloud — sends a `GET` with `hub.mode=subscribe`, `hub.verify_token` and `hub.challenge`, and subscribes only an endpoint that answers the challenge back. Declare `verification` and Sovrium answers it:

```yaml
# Requires env: [{ key: META_VERIFY_TOKEN }, { key: META_APP_SECRET }] at the top of the app
trigger:
  type: webhook
  method: POST
  verification: { style: meta, verifyToken: $env.META_VERIFY_TOKEN }
  auth: { type: hmac, secret: $env.META_APP_SECRET, header: X-Hub-Signature-256, prefix: 'sha256=' }
```

A handshake presenting the verify token you entered in the provider console is answered `200` with the challenge, verbatim, as plain text. It runs nothing — no run is created — and it is answered before the method check and before `auth`, since the verify token is its only credential. A wrong token, another `hub.mode` or a missing challenge gets the same `404` as a webhook that does not exist, echoing nothing. The signed events the provider then posts go through `auth` and run the automation as usual.

`GET /api/automations`, the automation listing every signed-in member reads, never carries a webhook secret: the verify token, a signing `secret` and every secret field of `auth` are listed as `[redacted]`, whether you wrote a literal value or an `$env` reference.

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
