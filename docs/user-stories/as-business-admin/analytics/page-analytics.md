# Page Analytics

> **Feature Area**: Analytics - Built-in First-Party Page Analytics
> **Schema**: `src/domain/models/app/analytics/`
> **API Routes**: `GET /api/analytics/overview`, `GET /api/analytics/pages`, `GET /api/analytics/referrers`, `GET /api/analytics/devices`, `GET /api/analytics/campaigns`, `POST /api/analytics/collect`
> **E2E Specs**: `specs/app/analytics/`, `specs/api/analytics/`

---

## Overview

Sovrium provides a built-in, self-hosted, first-party analytics engine for tracking page views on static pages. The analytics system is privacy-first (no cookies, GDPR-friendly), requires zero external dependencies, and provides business admins with traffic insights including page views, unique visitors, sessions, referrer tracking, UTM campaign analysis, and device breakdowns.

Analytics is configured via the `analytics` property in the app schema YAML. When enabled (default), a lightweight tracking script (~1KB) is automatically injected into pages to collect page view data via `navigator.sendBeacon()`.

---

## US-API-ANALYTICS-001: Configure Analytics Tracking

**As a** developer,
**I want to** enable built-in analytics via the app schema YAML,
**so that** page views are automatically tracked without external dependencies.

### Configuration

```yaml
# Minimal — analytics enabled with defaults
name: my-app
analytics:
  enabled: true

# Full configuration
name: my-app
analytics:
  enabled: true
  retentionDays: 365
  excludedPaths:
    - /admin/*
    - /api/*
  respectDoNotTrack: true
  sessionTimeout: 30
```

### Defaults

| Property            | Default | Range/Values             | Description                           |
| ------------------- | ------- | ------------------------ | ------------------------------------- |
| `enabled`           | `true`  | boolean                  | Enable/disable analytics tracking     |
| `retentionDays`     | `365`   | 1-730                    | Days to retain analytics data         |
| `excludedPaths`     | `[]`    | string[] (glob patterns) | URL patterns to exclude from tracking |
| `respectDoNotTrack` | `true`  | boolean                  | Honor browser Do Not Track setting    |
| `sessionTimeout`    | `30`    | 1-120 (minutes)          | Session inactivity timeout in minutes |

### Acceptance Criteria

| ID     | Criterion                                                      | E2E Spec                          | Status |
| ------ | -------------------------------------------------------------- | --------------------------------- | ------ |
| AC-001 | Analytics is enabled by default when analytics property exists | `APP-ANALYTICS-CONFIG-001`        | ✅     |
| AC-002 | Analytics can be explicitly disabled with enabled: false       | `APP-ANALYTICS-CONFIG-002`        | ✅     |
| AC-003 | Default retentionDays is 365 when not specified                | `APP-ANALYTICS-CONFIG-003`        | ✅     |
| AC-004 | retentionDays rejects values below 1                           | `APP-ANALYTICS-CONFIG-004`        | ✅     |
| AC-005 | retentionDays rejects values above 730                         | `APP-ANALYTICS-CONFIG-005`        | ✅     |
| AC-006 | Default sessionTimeout is 30 minutes when not specified        | `APP-ANALYTICS-CONFIG-006`        | ✅     |
| AC-007 | sessionTimeout rejects values below 1                          | `APP-ANALYTICS-CONFIG-007`        | ⏳     |
| AC-008 | sessionTimeout rejects values above 120                        | `APP-ANALYTICS-CONFIG-008`        | ⏳     |
| AC-009 | excludedPaths accepts glob patterns                            | `APP-ANALYTICS-CONFIG-009`        | ⏳     |
| AC-010 | respectDoNotTrack defaults to true when not specified          | `APP-ANALYTICS-CONFIG-010`        | ⏳     |
| AC-011 | App starts successfully without analytics property             | `APP-ANALYTICS-CONFIG-011`        | ⏳     |
| AC-012 | Analytics configuration validates and app starts (regression)  | `APP-ANALYTICS-CONFIG-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/analytics/index.ts`
- **E2E Spec**: `specs/app/analytics/config.spec.ts`

---

## US-API-ANALYTICS-002: Collect Page Views

**As a** static page visitor,
**I want to** have my page views tracked automatically and privately,
**so that** the business admin gets traffic insights without cookies or personal data collection.

