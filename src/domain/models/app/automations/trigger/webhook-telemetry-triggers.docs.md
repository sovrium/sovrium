# Telemetry Ingest

> Receive errors, performance transactions and logs from any Sentry-compatible client or OpenTelemetry exporter, and turn each report into an automation run.

A webhook trigger that declares a `protocol` stops being an ordinary webhook. Instead of `/api/automations/{name}/webhook` and a JSON body, it serves the standard paths of a telemetry protocol, so a client needs nothing but a DSN or an endpoint to report into your app: a Sentry-compatible SDK, another Sovrium server's `SENTRY_DSN`, or an OTLP/HTTP JSON log exporter.

```yaml
trigger:
  type: webhook
  method: POST
  protocol: sentry
  items: [event]
  auth: { type: projectKey, table: apps, keyField: ingest_key }
  rateLimit: { per: project, maxRequests: 600, windowSeconds: 60 }
```

Each sender is a row of one of your tables. The client presents that row's key, the run sees the row as `trigger.project`, and what the client sent arrives decoded in `trigger.data`. That decoded item is the whole of `trigger.data`: unlike an ordinary webhook, a telemetry run has no `trigger.data.body`, so `{{json trigger.data}}` holds it once. What happens next is ordinary configuration: store the event, upsert an issue, email someone, chart the transactions.

## The two protocols

| `protocol`  | Served at (`POST`)                                       | Body                                              | The client's key                                                    |
| ----------- | -------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| `sentry`    | `/api/<project>/envelope/` and `/api/<project>/envelope` | a Sentry envelope: NDJSON, plain, gzip or deflate | `x-sentry-auth: Sentry …, sentry_key=<key>`, or `?sentry_key=<key>` |
| `otlp-logs` | `/v1/logs`                                               | OTLP/HTTP JSON logs, plain, gzip or deflate       | `Authorization: Bearer <key>`                                       |

The paths are mounted as soon as one automation declares the protocol, and every automation declaring the same protocol runs for what arrives. An app that declares no `sentry` receiver answers `404` at the envelope path. OTLP traces and metrics are not received: `/v1/traces` and `/v1/metrics` answer `404`. Performance data arrives as Sentry transactions.

A client is pointed at the receiver with the key and id of its row:

```bash
SENTRY_DSN=https://<ingest_key>@monitor.example.com/<row id>
OTEL_EXPORTER_OTLP_ENDPOINT=https://monitor.example.com
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <ingest_key>
```

An accepted request is answered `200` with `{}` as soon as it is decoded: the runs, their steps and the rows they write happen after the answer, so a slow automation never slows the client down.

## Who is sending: `auth: { type: projectKey }`

`table` is the table with one row per sender, and `keyField` the field holding each sender's key. With `protocol: sentry`, the `<project>` segment of the path must equal the row's `id`, or the field named by `projectField`. Both names, and `projectField`, must exist in your tables: a misspelling is refused by `sovrium validate`, not discovered as a client that is refused at runtime.

The key is checked before the body is read, so a request without a valid key costs no decompression and no parsing. A key that matched is remembered for 30 seconds: removing or changing a key in the table takes effect within that delay.

A refused request costs as little as possible:

- **No key at all** is refused before anything is read from the database.
- **An unknown key is remembered for 30 seconds too**, so repeating it is refused without reading the key table again. This memory holds a bounded number of keys and forgets the oldest first, so a flood presenting a new random key on every request cannot grow it. A key you add to the table is therefore accepted within 30 seconds of its first refusal.
- **Which automations are paused is read only for a key that was accepted.** A refusal never reads it.

| Request                                                                               | Answer                                       |
| ------------------------------------------------------------------------------------- | -------------------------------------------- |
| No key, a key no row holds, or a key whose row does not match the `<project>` segment | `401`, the same answer for all three, no run |
| A malformed envelope or malformed OTLP JSON                                           | `400`, no run                                |
| A body larger than `API_BODY_LIMIT_BYTES` (25 MiB by default)                         | `413`, no run                                |
| A `Content-Encoding` other than `gzip`, `deflate` or `identity`                       | `415`, no run                                |
| More requests than the budget allows                                                  | `429` with `Retry-After`, no run             |
| A refusal from an address past its refusal budget (below)                             | `429` with `Retry-After`, no run             |

`trigger.project` holds the row's `id` (and the `projectField` value when you set one). The key is never part of a run: not in `trigger.project`, not in `trigger.data`, and no header or query parameter of a telemetry request is recorded. Read the rest of the row with a `record/read` step on `{{trigger.project.id}}`.

## What a run receives

### Sentry: one run per event or transaction

An envelope's items each start their own run, so a step can upsert the issue an event belongs to without a loop. Attachments, sessions and other item types never start a run. As the Sentry protocol requires, an envelope holds at most one event and one transaction: an envelope repeating either is malformed and answered `400`. `items` limits which kinds start a run for one automation; omitted, both do. Give an errors automation `items: [event]` and a performance automation `items: [transaction]`, and neither pays a run for the other's items.

For an event, `trigger.data` holds:

