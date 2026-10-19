# Calendar Feed

> Publish a table as a calendar each reader subscribes to from Proton, Google or Apple Calendar — with their own private address, and only the rows and fields they may read.

Add `calendarFeed` to a table whose rows are events — meetings, bookings, leave, deadlines — and every person who may read the table can subscribe to it from their own calendar app. Without it, the table has no feed.

<!-- sovrium:options TableCalendarFeedSchema -->

```yaml
tables:
  - id: 1
    name: meetings
    labelPlural: Meetings
    fields:
      - { id: 1, name: title, type: single-line-text }
      - { id: 2, name: starts_at, type: datetime }
      - { id: 3, name: ends_at, type: datetime }
      - { id: 4, name: notes, type: long-text }
      - { id: 5, name: host, type: user }
    permissions:
      read: [admin, member]
    rowLevelPermissions:
      read:
        when: { field: host, operator: eq, value: $currentUser.id }
    calendarFeed:
      start: starts_at
      end: ends_at
      title: title
      description: notes
```

## Getting an address

A signed-in person asks for their address with `POST /api/tables/{table}/calendar-feed/token`. The answer (`201`) holds `url`, an address ending in `.ics`, and `createdAt`. The address is shown this once: the instance keeps only a fingerprint of it. Paste it into the calendar app's "subscribe by URL" (Proton: _Add calendar from URL_; Google: _Other calendars → From URL_; Apple: _File → New Calendar Subscription_).

- The address starts with the instance's public address: `BASE_URL` when it is set, otherwise the host and scheme a declared proxy (`TRUSTED_PROXY_HOPS`) forwarded, otherwise the address the request reached. Behind a proxy that terminates HTTPS, set one of the two, or the address starts with `http://`.
- Asking again replaces the address; the previous one stops working at once.
- `DELETE` on the same path revokes it (`204`, or `404` when there is none). `GET` answers `{ active, createdAt }`, telling whether one is live without showing it.
- Without a session, each of the three answers `401`.
- A person who may not read the table, or a table without `calendarFeed`, gets `404`.

## What the feed shows

The address answers as the person who made it, every time the calendar app fetches it: the table's read permission, its row-level rules and its field-level read permissions apply exactly as for that person's own requests. A row they can no longer read leaves their calendar on the next refresh. A field they may not read is left out of the event; a row whose start they may not read is left out whole.

- **One event per row with a start.** A row whose `start` is empty is not shown. Trashed rows are not shown.
- **Dates and times.** A `datetime` field gives a timed event, written in UTC so every calendar app places it in its reader's own zone. A `date` field gives an all-day event; a `date` end is the last day the event covers.
- **Stable events.** Each event is identified by its table and record id, so editing a row moves the event in the calendar instead of duplicating it.
- **Probing the address.** A `HEAD` request answers with the status and headers a `GET` would, without the calendar, so a calendar app that checks an address before subscribing is not turned away.
- **The calendar's name** is the table's `labelPlural`, else its `label`, else its name.
- **At most 5 000 events**, the latest-starting first.

## How fresh it is

Calendar apps decide when to refresh a subscription, not the server. The feed asks for one hour, which Apple Calendar honours; Google Calendar and Proton Calendar refresh on their own schedule, typically every 12 to 24 hours, and offer no way to force it.

## Privacy

The address is the only credential, so treat it like a password. It is never written to the server log, to exported traces or to exported logs: those name the route, not the address. It stops working when it is replaced or revoked, when its owner is banned, when their account is deleted — erasure removes it — and when `calendarFeed` is removed from the table or the table from the config — the instance then deletes every address of that table when it starts or applies the edited config, so declaring the feed again revives none of them and each person mints a new one. Every one of these answers the same `404` as an address that never existed. The feed is served with `Cache-Control: private, no-store`, `X-Robots-Tag: noindex` and `Referrer-Policy: no-referrer`, and stays under the instance's per-address rate limit.