### API Request

```
POST /api/analytics/collect
Content-Type: application/json

{
  "p": "/about",
  "t": "About Us",
  "r": "https://google.com",
  "sw": 1920,
  "sh": 1080
}
```

### Response

```
204 No Content
```

### Payload Fields

| Field | Type   | Required | Description             |
| ----- | ------ | -------- | ----------------------- |
| `p`   | string | Yes      | Page path               |
| `t`   | string | No       | Page title              |
| `r`   | string | No       | Referrer URL            |
| `sw`  | number | No       | Screen width in pixels  |
| `sh`  | number | No       | Screen height in pixels |

### Acceptance Criteria

| ID     | Criterion                                                     | E2E Spec                           | Status |
| ------ | ------------------------------------------------------------- | ---------------------------------- | ------ |
| AC-001 | POST /api/analytics/collect returns 204 No Content            | `API-ANALYTICS-COLLECT-001`        | ✅     |
| AC-002 | Tracking script is injected into pages when analytics enabled | `API-ANALYTICS-COLLECT-002`        | ✅     |
| AC-003 | Tracking script is NOT injected when analytics disabled       | `API-ANALYTICS-COLLECT-003`        | ⏳     |
| AC-004 | Visitor hash uses SHA-256 of date + IP + UA (no cookies)      | `API-ANALYTICS-COLLECT-004`        | ⏳     |
| AC-005 | UA string is parsed for device type (desktop/mobile/tablet)   | `API-ANALYTICS-COLLECT-005`        | ⏳     |
| AC-006 | Browser name is extracted from UA string                      | `API-ANALYTICS-COLLECT-006`        | ⏳     |
| AC-007 | OS name is extracted from UA string                           | `API-ANALYTICS-COLLECT-007`        | ⏳     |
| AC-008 | Language is extracted from Accept-Language header             | `API-ANALYTICS-COLLECT-008`        | ⏳     |
| AC-009 | Referrer domain is extracted from full referrer URL           | `API-ANALYTICS-COLLECT-009`        | ⏳     |
| AC-010 | UTM parameters are captured from tracking payload             | `API-ANALYTICS-COLLECT-010`        | ⏳     |
| AC-011 | Excluded paths are not tracked                                | `API-ANALYTICS-COLLECT-011`        | ⏳     |
| AC-012 | Do Not Track is honored when respectDoNotTrack is true        | `API-ANALYTICS-COLLECT-012`        | ⏳     |
| AC-013 | Returns 400 when page path is missing                         | `API-ANALYTICS-COLLECT-013`        | ⏳     |
| AC-014 | Returns 404 when analytics is not configured                  | `API-ANALYTICS-COLLECT-014`        | ⏳     |
| AC-015 | Page view collection works end-to-end (regression)            | `API-ANALYTICS-COLLECT-REGRESSION` | ⏳     |

### Implementation References

- **Tracking Script**: `src/infrastructure/analytics/tracking-script.ts`
- **Collection Route**: `src/presentation/api/routes/analytics/collect.ts`
- **E2E Spec**: `specs/api/analytics/collect.spec.ts`

---

## US-API-ANALYTICS-003: Query Analytics Overview

**As a** business admin,
**I want to** retrieve a summary of page analytics (views, visitors, sessions) over a time range,
**so that** I can understand my site's traffic trends.

### API Request

```
GET /api/analytics/overview?from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z&granularity=day
```

### Response

```json
{
  "summary": {
    "pageViews": 12500,
    "uniqueVisitors": 3200,
    "sessions": 4800,
    "avgSessionDuration": null,
    "bounceRate": null
  },
  "timeSeries": [
    { "period": "2025-01-01T00:00:00Z", "pageViews": 450, "uniqueVisitors": 120, "sessions": 180 },
    { "period": "2025-01-02T00:00:00Z", "pageViews": 380, "uniqueVisitors": 100, "sessions": 150 }
  ]
}
```

### Query Parameters

