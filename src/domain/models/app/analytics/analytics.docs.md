# Analytics

> Built-in, self-hosted analytics: page views, sessions, referrers, UTM campaigns and device breakdowns on one unified event model, with no cookies and no external services.

Sovrium ships a built-in, first-party analytics engine. It tracks page views, sessions, referrers, UTM campaigns and device breakdowns on a single unified event model, with no cookies and no external services. All data stays on your server. Whether your visitors must be asked for consent before the tracker runs is yours to assess; see **What is stored, and what consent asks of you** below.

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
  respectGlobalPrivacyControl: true
  sessionTimeout: 30
  profile: audience-only
```

<!-- sovrium:options BuiltInAnalytics -->

**Two profiles decide what each event keeps.** `profile: audience-only`, the default, keeps what counting an audience needs and drops the rest on the server, whatever the tracker sends. `profile: full` stores every field the tracker and the request carry. The full list of each is under **What a row holds** below. Switching from `full` to `audience-only` also strips the excluded fields from the events already stored, once, at the next start: every row is kept and rewritten, none is deleted, and a start on `full` touches nothing.

**Boolean or object, and they are not two spellings of one thing.** `analytics: true` enables the defaults above. The object form overrides individual settings and keeps the defaults for the rest. You never restate a value to keep it. `analytics: false`, or omitting the property, disables analytics entirely: no endpoints are mounted and no script is injected.

## The unified events model

All analytics events (page views, custom track calls, and future sources) share a single `system.analytics_events` table with an `event_type` discriminator column. This follows the pattern PostHog, Mixpanel and Amplitude use, self-hosted and with no external dependency by design.

```text
system.analytics_events
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  app_name        TEXT NOT NULL
  event_type      TEXT NOT NULL          -- 'page_view' | 'track' | extensible
  event_name      TEXT NOT NULL          -- path for page_view, custom name for track
  org_id          TEXT                   -- organization scope (nullable pre-auth)
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
  visitor_hash    TEXT NOT NULL          -- server-computed visitor identifier
  session_hash    TEXT NOT NULL          -- server-computed session identifier
  properties      JSONB NOT NULL DEFAULT '{}'