| Path                                    | Value                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `kind`                                  | `event`                                                                                               |
| `event_id`, `platform`                  | as the client sent them                                                                               |
| `timestamp`                             | ISO 8601, whether the client sent epoch seconds or a date                                             |
| `level`                                 | `fatal`, `error`, `warning`, `info` or `debug`, as sent; `error` when absent                          |
| `title`                                 | `Type: value` of the outermost exception, or the message when there is no exception                   |
| `culprit`                               | the application frame where it was thrown, `<filename> in <function>`                                 |
| `message`                               | the formatted message, when there is one                                                              |
| `exception`                             | the chain, oldest first: `[{ type, value, frames: [{ filename, function, lineno, colno, in_app }] }]` |
| `release`, `environment`, `server_name` | as sent                                                                                               |
| `request`                               | `{ method, url, headers }` as sent                                                                    |
| `tags`                                  | an object of strings                                                                                  |

A frame's `filename` is cut to start at `src/` when it contains `/src/`, a dependency's path to start at `node_modules/`, and a `file://` prefix is dropped, so the same line reported from two machines reads the same and no machine's own directories are kept.

For a transaction, `trigger.data` holds `kind: transaction`, `event_id`, `name` (`GET /api/tables/:id/records`), `op` and `status` from the trace context, `http_status` as a number, `start` and `end` in ISO 8601, `duration_ms`, `db_queries` when the client measured them, `trace_id`, `span_id`, the spans the client sent (`[{ span_id, op, description, start, end, duration_ms, status, data }]`), and `release`, `environment`, `server_name` and `tags` as for an event.

```yaml
automations:
  - name: ingest-errors
    trigger:
      type: webhook
      method: POST
      protocol: sentry
      items: [event]
      auth: { type: projectKey, table: apps, keyField: ingest_key }
    actions:
      - name: store
        type: record
        operator: create
        props:
          table: events
          data:
            app: '{{trigger.project.id}}'
            title: '{{trigger.data.title}}'
            level: '{{trigger.data.level}}'
            exception: '{{json trigger.data.exception}}'
```

`{{json …}}` writes an object or a list into a `json` field as JSON, rather than as text.

### OTLP logs: one run per request

A batch of log lines starts one run, with every record of the request in `trigger.data.records`, flattened across resources and scopes: `[{ time, severity, body, attributes, service, environment, trace_id, span_id }]`. `time` is ISO 8601, `severity` is upper-case (`ERROR`, `WARN`, `INFO`…), `body` is text, `attributes` is an object, and `service` and `environment` come from the resource's `service.name` and `deployment.environment`. The list is shaped for `record/batchCreate` into a table whose fields carry those names:

```yaml
automations:
  - name: ingest-logs
    trigger:
      type: webhook
      method: POST
      protocol: otlp-logs
      auth: { type: projectKey, table: apps, keyField: ingest_key }
    actions:
      - name: store
        type: record
        operator: batchCreate
        props: { table: logs, items: '{{trigger.data.records}}' }
```

## Budget: `rateLimit.per`

`per: project` counts requests per sender row; `per: ip` per client address, as an ordinary webhook does. On a protocol trigger the default is `project`, and with no `rateLimit` at all each sender may send 1200 requests per 60 seconds. When several automations declare the same protocol, the strictest of their budgets applies. Past it the client is answered `429` with `Retry-After`, which Sentry-compatible clients and OTLP exporters both honour.

Telemetry paths do not count against the instance-wide per-address ceiling (`API_IP_RATE_LIMIT`). Apps sharing a host often leave through one address, and a client answered `429` stops all of its reporting for the `Retry-After` delay, so one shared ceiling would silence every app on the host at once.

Requests no key admits have a budget of their own, per client address: **60 a minute**. It counts requests with no key and requests whose key no row holds. Past it, every further such request from that address is answered `429` with `Retry-After` instead of `401`, until the minute frees. Nothing else is counted:

- **A key found in the key table within the last ten minutes is never counted and never refused by this budget**, from whatever address it comes — even sent to another project's Sentry path, which stays the plain `401`. A misconfigured app sending a wrong key from a shared host's address cannot mute the healthy apps beside it.
- **A key not found in the last ten minutes, arriving from an address past its refusal budget, is answered `429` without being looked up.** That bounds the database reads of a flood presenting a new key on every request. A brand-new sender sharing its address with such a flood sees its first reports deferred by at most a minute, which Sentry-compatible clients and OTLP exporters absorb by retrying after `Retry-After`.

The number is fixed: a healthy sender is never refused, so this budget only bounds a misconfiguration or an attack.

## Reporting to yourself

An app can send its own telemetry to its own receiver. Requests served on a telemetry path are never reported: they produce no transaction, and an error raised while serving one is written to the server log rather than sent to the app's own `SENTRY_DSN`. Without that rule each ingested transaction would produce another one. The automations a report starts run after the answer, and report their failures like any other run.

## Refused when the configuration loads

`sovrium validate` refuses, naming the automation and the property:

- a `protocol` without `auth.type: projectKey`, and a `projectKey` without a `protocol`;
- a `projectKey` whose `table`, `keyField` or `projectField` does not exist;
- `rateLimit.per: project` without a `projectKey`, `items` on a protocol other than `sentry`, and `projectField` on `otlp-logs`;
- beside a `protocol`: `respondImmediately`, `response`, `requestSchema`, `querySchema`, `deduplicationKey` or `verification`, which the protocol fixes itself, and a `method` other than `POST`.
