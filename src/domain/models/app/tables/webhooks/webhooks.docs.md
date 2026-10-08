# Table Webhooks

> Outgoing HTTP on record events — which events fire, how the request is authenticated, how a failure is retried, and what the payload carries.

Add `webhooks` to a table to fire an outgoing `POST` when records are created, updated, deleted or restored from the trash. A webhook fires whichever way the record was written — the records API, a batch call, an upsert, a form, the assistant, a CSV import or an automation step — once per record. `sovrium seed` fires nothing, so loading demo data never reaches a production receiver. A webhook is sugar over an automation: it expands internally to a record trigger plus a send action, which is why its retry and authentication options read like an automation's. Webhook names are unique within the table.

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

A delivery is not sent to a private, loopback or link-local address, and neither is any redirect the receiver answers with: each hop is checked before it is requested and up to five are followed, so a receiver that later answers `302` to an internal address gets a failed delivery whose logged error names the refusal (`invalid_outbound_url_<reason>`). Up to 64 KiB of the receiver's answer is kept in the delivery log.

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

The delivery log records which headers a delivery sent, never a credential: every header `auth` adds — `Authorization`, the API-key header under whatever name you gave it, the signature — is stored with its value replaced by `***`. The receiver gets the real value; nobody reads it back out of the log.

## Events

`events` lists what the webhook is told about: `create`, `update`, `delete` and `restore`. Each is sent as `record.<event>` with the record in `data.record`; a `restore` carries the record as restored, like a `create`, and is not a `create` — a receiver mirroring deletes learns that the record is back. A webhook that does not list `restore` is never sent one.

## Imports

A CSV import fires one delivery per imported row, like any other write. Loading a large file into a table whose webhooks notify customers is usually not what you want, so a table can make its imports silent:

```yaml
tables:
  - name: contacts
    fields:
      - { name: email, type: email }
    import: { fireEvents: false }
```

An import into that table then sends no webhook and starts no record automation. Every other way of writing to the table — a form, the records API, a batch call, an automation — still fires as usual. The setting covers webhooks and record automations together.

## Delivery

Every delivery is recorded together with the record it is about, so a write that is saved always has its delivery owed, and a write that fails sends nothing. It is attempted right after the write. When the receiver fails, `retry` decides what happens next: a retry due within a few seconds is made straight away; a later one is kept and made by a sweep that runs every minute, so a delivery survives a receiver outage and a restart of the server. A kept retry runs within about a minute of its time.

Every request carries an `X-Sovrium-Delivery-Id` header. It is the same on every attempt of one delivery, and on a retry you send from the delivery log, and it differs between deliveries. A receiver can therefore see the same delivery twice — if the server stopped just after the receiver answered — and should skip an id it has already processed.

After `1 + maxAttempts` failed attempts the delivery is given up and logged once, as `failed`, with the number of attempts made. A delivery that succeeds is logged once as `success`. A delivery waiting for a later retry is not in the log yet.

A delivery is kept for seven days after it succeeds or is given up, then deleted together with its entry in the delivery log, so the log shows about the last week of deliveries.

Erasing a user's account also removes every delivery about her records — still owed, which are then never sent, or already sent — with its entry in the delivery log.

## Retry policy

<!-- sovrium:options WebhookRetrySchema -->

```yaml
retry: { maxAttempts: 5, backoff: exponential, initialDelay: 1000, maxDelay: 300000 }
```

`maxAttempts` counts the retries after the initial failure, so `0` disables retrying without disabling the webhook. `exponential` backoff is the right default for a receiver that is down rather than slow: a fixed delay turns an outage into a steady load against a service already struggling.

Omit `retry` entirely and a webhook still retries: three attempts, exponential, first after one second, capped at sixty. Those retries are made straight away, so the defaults ride out a blip, not an outage; to ride out a receiver that is down for an hour, give it longer delays, as the example above does. The example above widens that cap to five minutes, which is a choice rather than the default.

**`maxAttempts` is the one key without a default of its own.** The moment a `retry` block is present it is required, so `retry: { backoff: fixed }` is refused at validation rather than falling back to three. Write the attempt count whenever you write the block.

## Payload selection

`payload` shapes what is sent. The payload starts from the whole record, whoever wrote it — the writer's own field permissions do not narrow it — less one thing, removed first: a field whose `read` rule in `permissions.fields` admits no role is never sent. It is left out of `data.record`, `previousValues` and `changedFields`, and naming it in `includeFields` does not bring it back. A field at least one role may read, an admin-only one included, is sent as usual, so `payload` is the only thing that narrows it. `includeFields` and `excludeFields` are mutually exclusive, and every field named must exist on the table — the implicit `id` always counts as one.

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
