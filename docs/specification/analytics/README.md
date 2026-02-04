# Analytics Domain

> User stories for Analytics - usage tracking and insights in Sovrium applications. Analytics help administrators understand how users interact with the application.

---

## Feature Areas

| Feature Area     | Description                                      | Role Files                         |
| ---------------- | ------------------------------------------------ | ---------------------------------- |
| traffic-overview | Page views, visitors, sessions, date filtering   | as-app-administrator               |
| traffic-sources  | Referrals, search keywords, UTM tracking         | as-app-administrator               |
| user-journey     | Navigation flows, popular pages, entry/exit      | as-app-administrator               |
| performance      | Load times, Core Web Vitals, error rates         | as-app-administrator, as-developer |
| user-activity    | Active users, activity logs, feature usage       | as-app-administrator               |
| privacy          | Cookie-less analytics, anonymization, compliance | as-app-administrator, as-developer |

---

## Coverage Summary

| Feature Area     | Stories | Complete | Partial | Not Started | Coverage |
| ---------------- | ------- | -------- | ------- | ----------- | -------- |
| traffic-overview | 5       | 0        | 0       | 5           | 0%       |
| traffic-sources  | 4       | 0        | 0       | 4           | 0%       |
| user-journey     | 4       | 0        | 0       | 4           | 0%       |
| performance      | 6       | 0        | 0       | 6           | 0%       |
| user-activity    | 4       | 0        | 0       | 4           | 0%       |
| privacy          | 7       | 0        | 0       | 7           | 0%       |

**Total**: 30 stories, 0 complete, 0 partial, 30 not started (0% complete)

---

## Schema Paths

- **Traffic Overview**: `src/domain/models/analytics/traffic/`
- **Traffic Sources**: `src/domain/models/analytics/sources/`
- **User Journey**: `src/domain/models/analytics/journey/`
- **Performance**: `src/domain/models/analytics/performance/`
- **User Activity**: `src/domain/models/analytics/activity/`
- **Privacy**: `src/domain/models/analytics/privacy/`

## Spec Paths

- **App Specs**: `specs/app/analytics/`
- **API Specs**: `specs/api/analytics/`

---

> **Navigation**: [← Back to Specification](../README.md)
