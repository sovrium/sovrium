# Real-Time Subscriptions

> How a data-bound view stays current without a reload — the three refresh strategies, the endpoints behind them, and the message contract a programmatic client reads.

A data source declares a `refreshMode` and the engine does the rest: `poll` re-fetches on an interval, `realtime` opens a WebSocket with a Server-Sent-Events fallback and applies change events as they arrive. External integrations subscribe through the same endpoints.

| Endpoint                                 | What it is                                                |
| ---------------------------------------- | --------------------------------------------------------- |
| `GET /api/tables/:tableId/subscribe`     | The change feed for one table.                            |
| `GET /api/tables/:tableId/subscribe/sse` | The same handler, under a name that says which transport. |
| `GET /api/realtime/presence`             | Who else is on a page right now. Not a change feed.       |

**The transport is chosen by your request, not by the path.** Both subscribe paths run the same handler: a request carrying `Upgrade: websocket` is upgraded and driven over a socket, and anything else is served as Server-Sent Events. The `/sse` suffix is an alias that documents intent; it does not force the transport, and the bare path is not WebSocket-only.

A subscription is always to ONE table. There is no endpoint that subscribes to every table at once, so a client that needs several opens several — and the per-user connection cap below is what that has to fit inside.

## Choosing a refresh strategy

`refreshMode` sits on any component's `dataSource` and accepts three values.

| `refreshMode` | Behaviour                                                         |
| ------------- | ----------------------------------------------------------------- |
| `none`        | Fetch once when the page renders. The default                     |
| `poll`        | Re-fetch on an interval, with no connection to manage             |
| `realtime`    | Open a WebSocket and apply change events as the server emits them |

```yaml
pages:
  - name: Live Dashboard
    path: /dashboard
    components:
      - type: table
        dataSource:
          table: orders
          filter:
            - field: status
              operator: eq
              value: processing
          sort:
            - field: createdAt
              direction: desc
          refreshMode: realtime
```

Poll mode is the right answer more often than it looks: it needs no connection budget, survives every proxy, and a ten-second interval is indistinguishable from live for most dashboards.

```yaml
dataSource:
  table: inventory
  refreshMode: poll
  pollIntervalMs: 10000
```

`pollIntervalMs` falls back to 30 seconds and accepts 1,000 to 300,000 — a floor that stops a mistyped interval from turning one page into a load test. It is ignored outside `poll` mode rather than refused, so leaving it in place while switching to `realtime` is harmless.

## What the stream carries

`refreshMode: realtime` opens a socket to the table's subscribe endpoint. The server pushes changes made from **any** source — API writes, the admin console, automations — not only from the client that is listening.

```json
{ "type": "change", "event": "insert", "record": { "id": "42", "fields": {} } }
{ "type": "change", "event": "update", "record": {}, "oldRecord": {} }
{ "type": "change", "event": "delete", "recordId": 42 }
{ "type": "heartbeat", "timestamp": "2026-04-05T12:00:00Z" }
```

Insert and update events carry the full record, already filtered by the caller's field permissions; a delete carries the id alone. The upgrade requires a session — an unauthenticated one answers `401` — and a valid table slug, or `404`.

Every message is a discriminated union keyed on `type`, and a WebSocket frame and an SSE `data:` event carry the identical shape, so a client swapping transports needs no second parser.

| `type`              | Purpose                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| `change`            | An insert, update or delete; the payload mirrors the `{ id, fields }` envelope |
| `conflict`          | A concurrent edit overwrote a pending optimistic change                        |
| `heartbeat`         | Keep-alive                                                                     |
| `subscribed`        | Handshake confirmation, echoing the resolved filter and fields                 |
| `unsubscribed`      | Unsubscription confirmation                                                    |
| `join` / `leave`    | Someone opened or left a page declaring `presence: true`                       |
| `presence-sync`     | The full presence snapshot, sent once on join                                  |
| `connection-status` | Transport connectivity                                                         |

Because the `change` payload mirrors the Records API envelope, a client can apply an event straight to a data-bound cache with no shape translation.

## The stream is scoped by the data source

A subscription inherits the data source's `filter` and `sort`, so a client receives only the changes that still concern it. A row edited out of the filtered set is delivered as the transition rather than silently dropped, which is what lets the client remove it instead of holding a stale row forever.

## Presence and conflicts

A page declaring `presence: true` makes the server broadcast join, leave and snapshot messages scoped by page path, so a team can see who else is looking at the same rows before two people edit one.

Realtime drives an optimistic flow: the client applies its edit immediately, then reconciles. Where a concurrent edit overwrote a pending change the server emits a `conflict` message and the server's value prevails. A record `PATCH` may also carry an `updatedAt` token, which turns a lost update into a `409` instead of a silent overwrite.

## Connection budget

Client and server share one frozen set of transport constants: reconnect backoff of 1, 2, 4 and 8 seconds, a 30-second ceiling on reconnect delay, a 30-second heartbeat, **ten connections per user**, a five-minute idle timeout, a one-minute presence-stale timeout, and fifty presence entries per page. The per-user connection cap is the one worth planning around: a user with several tabs open on realtime pages reaches it faster than it looks.
