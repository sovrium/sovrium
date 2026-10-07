# Real-Time Subscriptions

> How a data-bound view stays current without a reload — the three refresh strategies, the endpoints behind them, and the message contract a programmatic client reads.

A data source declares a `refreshMode` and the engine does the rest: `poll` re-fetches on an interval, `realtime` subscribes to the table's change feed and reads again as change events arrive. External integrations subscribe through the same endpoints.

| Endpoint                                 | What it is                                                |
| ---------------------------------------- | --------------------------------------------------------- |
| `GET /api/tables/:tableId/subscribe`     | The change feed for one table.                            |
| `GET /api/tables/:tableId/subscribe/sse` | The same handler, under a name that says which transport. |
| `GET /api/realtime/presence`             | Who else is on a page right now. Not a change feed.       |

**The transport is chosen by your request, not by the path.** Both subscribe paths run the same handler: a request carrying `Upgrade: websocket` is upgraded and driven over a socket, and anything else is served as Server-Sent Events. The `/sse` suffix is an alias that documents intent; it does not force the transport, and the bare path is not WebSocket-only.

A subscription is always to ONE table. There is no endpoint that subscribes to every table at once, so a client that needs several opens several — and the per-user connection cap below is what that has to fit inside.

## Choosing a refresh strategy

`refreshMode` sits on a component's `dataSource` and accepts three values.

| `refreshMode` | Behaviour                                                    |
| ------------- | ------------------------------------------------------------ |
| `none`        | Fetch once when the page renders. The default                |
| `poll`        | Re-fetch on an interval, with no connection to manage        |
| `realtime`    | Follow the table's change feed and read again on each change |

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

### Which components follow it

The components drawn in the browser follow their table: a `table` bound to its table, a `list` drawn with `listDisplay.itemTemplate`, a `kanban`, a `kpi` and a `chart`. On a change, each reads again exactly what it read on load — a KPI and a chart their aggregate figure, a list, a board and a grid their rows — so a live dashboard keeps the read cost it had.

```yaml
pages:
  - name: Inbox
    path: /inbox
    components:
      - type: list
        dataSource: { table: conversations, refreshMode: realtime }
        listDisplay:
          itemTemplate: { title: $record.contact, subtitle: $record.last_message }
      - type: kpi
        label: Unread
        dataSource:
          table: conversations
          filter:
            - { field: unread, operator: eq, value: true }
          refreshMode: realtime
        kpiAggregate: { function: count }
```

In `realtime` mode a list, a board, a KPI and a chart read again when the feed announces a change and once each time the feed reconnects, which covers a change made while it was between streams. They read on a 3-second interval only while the feed is not connected: while it first opens, during a reconnect, or after the browser gives up on it. A `table` in `realtime` mode also reads every 3 seconds while connected. The difference shows on a write made straight to the database, outside the engine, which the feed never announces: a `table` shows it within a few seconds, while a list, a board, a KPI and a chart show it only at the next change on that table or the next reconnect. This keeps a live dashboard inside the limit of 100 table reads a minute per client address, which a 3-second interval on every component would quickly spend.

Rows the server draws cannot follow a change, because no script runs for them: a `container` with a `dataSource`, and a `list` whose rows come from `children`. `sovrium validate` refuses `refreshMode` on them; draw the same rows as a `list` with `listDisplay.itemTemplate` to have them live. A `table` bound to one of its table's views does not refresh on its own, whatever its `refreshMode`: it keeps the view's rows as they were when the page loaded. The other data components — a search-mode list, a gallery, a calendar, a timeline, a map, a matrix, a tree and a graph — do not read `refreshMode` yet.

### One subscription per table