| Parameter     | Type   | Required | Default | Description                         |
| ------------- | ------ | -------- | ------- | ----------------------------------- |
| `from`        | string | Yes      | -       | Start date (ISO 8601)               |
| `to`          | string | Yes      | -       | End date (ISO 8601)                 |
| `granularity` | string | No       | `day`   | Time bucket: hour, day, week, month |

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                            | Status |
| ------ | ------------------------------------------------------ | ----------------------------------- | ------ |
| AC-001 | Returns 200 with summary and time series data          | `API-ANALYTICS-OVERVIEW-001`        | ⏳     |
| AC-002 | Returns 401 when user is not authenticated             | `API-ANALYTICS-OVERVIEW-002`        | ⏳     |
| AC-003 | Summary includes pageViews, uniqueVisitors, sessions   | `API-ANALYTICS-OVERVIEW-003`        | ⏳     |
| AC-004 | Time series respects granularity=hour                  | `API-ANALYTICS-OVERVIEW-004`        | ⏳     |
| AC-005 | Time series respects granularity=day                   | `API-ANALYTICS-OVERVIEW-005`        | ⏳     |
| AC-006 | Time series respects granularity=week                  | `API-ANALYTICS-OVERVIEW-006`        | ⏳     |
| AC-007 | Time series respects granularity=month                 | `API-ANALYTICS-OVERVIEW-007`        | ⏳     |
| AC-008 | Returns 400 when from parameter is missing             | `API-ANALYTICS-OVERVIEW-008`        | ⏳     |
| AC-009 | Returns 400 when to parameter is missing               | `API-ANALYTICS-OVERVIEW-009`        | ⏳     |
| AC-010 | Returns empty data for periods with no traffic         | `API-ANALYTICS-OVERVIEW-010`        | ⏳     |
| AC-011 | Analytics overview query works end-to-end (regression) | `API-ANALYTICS-OVERVIEW-REGRESSION` | ⏳     |

### Implementation References

- **Route**: `src/presentation/api/routes/analytics/query.ts`
- **E2E Spec**: `specs/api/analytics/overview.spec.ts`

---

## US-API-ANALYTICS-004: Query Top Pages

**As a** business admin,
**I want to** see which pages get the most traffic,
**so that** I can optimize my most popular content.

### API Request

```
GET /api/analytics/pages?from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z
```

### Response