```

| Event type        | `event_name`          | `properties` payload                                                                                                                       |
| ----------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `page_view`       | The page path         | `path`, `referrerDomain`, `deviceType`, `browserName`, `osName`, `language`; on `full` also `title`, `referrerUrl`, `utm*`, `screen*`.     |
| `track`           | The custom event name | Arbitrary key-value metadata from an automation action or the tracking API.                                                                |
| `link_click`      | The link slug         | `slug`, the `destination` (origin and path), `targetIndex` and the device keys; on `full` the whole destination, `referrerUrl` and `utm*`. |
| `qr_scan`         | The link slug         | A short link reached by scanning its QR code, counted apart from the same link pasted into a message.                                      |
| `outbound_click`  | The destination       | `href` and `pagePath`, both without their query strings; whole on `full`.                                                                  |
| `form_submission` | The form's name       | `formName`, `formId`; on `full` also `submissionId`.                                                                                       |

The promoted columns (`event_type`, `event_name`, `org_id`, `visitor_hash`, `session_hash`, `timestamp`) drive efficient `WHERE` and `GROUP BY` queries; everything else lives in JSONB. Identifiers are computed on the server and the retention horizon applies to every event type. The Do Not Track and Global Privacy Control settings apply to what a visitor's browser asks for (page views, outbound clicks, short-link clicks and QR scans), not to form submissions or an automation's `track` events. Every row is org-scoped for multi-tenant isolation.

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

**The collect endpoint takes requests from any visitor, signed in or not, so its fields are capped.** A page path or referrer longer than 2048 characters, a title longer than 512, or a UTM value longer than 256 refuses the whole page view with `400`, and nothing is stored. Values at those limits are recorded whole; nothing is ever truncated.

Every aggregated endpoint above accepts an optional `event_type` and `event_name`, defaulting to `event_type=page_view`. Passing `?event_type=link_click&event_name=spring-promo` reports one short link through the very same time series, referrer, device and campaign breakdowns that serve page views. That is one set of reports over one store, rather than a parallel set that could disagree with it.

Under `audience-only`, reports answer rounded figures: a count from 1 to 9 reads 10, any other count the nearest 10, and 0 stays 0. Shares are computed from the rounded counts. The finest series is a day: `granularity=hour` is refused. `GET /api/analytics/events` lists custom events only, without visitor or session identifiers, and answers 404 for any other event type, and the MCP server offers no analytics-events tool. Under `full`, reports answer the stored figures and an hourly series.

### Inspecting raw events

`GET /api/analytics/events` gives row-level visibility into the unified stream, complementing the aggregated endpoints. It answers admin-equivalent roles only (the built-in `admin` and the app's highest role), like the other read endpoints: a request with no session gets `401`, and a signed-in caller of any other role gets `404`, as if the endpoint did not exist. It filters by `event_type`, `event_name` and date range.

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

The console's Analytics page is `/_admin/analytics`, and it reads the endpoints above; with `analytics` off, it names the key to add. What serving that audience consumed is a page of its own, `/_admin/footprint`. Neither page writes anything.

## What is stored, and what consent asks of you

- **No cookies, and nothing written to the browser's storage by the tracker.** The script reads the page and sends it in one beacon. The only thing kept in the browser is the visitor's own on-or-off choice, written when they press a `consent-choice` control (below) or answer the consent banner.
- **What a row holds under `audience-only` (the default).** A page view stores the page path without its query string, the referring host, the device type, browser, operating system and language. An outbound click stores where the visitor went and from which page, both without their query strings. A short-link click or a QR scan stores the link's slug, the target it resolved to, its destination without the query string, and the device type, browser and operating system. A form submission event stores the form's name and id. Short-link clicks, QR scans and form submissions all carry one shared visitor identifier, so none of them can be told apart by visitor.
- **What a row holds under `full`.** Everything above, plus the page title, the full referrer URL, any UTM values, the screen width and height, the full URLs with their query strings, the submission's id, and a per-visitor identifier on short-link clicks, QR scans and form submissions.
- **Visitor and session identifiers.** The server computes them from each request; the script sends none. The visitor identifier is rotated daily and used to count unique visitors without a cookie. Under `audience-only`, several visitors can count as one. A restart starts a new day's identifiers, so a visitor seen before and after a restart counts twice that day.
- **Do Not Track and Global Privacy Control.** Both are honoured by default (`respectDoNotTrack`, `respectGlobalPrivacyControl`). A visitor whose browser sends `DNT: 1` or `Sec-GPC: 1` has nothing stored, whether page views, outbound clicks, short-link clicks or QR scans, and the tracker sends nothing from a browser reporting either signal. Every request is still answered as usual. Only the exact header value `1` is the Global Privacy Control signal. The GPC specification names United States privacy law as its main motivation; say in your privacy notice how your deployment treats it. Setting either option to `false` records those visitors.
- **All data is local.** No third-party services and no external calls: analytics never leaves your server.
- **Bounded retention.** Data older than `retentionDays` is purged automatically.

**Setting no cookie does not settle the consent question.** European rules on terminal equipment also cover a script that makes the browser send information about the visit, and whether a tracker can run without consent is assessed case by case, against what you collect and why. Whether your deployment needs your visitors' consent before this tracker runs, and what your privacy notice must say about it, is yours to assess. The list above is what that assessment has to cover. To hold the tracker until a visitor accepts, declare a purpose with the id `analytics` under `consent`: see **Visitor consent**.

## Letting visitors opt out

Place a `consent-choice` with `purpose: analytics` on your privacy page. The tracker reads the visitor's choice before every page view, every client-side navigation and every outgoing-link click, and sends nothing once they have turned it off. The choice is stored in the visitor's browser under the `localStorage` key `sovrium.consent`, as `{ v, configVersion, at, purposes }`: `at` is the day the choice was made (not a time), and `purposes.analytics` is `granted` or `denied`. It holds no identifier, and the server keeps no record of it. Global Privacy Control and Do Not Track still take precedence. With a purpose with the id `analytics` declared under `consent`, the same control starts off and turns measuring on only once granted. Short-link redirects and QR scans are answered by the server, which cannot read the visitor's browser storage, so the opt-out does not reach them; under the default `audience-only` profile those requests carry no per-visitor identifier.

```yaml
pages:
  - name: privacy
    path: /privacy
    components:
      - type: consent-choice
        purpose: analytics
```

## Related reading

- **Set up analytics and visitor consent**: choosing a profile, a control and what your notice must cover.
- **Admin Dashboard**: the operator read API across the platform.
- **Activity Monitoring**: the audit trail of user and admin actions.
- **Short Links**: the `link_click` and `qr_scan` events and the links that emit them.
- **Automations Overview**: emitting a custom `track` event from an automation action.
- **Ecoconception**: data retention and environmental footprint.
- **Database Infrastructure**: the SQLite and PostgreSQL parity behind the events table.
