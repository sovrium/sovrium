# Analytics

> Built-in, privacy-first, self-hosted analytics — page views, sessions, referrers, UTM campaigns and device breakdowns on one unified event model, with no cookies and no external services.

Sovrium ships a built-in, first-party analytics engine. It tracks page views, sessions, referrers, UTM campaigns and device breakdowns on a single unified event model — with no cookies, no fingerprinting and no external services. All data stays on your server, which makes it GDPR-friendly by default.

Analytics is configured by the top-level `analytics` property. When enabled, Sovrium injects a lightweight (~1 KB) tracking script that records page views by `navigator.sendBeacon()` to `POST /api/analytics/collect`.

## Configuration

`analytics` accepts a boolean shorthand or an object for fine-grained control.

```yaml
name: my-app
analytics: true
```

```yaml
name: my-app
analytics:
  retentionDays: 365
  excludedPaths:
    - /admin/*
    - /api/*
  respectDoNotTrack: true
  sessionTimeout: 30
```

<!-- sovrium:options BuiltInAnalytics -->

**Boolean or object, and they are not two spellings of one thing.** `analytics: true` enables the defaults above. The object form overrides individual settings and keeps the defaults for the rest — you never restate a value to keep it. `analytics: false`, or omitting the property, disables analytics entirely: no endpoints are mounted and no script is injected.

## The unified events model

All analytics events — page views, custom track calls, and future sources — share a single `system.analytics_events` table with an `event_type` discriminator column. This follows the pattern PostHog, Mixpanel and Amplitude use, self-hosted and with no external dependency by design.

```text
system.analytics_events
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  app_name        TEXT NOT NULL
  event_type      TEXT NOT NULL          -- 'page_view' | 'track' | extensible
  event_name      TEXT NOT NULL          -- path for page_view, custom name for track
  org_id          TEXT                   -- organization scope (nullable pre-auth)
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
  visitor_hash    TEXT NOT NULL          -- privacy-preserving visitor identifier
  session_hash    TEXT NOT NULL          -- privacy-preserving session identifier
  properties      JSONB NOT NULL DEFAULT '{}'
```

| Event type   | `event_name`          | `properties` payload                                                                                                  |
| ------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `page_view`  | The page path         | `path`, `referrer`, `utm_*`, `device_type`, `browser_*`, `os_*`, `screen_*`, `language`, `country`.                   |
| `track`      | The custom event name | Arbitrary key-value metadata from an automation action or the tracking API.                                           |
| `link_click` | The link slug         | Which short link was followed, the target it resolved to, plus the same referrer, device and UTM keys as a page view. |
| `qr_scan`    | The link slug         | A short link reached by scanning its QR code, counted apart from the same link pasted into a message.                 |

The promoted columns (`event_type`, `event_name`, `org_id`, `visitor_hash`, `session_hash`, `timestamp`) drive efficient `WHERE` and `GROUP BY` queries; everything else lives in JSONB. The same privacy primitives — server-side visitor and session hashing (SHA-256, no PII stored), DNT respect, and the retention horizon — apply uniformly to every event type, and every row is org-scoped for multi-tenant isolation.

**Storage-engine parity.** The unified events table is exercised by both the PostgreSQL (`->>` over `system.analytics_events`) and SQLite (`json_extract` over `system_analytics_events`) query paths. Both produce identical response shapes for collect, overview time-series, top-pages, referrer and UTM, and device breakdown.

## Querying analytics

Aggregated analytics are exposed through admin-gated read endpoints. Raw events are there for debugging and for custom dashboards.

| Endpoint                       | Returns                                                              |
| ------------------------------ | -------------------------------------------------------------------- |
| `POST /api/analytics/collect`  | Public ingest endpoint hit by the tracking script.                   |
| `POST /api/analytics/click`    | Public ingest for an outbound click, hit by the same script.         |
| `GET /api/analytics/overview`  | Totals plus a bucketed daily time series.                            |
| `GET /api/analytics/pages`     | Top pages by view count.                                             |
| `GET /api/analytics/referrers` | Referrer and UTM-campaign breakdown.                                 |
| `GET /api/analytics/devices`   | Device-type and browser breakdown.                                   |
| `GET /api/analytics/campaigns` | UTM campaign analysis.                                               |
| `GET /api/analytics/targets`   | How one short link's clicks split across the targets it resolved to. |
| `GET /api/analytics/events`    | **Admin-only** raw event inspection (paginated, filterable).         |

Every aggregated endpoint above accepts an optional `event_type` and `event_name`, defaulting to `event_type=page_view`. Passing `?event_type=link_click&event_name=spring-promo` reports one short link through the very same time series, referrer, device and campaign breakdowns that serve page views. That is one set of reports over one store, rather than a parallel set that could disagree with it.

### Inspecting raw events

`GET /api/analytics/events` gives row-level visibility into the unified stream, complementing the aggregated endpoints. It is admin-only and filters by `event_type`, `event_name` and date range.

```text
GET /api/analytics/events?event_type=track&limit=50&offset=0&from=2026-01-01&to=2026-04-15
```

| Parameter     | Description                               |
| ------------- | ----------------------------------------- |
| `event_type`  | Filter by type (`page_view`, `track`, …). |
| `event_name`  | Exact-match event name.                   |
| `from` / `to` | ISO 8601 date range (inclusive).          |
| `limit`       | Max results (default `50`, max `1000`).   |
| `offset`      | Pagination offset (default `0`).          |

## Where an operator reads it

The console's Analytics page is `/_admin/pages`, and `/_admin/footprint` reports what serving that audience consumed. Both read the endpoints above; neither writes anything.

## Privacy and compliance

- **No cookies, no fingerprinting.** Visitors are identified by a server-computed SHA-256 hash; no client-side identifier is stored.
- **DNT respected by default.** Visitors sending `DNT:1` are not tracked when `respectDoNotTrack` is on.
- **All data is local.** No third-party services and no external calls — analytics never leaves your server.
- **Bounded retention.** Data older than `retentionDays` is purged automatically, which is the data-minimisation posture the rest of the platform follows.

## Related reading

- **Admin Dashboard** — the operator read API across the platform.
- **Activity Monitoring** — the audit trail of user and admin actions.
- **Short Links** — the `link_click` and `qr_scan` events and the links that emit them.
- **Automations Overview** — emitting a custom `track` event from an automation action.
- **Ecoconception** — data retention and environmental footprint.
- **Database Infrastructure** — the SQLite and PostgreSQL parity behind the events table.