```json
{
  "pages": [
    {
      "path": "/",
      "title": "Home",
      "pageViews": 5200,
      "uniqueVisitors": 1800,
      "avgTimeOnPage": null
    },
    {
      "path": "/pricing",
      "title": "Pricing",
      "pageViews": 3100,
      "uniqueVisitors": 1200,
      "avgTimeOnPage": null
    },
    {
      "path": "/about",
      "title": "About Us",
      "pageViews": 1500,
      "uniqueVisitors": 800,
      "avgTimeOnPage": null
    }
  ],
  "total": 3
}
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                         | Status |
| ------ | -------------------------------------------------- | -------------------------------- | ------ |
| AC-001 | Returns 200 with pages ranked by page views        | `API-ANALYTICS-PAGES-001`        | ⏳     |
| AC-002 | Returns 401 when user is not authenticated         | `API-ANALYTICS-PAGES-002`        | ⏳     |
| AC-003 | Each page includes path, pageViews, uniqueVisitors | `API-ANALYTICS-PAGES-003`        | ⏳     |
| AC-004 | Pages are sorted by pageViews descending           | `API-ANALYTICS-PAGES-004`        | ⏳     |
| AC-005 | Returns 400 when from parameter is missing         | `API-ANALYTICS-PAGES-005`        | ⏳     |
| AC-006 | Returns empty array when no page views exist       | `API-ANALYTICS-PAGES-006`        | ⏳     |
| AC-007 | Supports filtering by date range                   | `API-ANALYTICS-PAGES-007`        | ⏳     |
| AC-008 | Top pages query works end-to-end (regression)      | `API-ANALYTICS-PAGES-REGRESSION` | ⏳     |

### Implementation References

- **Route**: `src/presentation/api/routes/analytics/query.ts`
- **E2E Spec**: `specs/api/analytics/pages.spec.ts`

---

## US-API-ANALYTICS-005: Query Traffic Sources

**As a** business admin,
**I want to** see where my traffic comes from (referrers, UTM campaigns),
**so that** I can evaluate my marketing efforts.

### API Request (Referrers)

```
GET /api/analytics/referrers?from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z
```

### Response (Referrers)

```json
{
  "referrers": [
    { "domain": "google.com", "pageViews": 3500, "uniqueVisitors": 1200 },
    { "domain": "twitter.com", "pageViews": 1800, "uniqueVisitors": 900 },
    { "domain": null, "pageViews": 5000, "uniqueVisitors": 2000 }
  ],
  "total": 3
}
```

### API Request (Campaigns)

```
GET /api/analytics/campaigns?from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z
```

### Response (Campaigns)

```json
{
  "campaigns": [
    {
      "source": "google",
      "medium": "cpc",
      "campaign": "spring-sale",
      "pageViews": 2500,
      "uniqueVisitors": 800
    },
    {
      "source": "newsletter",
      "medium": "email",
      "campaign": "weekly-digest",
      "pageViews": 1200,
      "uniqueVisitors": 600
    }
  ],
  "total": 2
}
```

### Acceptance Criteria

| ID     | Criterion                                                   | E2E Spec                           | Status |
| ------ | ----------------------------------------------------------- | ---------------------------------- | ------ |
| AC-001 | GET /api/analytics/referrers returns top referrer domains   | `API-ANALYTICS-SOURCES-001`        | ⏳     |
| AC-002 | Returns 401 when user is not authenticated (referrers)      | `API-ANALYTICS-SOURCES-002`        | ⏳     |
| AC-003 | Referrers include null domain for direct traffic            | `API-ANALYTICS-SOURCES-003`        | ⏳     |
| AC-004 | Referrers are sorted by pageViews descending                | `API-ANALYTICS-SOURCES-004`        | ⏳     |
| AC-005 | GET /api/analytics/campaigns returns UTM campaign breakdown | `API-ANALYTICS-SOURCES-005`        | ⏳     |
| AC-006 | Returns 401 when user is not authenticated (campaigns)      | `API-ANALYTICS-SOURCES-006`        | ⏳     |
| AC-007 | Campaigns include source, medium, campaign fields           | `API-ANALYTICS-SOURCES-007`        | ⏳     |
| AC-008 | Returns 400 when from parameter is missing                  | `API-ANALYTICS-SOURCES-008`        | ⏳     |
| AC-009 | Returns empty array when no referrer data exists            | `API-ANALYTICS-SOURCES-009`        | ⏳     |
| AC-010 | Traffic sources query works end-to-end (regression)         | `API-ANALYTICS-SOURCES-REGRESSION` | ⏳     |

### Implementation References

- **Route**: `src/presentation/api/routes/analytics/query.ts`
- **E2E Spec**: `specs/api/analytics/sources.spec.ts`

---

## US-API-ANALYTICS-006: Query Device Breakdown

**As a** business admin,
**I want to** see device, browser, and OS breakdown of my visitors,
**so that** I can ensure my site works well for my audience.

### API Request

```
GET /api/analytics/devices?from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z
```

### Response

```json
{
  "deviceTypes": [
    { "name": "desktop", "count": 7500, "percentage": 60 },
    { "name": "mobile", "count": 4000, "percentage": 32 },
    { "name": "tablet", "count": 1000, "percentage": 8 }
  ],
  "browsers": [
    { "name": "Chrome", "count": 6000, "percentage": 48 },
    { "name": "Safari", "count": 3500, "percentage": 28 },
    { "name": "Firefox", "count": 2000, "percentage": 16 },
    { "name": "Edge", "count": 1000, "percentage": 8 }
  ],
  "operatingSystems": [
    { "name": "Windows", "count": 5000, "percentage": 40 },
    { "name": "macOS", "count": 3500, "percentage": 28 },
    { "name": "iOS", "count": 2500, "percentage": 20 },
    { "name": "Android", "count": 1500, "percentage": 12 }
  ]
}
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                           | Status |
| ------ | ---------------------------------------------------- | ---------------------------------- | ------ |
| AC-001 | Returns 200 with device type breakdown               | `API-ANALYTICS-DEVICES-001`        | ⏳     |
| AC-002 | Returns 401 when user is not authenticated           | `API-ANALYTICS-DEVICES-002`        | ⏳     |
| AC-003 | Device types include desktop, mobile, tablet         | `API-ANALYTICS-DEVICES-003`        | ⏳     |
| AC-004 | Returns browser name breakdown                       | `API-ANALYTICS-DEVICES-004`        | ⏳     |
| AC-005 | Returns OS name breakdown                            | `API-ANALYTICS-DEVICES-005`        | ⏳     |
| AC-006 | Each breakdown includes percentage calculation       | `API-ANALYTICS-DEVICES-006`        | ⏳     |
| AC-007 | Returns 400 when from parameter is missing           | `API-ANALYTICS-DEVICES-007`        | ⏳     |
| AC-008 | Returns empty breakdowns when no data exists         | `API-ANALYTICS-DEVICES-008`        | ⏳     |
| AC-009 | Device breakdown query works end-to-end (regression) | `API-ANALYTICS-DEVICES-REGRESSION` | ⏳     |