Components that follow the same table on one page share one subscription to it: a KPI, a chart, a board and a list over `deals` cost one connection, not four. Components over two tables cost two. Each signed-in person may hold ten at once (see [Connection budget](#connection-budget)), so what counts is how many tables a page follows in `realtime` mode, times the tabs open on it — not how many components it has.

## What the stream carries

`refreshMode: realtime` subscribes to the table's subscribe endpoint, over Server-Sent Events. The server pushes every committed change from **any** source, not only from the client that is listening: a single-record write, a batch create, update, delete or restore, an upsert, a restore from the trash, a hosted form submission, an automation step, an MCP tool call, and the child rows a delete cascades to (a cascaded soft delete arrives as a `delete` on the child table, a cascaded set-null as an `update`).

```json
{ "type": "change", "event": "insert", "record": { "id": "42", "fields": {} } }
{ "type": "change", "event": "update", "record": {}, "oldRecord": {} }
{ "type": "change", "event": "delete", "recordId": "42" }
{ "type": "resync", "table": "orders", "reason": "bulk-change", "timestamp": "2026-04-05T12:00:00Z" }
{ "type": "heartbeat", "timestamp": "2026-04-05T12:00:00Z" }
```

Insert and update events carry the full record, already filtered by the caller's field permissions; a delete carries the id alone. A relationship value in `record` or `oldRecord` is the related record's id as a string, as on the records API, and a checkbox is `true` or `false` in both, whichever database the app runs on. An attachment field carries the file's storage key, not the download URL a read of the record returns; read the record when you need a link. A lookup that copies a value from a table with a row-level read rule the subscriber is subject to is left out of the event, because the stream cannot tell which of the linked records they may read; read the record to get it. A subscription `filter` is judged only on the fields the subscriber may read. A restored record arrives as an `insert`, the inverse of the delete that removed it; an upsert announces an `insert` for each row it creates and an `update` for each row it matches. The upgrade requires a session — an unauthenticated one answers `401` — and a valid table slug, or `404`.

### Large writes arrive as one `resync`

A write sends one `change` event per row, up to **100 rows of one table**. A write that changes more rows of a table than that — a large batch or import, a wide cascade, an automation step looping over many records — sends a single `resync` notice for the table instead. It carries no row; answer it by reading the table again. A subscriber receives it only when at least one of the changed rows, as it stood before or after the write, is one their row-level read rule shows them. The limit is counted per table and per write, and an automation step counts as one write however many records it touches.

## A subscriber sees the rows the records API shows them

A subscription answers to the same read rules as a read of the table's records. It is opened for exactly the people the records API lets list the table — their role, their groups and, on a table with a row-level rule, the roles assigned to them per record — and anyone else is answered `404` exactly as for a table that does not exist — the same status and the same body, `{"success":false,"error":"Not Found","message":"Resource not found","code":"NOT_FOUND"}`, including when their access could not be read at all.

Each change is then judged for each subscriber against the table's row-level read rule:

- an insert or an update is delivered when the row, as changed, is one they may read;
- an update that brings a row into their view carries the row as changed only, never the values it held while hidden from them;
- an update that takes a row they could see out of their view is delivered as a `delete` of its id, with no fields, so the client drops it;
- a delete is delivered when they could read the row before it was deleted;
- any other change is not delivered at all.

## A change to the subscriber's access closes the subscription

Who the subscriber is — their roles, their groups and the records assigned to them — is read when the subscription opens. When it changes, the subscriber's open connections are closed, and the client reconnects and is judged again: with the new access it gets a stream with the new columns and rows; with none it gets the `404` of a table that does not exist, and stops.

- **Through the engine, at once.** Changing a user's role, banning them, adding them to or removing them from a group, removing them from the organisation, deleting or renaming a group they belong to, granting them a per-record role: each closes that user's live connections as soon as the change stands. A refused request closes nothing.
- **Anywhere else, within 30 seconds.** Every open WebSocket has its access read again every 30 seconds and is closed when it now reads differently — no longer allowed, other readable columns, other rows. That covers a grant edited directly in the database. A Server-Sent-Events stream never lives longer than 25 seconds, and every reconnect is judged afresh.

A WebSocket closed this way receives close code **`4001`** with the reason `grant-changed`; reconnect on it as on any drop. A Server-Sent-Events stream simply ends, and `EventSource` reconnects on its own.

A connection also ends with the session it was opened with. Signing out, revoking the session, or its expiry closes a WebSocket with code **`4401`** and the reason `session-ended`, and ends a Server-Sent-Events stream; only that session's connections close, so the same person's other devices keep theirs. Revoking all of a person's sessions, a ban, removing their account or scheduling its deletion ends every session, and so every connection, the same way. Do not reconnect on `4401`: the handshake would answer `401`. Sign in again, then subscribe. An expiry or a session removed outside the engine is caught within 30 seconds.

> **Upgrade note.** Up to 0.29.1, a subscription outlived both a change of access and the end of its session. Both now close it, so a client written for 0.29.1 sees closes it never saw before. Tell them apart by code: on **`4001`** (`grant-changed`) reconnect straight away, as on any drop; on **`4401`** (`session-ended`) stop, send the person to sign in, and subscribe again afterwards. A client that reconnects on every close loops on `401` after a sign-out — the usual symptom of a generic retry-on-close handler.

Every message is a discriminated union keyed on `type`, and a WebSocket frame and an SSE `data:` event carry the identical shape, so a client swapping transports needs no second parser.

| `type`              | Purpose                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| `change`            | An insert, update or delete; the payload mirrors the `{ id, fields }` envelope |
| `resync`            | A write changed too many rows to announce one by one; read the table again     |
| `conflict`          | A concurrent edit overwrote a pending optimistic change                        |
| `heartbeat`         | Keep-alive                                                                     |
| `subscribed`        | Handshake confirmation, echoing the resolved filter and fields                 |
| `unsubscribed`      | Unsubscription confirmation                                                    |
| `join` / `leave`    | Someone opened or left a page declaring `presence: true`                       |
| `presence-sync`     | The full presence snapshot, sent once on join                                  |
| `connection-status` | Transport connectivity                                                         |

The `change` payload mirrors the Records API's `{ id, fields }` envelope, so one reader serves both, but an event is not a copy of what a read returns: an attachment arrives as its storage key rather than a download URL, and a lookup the stream withholds is absent rather than empty. A client that caches records merges an event into the row it holds, or reads the record again, instead of replacing the row with the event.

## The stream is scoped by the data source

A subscription inherits the data source's `filter` and `sort`, so a client receives only the changes that still concern it. A row edited out of the filtered set is delivered as the transition rather than silently dropped, which is what lets the client remove it instead of holding a stale row forever.

## Presence and conflicts

A page declaring `presence: true` makes the server broadcast join, leave and snapshot messages scoped by page path, so a team can see who else is looking at the same rows before two people edit one.

Presence follows the page's audience. `GET /api/realtime/presence?pagePath=…` is served only when `pagePath` is a declared page that sets `presence: true` and whose `access` admits the caller — the decision a visit to the page is judged on. A page the caller may not open, a page without presence and a path that is no page all answer the same `404`, and name nobody; a caller is never shown in presence on a page she may not open.

On a page that shows one record (`path: /orders/:id` with a `dataSource` in `mode: single`, on the page itself or on one of its components), presence belongs to the record at its address: the page reports the address it is on (`/orders/42`, not `/orders/:id`), so two people on two orders do not see each other. Presence at that address is served only when the caller may read the record there, judged as the records API judges it — the table's `read` permission, then its row-level read rule; a page binding several records this way needs every one of them readable. A record she may not read, and an address that names no record (`/orders/999`), answer the same `404` as a path that is no page.

A presence stream ends with the access it was opened on, like a record subscription's stream. A change to the viewer's role, groups or record assignments, a ban, or the end of the session she opened it with ends her stream at once; so does a write that moves the record she is watching out of her row-level read rule, deletes it, or moves it off the address. The others on the page receive her `leave`, and a reconnect is judged afresh: `404` without access, `401` without a session. A presence stream does not count toward the per-user cap on record subscriptions: it has a cap of its own, **ten presence streams per user**, and an eleventh is answered `429` with a `Retry-After` header, exactly as an eleventh record subscription is. One user at her cap does not affect anyone else's.

Realtime drives an optimistic flow: the client applies its edit immediately, then reconciles. Where a concurrent edit overwrote a pending change the server emits a `conflict` message and the server's value prevails. A record `PATCH` may also carry an `updatedAt` token, which turns a lost update into a `409` instead of a silent overwrite.

## Connection budget

Client and server share one frozen set of transport constants: reconnect backoff of 1, 2, 4 and 8 seconds, a 30-second ceiling on reconnect delay, a 30-second heartbeat, **ten record subscriptions per user** and, separately, ten presence streams per user, a five-minute idle timeout, a one-minute presence-stale timeout, fifty presence entries per page, at most 100 row events per table per write before a `resync`, and a 30-second access re-check on every open WebSocket. The per-user connection cap is the one worth planning around: a page costs one connection per table it follows in `realtime` mode, so a user with several tabs open on realtime pages reaches it faster than it looks.
