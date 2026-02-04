# Analytics > User Activity > As App Administrator

> **Domain**: analytics
> **Feature Area**: user-activity
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/analytics/activity/`
> **Spec Path**: `specs/app/analytics/activity/`

---

## User Stories

### US-ANAL-ACTIVITY-ADMIN-001: View Active User Counts

**Story**: As an app administrator, I want to see active user counts (daily, weekly, monthly) so that I understand engagement.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                            | Spec Test                     | Schema               | Status |
| ------ | ------------------------------------ | ----------------------------- | -------------------- | ------ |
| AC-001 | DAU (Daily Active Users) displayed   | `APP-ANAL-ACTIVITY-COUNT-001` | `analytics.activity` | `[ ]`  |
| AC-002 | WAU (Weekly Active Users) displayed  | `APP-ANAL-ACTIVITY-COUNT-002` | `analytics.activity` | `[ ]`  |
| AC-003 | MAU (Monthly Active Users) displayed | `APP-ANAL-ACTIVITY-COUNT-003` | `analytics.activity` | `[ ]`  |
| AC-004 | Users counted uniquely per period    | `APP-ANAL-ACTIVITY-COUNT-004` | `analytics.activity` | `[ ]`  |
| AC-005 | Returns 401 without authentication   | `APP-ANAL-ACTIVITY-COUNT-005` | `analytics.activity` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/analytics/activity/active-users.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/analytics/activity/active-users.spec.ts` `[ ] Needs Creation`
- **UI Route**: `/admin/analytics/activity` `[ ] Not Implemented`

---

### US-ANAL-ACTIVITY-ADMIN-002: View Activity Logs

**Story**: As an app administrator, I want to see user activity logs so that I can audit actions.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                           | Spec Test                   | Schema               | Status |
| ------ | ----------------------------------- | --------------------------- | -------------------- | ------ |
| AC-001 | Activity logs capture user ID       | `APP-ANAL-ACTIVITY-LOG-001` | `analytics.activity` | `[ ]`  |
| AC-002 | Activity logs capture action type   | `APP-ANAL-ACTIVITY-LOG-002` | `analytics.activity` | `[ ]`  |
| AC-003 | Activity logs capture timestamp     | `APP-ANAL-ACTIVITY-LOG-003` | `analytics.activity` | `[ ]`  |
| AC-004 | Activity logs capture relevant data | `APP-ANAL-ACTIVITY-LOG-004` | `analytics.activity` | `[ ]`  |
| AC-005 | Returns 401 without authentication  | `APP-ANAL-ACTIVITY-LOG-005` | `analytics.activity` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/analytics/activity/logs.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/analytics/activity/logs.spec.ts` `[ ] Needs Creation`

---

### US-ANAL-ACTIVITY-ADMIN-003: View Feature Usage Statistics

**Story**: As an app administrator, I want to see feature usage statistics so that I know what functionality is popular.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test                       | Schema               | Status |
| ------ | --------------------------------------- | ------------------------------- | -------------------- | ------ |
| AC-001 | Feature usage tracks meaningful actions | `APP-ANAL-ACTIVITY-FEATURE-001` | `analytics.activity` | `[ ]`  |
| AC-002 | Not just page views tracked             | `APP-ANAL-ACTIVITY-FEATURE-002` | `analytics.activity` | `[ ]`  |
| AC-003 | Returns 401 without authentication      | `APP-ANAL-ACTIVITY-FEATURE-003` | `analytics.activity` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/analytics/activity/feature-usage.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/analytics/activity/feature-usage.spec.ts` `[ ] Needs Creation`

---

### US-ANAL-ACTIVITY-ADMIN-004: View Retention Metrics

**Story**: As an app administrator, I want to see user retention metrics so that I understand if users return.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                           | Spec Test                         | Schema               | Status |
| ------ | ----------------------------------- | --------------------------------- | -------------------- | ------ |
| AC-001 | Retention cohort analysis available | `APP-ANAL-ACTIVITY-RETENTION-001` | `analytics.activity` | `[ ]`  |
| AC-002 | Return rates shown over time        | `APP-ANAL-ACTIVITY-RETENTION-002` | `analytics.activity` | `[ ]`  |
| AC-003 | Returns 401 without authentication  | `APP-ANAL-ACTIVITY-RETENTION-003` | `analytics.activity` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/analytics/activity/retention.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/analytics/activity/retention.spec.ts` `[ ] Needs Creation`

---

## Coverage Summary

| Story ID                   | Title                    | Status            | Criteria Met |
| -------------------------- | ------------------------ | ----------------- | ------------ |
| US-ANAL-ACTIVITY-ADMIN-001 | View Active User Counts  | `[ ]` Not Started | 0/5          |
| US-ANAL-ACTIVITY-ADMIN-002 | View Activity Logs       | `[ ]` Not Started | 0/5          |
| US-ANAL-ACTIVITY-ADMIN-003 | View Feature Usage Stats | `[ ]` Not Started | 0/3          |
| US-ANAL-ACTIVITY-ADMIN-004 | View Retention Metrics   | `[ ]` Not Started | 0/3          |

**Total**: 0 complete, 0 partial, 4 not started (0% complete)

---

> **Navigation**: [← Back to Analytics Domain](../README.md)