### Implementation References

- **Route**: `src/presentation/api/routes/analytics/query.ts`
- **E2E Spec**: `specs/api/analytics/devices.spec.ts`

---

## US-API-ANALYTICS-007: Analytics Data Retention

**As a** business admin,
**I want to** have analytics data automatically purged after the configured retention period,
**so that** storage doesn't grow unbounded and privacy is maintained.

### Configuration

```yaml
analytics:
  retentionDays: 365 # Purge data older than 365 days
```

### Acceptance Criteria

| ID     | Criterion                                                     | E2E Spec                             | Status |
| ------ | ------------------------------------------------------------- | ------------------------------------ | ------ |
| AC-001 | Records older than retentionDays are purged on server startup | `APP-ANALYTICS-RETENTION-001`        | ✅     |
| AC-002 | Purge respects the configured retentionDays value             | `APP-ANALYTICS-RETENTION-002`        | ✅     |
| AC-003 | Records within retention period are preserved                 | `APP-ANALYTICS-RETENTION-003`        | ✅     |
| AC-004 | Purge runs without error when no expired records exist        | `APP-ANALYTICS-RETENTION-004`        | ✅     |
| AC-005 | Default retention is 365 days when not explicitly configured  | `APP-ANALYTICS-RETENTION-005`        | ✅     |
| AC-006 | Data retention purge works correctly (regression)             | `APP-ANALYTICS-RETENTION-REGRESSION` | ✅     |

### Implementation References

- **Use Case**: `src/application/use-cases/analytics/`
- **E2E Spec**: `specs/app/analytics/retention.spec.ts`

---

## Regression Tests

| Spec ID                              | Workflow                                         | Status |
| ------------------------------------ | ------------------------------------------------ | ------ |
| `APP-ANALYTICS-CONFIG-REGRESSION`    | Analytics configuration validates and app starts | ⏳     |
| `API-ANALYTICS-COLLECT-REGRESSION`   | Page view collection works end-to-end            | ⏳     |
| `API-ANALYTICS-OVERVIEW-REGRESSION`  | Analytics overview query works end-to-end        | ⏳     |
| `API-ANALYTICS-PAGES-REGRESSION`     | Top pages query works end-to-end                 | ⏳     |
| `API-ANALYTICS-SOURCES-REGRESSION`   | Traffic sources query works end-to-end           | ⏳     |
| `API-ANALYTICS-DEVICES-REGRESSION`   | Device breakdown query works end-to-end          | ⏳     |
| `APP-ANALYTICS-RETENTION-REGRESSION` | Data retention purge works correctly             | ⏳     |

---

## Coverage Summary

| User Story           | Title                  | Spec Count            | Status      |
| -------------------- | ---------------------- | --------------------- | ----------- |
| US-API-ANALYTICS-001 | Configure Analytics    | 11 + 1 regression     | Not Started |
| US-API-ANALYTICS-002 | Collect Page Views     | 14 + 1 regression     | Not Started |
| US-API-ANALYTICS-003 | Query Overview         | 10 + 1 regression     | Not Started |
| US-API-ANALYTICS-004 | Query Top Pages        | 7 + 1 regression      | Not Started |
| US-API-ANALYTICS-005 | Query Traffic Sources  | 9 + 1 regression      | Not Started |
| US-API-ANALYTICS-006 | Query Device Breakdown | 8 + 1 regression      | Not Started |
| US-API-ANALYTICS-007 | Data Retention         | 5 + 1 regression      | Not Started |
| **Total**            |                        | **64 + 7 regression** |             |
