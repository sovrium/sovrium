# Table Webhooks

> Outgoing HTTP on record events — which events fire, how the request is authenticated, how a failure is retried, and what the payload carries.

Add `webhooks` to a table to fire an outgoing `POST` when records are created, updated or deleted. A webhook is sugar over an automation: it expands internally to a record trigger plus a send action, which is why its retry and authentication options read like an automation's. Webhook names are unique within the table.

## Webhook properties

<!-- sovrium:options WebhookSchema depth=1 -->

```yaml
webhooks:
  - name: order_created
    url: https://hooks.example.com/orders
    events: [create]
    enabled: true
```

`url` must be an absolute `http` or `https` URL; anything else is refused when the configuration is decoded rather than at the first delivery.

## Authentication

`auth` secures the outgoing request. Secrets, keys and tokens accept an `$env.` reference, which is how a credential stays out of the configuration file.

**`$env` here reads only variables the app declares in `app.env`**, as everywhere else in the configuration: the operator's value first, then the declared `default`. A reference to a variable `app.env` does not declare is refused at boot and by `sovrium validate`, with a message naming the variable to declare, even when the server's environment sets it. Configuration cannot read an arbitrary server variable by naming it. Each example below therefore needs its variable declared, for instance `env: [{ key: PARTNER_WEBHOOK_SECRET }]` at the top of the app.

<!-- sovrium:options WebhookAuthSchema -->

```yaml
# Requires env: [{ key: PARTNER_WEBHOOK_SECRET }, { key: SERVICE_API_KEY }, { key: API_BEARER_TOKEN }] at the top of the app
webhooks:
  - name: order_created
    url: https://hooks.example.com/orders
    events: [create]
    auth: { type: hmac, secret: '$env.PARTNER_WEBHOOK_SECRET', algorithm: sha256 }
  - name: order_shipped
    url: https://hooks.example.com/shipments
    events: [update]
    auth: { type: apiKey, key: '$env.SERVICE_API_KEY', header: X-API-Key }
  - name: order_cancelled
    url: https://hooks.example.com/cancellations
    events: [delete]
    auth: { type: bearer, token: '$env.API_BEARER_TOKEN' }
```

`hmac` is the one to prefer where the receiver can verify it: the signature covers the body, so the receiver learns both who sent the request and that nothing altered it in transit. A bearer token or an API key proves only the first.

## Retry policy

<!-- sovrium:options WebhookRetrySchema -->

```yaml
retry: { maxAttempts: 5, backoff: exponential, initialDelay: 1000, maxDelay: 300000 }
```

`maxAttempts` counts the retries after the initial failure, so `0` disables retrying without disabling the webhook. `exponential` backoff is the right default for a receiver that is down rather than slow: a fixed delay turns an outage into a steady load against a service already struggling.

Omit `retry` entirely and a webhook still retries: three attempts, exponential, first after one second, capped at sixty. The example above widens that cap to five minutes, which is a choice rather than the default.

**`maxAttempts` is the one key without a default of its own.** The moment a `retry` block is present it is required, so `retry: { backoff: fixed }` is refused at validation rather than falling back to three. Write the attempt count whenever you write the block.

## Payload selection

`payload` shapes what is sent. `includeFields` and `excludeFields` are mutually exclusive, and every field named must exist on the table — the implicit `id` always counts as one.

<!-- sovrium:options WebhookPayloadSchema -->

```yaml
payload: { includeFields: [customer, status, total], includePreviousValues: true }
```

Prefer `includeFields` where the receiver is a third party. A whitelist keeps a column added later out of the payload by default; a blacklist sends it the day it appears.

`data.record.id` is the record's id exactly as the records API returned it when the record was created — a string — on every event. A relationship value in `data.record` or `previousValues` is the related record's id as a string too.

## Managing webhooks over the API

Five routes manage a table's webhooks: the list of its webhooks, a webhook's delivery log, one delivery, a retry of a delivery, and a test send. **They are for admin-equivalent roles** (see Roles & RBAC), so a custom top role is admitted, and so is the built-in `admin` even when a custom role outranks it. Every other signed-in caller, whatever it may do to the table's records, gets the same `404` as for a table that does not exist, and a retry or a test from such a caller sends nothing. A caller with no session gets `401`. An app without `auth` has no admin, so these routes answer `404` to every visitor.

The restriction is deliberate. The list and every delivery carry the webhook's URL, which often holds a token, and a retry or a test sends a request with the webhook's credentials. A retry sends the stored payload again and logs it as a new delivery. A test sends a `webhook.test` payload made of sample values shaped like the table's fields. Neither changes a record.

## A full example

```yaml
# Requires env: [{ key: ORDER_WEBHOOK_SECRET }] at the top of the app
webhooks:
  - name: order_lifecycle
    url: https://hooks.example.com/orders
    events: [create, update, delete]
    enabled: true
    auth: { type: hmac, secret: '$env.ORDER_WEBHOOK_SECRET', algorithm: sha256 }
    retry: { maxAttempts: 5, backoff: exponential, initialDelay: 1000, maxDelay: 300000 }
    payload: { excludeFields: [internal_notes], includePreviousValues: true }
```
