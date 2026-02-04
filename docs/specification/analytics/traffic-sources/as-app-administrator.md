# Analytics > Traffic Sources > As App Administrator

> **Domain**: analytics
> **Feature Area**: traffic-sources
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/analytics/sources/`
> **Spec Path**: `specs/app/analytics/sources/`

---

## User Stories

### US-ANAL-SOURCE-ADMIN-001: View Traffic Sources

**Story**: As an app administrator, I want to see where traffic comes from (direct, referral, search) so that I understand acquisition channels.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                           | Spec Test                     | Schema              | Status |
| ------ | ----------------------------------- | ----------------------------- | ------------------- | ------ |
| AC-001 | Traffic sources categorized         | `APP-ANAL-SOURCE-CHANNEL-001` | `analytics.sources` | `[ ]`  |
| AC-002 | Direct traffic properly identified  | `APP-ANAL-SOURCE-CHANNEL-002` | `analytics.sources` | `[ ]`  |
| AC-003 | Search traffic attributed correctly | `APP-ANAL-SOURCE-CHANNEL-003` | `analytics.sources` | `[ ]`  |
| AC-004 | Returns 401 without authentication  | `APP-ANAL-SOURCE-CHANNEL-004` | `analytics.sources` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/analytics/sources/channels.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/analytics/sources/channels.spec.ts` `[ ] Needs Creation`
- **UI Route**: `/admin/analytics/sources` `[ ] Not Implemented`

---

### US-ANAL-SOURCE-ADMIN-002: View Referring Websites

**Story**: As an app administrator, I want to see top referring websites so that I know which external links drive traffic.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test                      | Schema              | Status |
| ------ | ---------------------------------- | ------------------------------ | ------------------- | ------ |
| AC-001 | Referrer data captured from HTTP   | `APP-ANAL-SOURCE-REFERRER-001` | `analytics.sources` | `[ ]`  |
| AC-002 | Top referrers ranked by volume     | `APP-ANAL-SOURCE-REFERRER-002` | `analytics.sources` | `[ ]`  |
| AC-003 | Returns 401 without authentication | `APP-ANAL-SOURCE-REFERRER-003` | `analytics.sources` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/analytics/sources/referrers.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/analytics/sources/referrers.spec.ts` `[ ] Needs Creation`

---

### US-ANAL-SOURCE-ADMIN-003: View Search Keywords

**Story**: As an app administrator, I want to see search keywords that brought users so that I understand SEO effectiveness.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                            | Spec Test                     | Schema              | Status |
| ------ | ------------------------------------ | ----------------------------- | ------------------- | ------ |
| AC-001 | Search keywords extracted and stored | `APP-ANAL-SOURCE-KEYWORD-001` | `analytics.sources` | `[ ]`  |
| AC-002 | Keywords ranked by volume            | `APP-ANAL-SOURCE-KEYWORD-002` | `analytics.sources` | `[ ]`  |
| AC-003 | Returns 401 without authentication   | `APP-ANAL-SOURCE-KEYWORD-003` | `analytics.sources` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/analytics/sources/keywords.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/analytics/sources/keywords.spec.ts` `[ ] Needs Creation`

---

### US-ANAL-SOURCE-ADMIN-004: Track Campaign UTM Parameters

**Story**: As an app administrator, I want to see campaign tracking (UTM parameters) so that I can measure marketing efforts.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                            | Spec Test                 | Schema              | Status |
| ------ | ------------------------------------ | ------------------------- | ------------------- | ------ |
| AC-001 | UTM parameters parsed correctly      | `APP-ANAL-SOURCE-UTM-001` | `analytics.sources` | `[ ]`  |
| AC-002 | Campaign data stored and retrievable | `APP-ANAL-SOURCE-UTM-002` | `analytics.sources` | `[ ]`  |
| AC-003 | Returns 401 without authentication   | `APP-ANAL-SOURCE-UTM-003` | `analytics.sources` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/analytics/sources/utm.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/analytics/sources/utm.spec.ts` `[ ] Needs Creation`

---

## Coverage Summary

| Story ID                 | Title                   | Status            | Criteria Met |
| ------------------------ | ----------------------- | ----------------- | ------------ |
| US-ANAL-SOURCE-ADMIN-001 | View Traffic Sources    | `[ ]` Not Started | 0/4          |
| US-ANAL-SOURCE-ADMIN-002 | View Referring Websites | `[ ]` Not Started | 0/3          |
| US-ANAL-SOURCE-ADMIN-003 | View Search Keywords    | `[ ]` Not Started | 0/3          |
| US-ANAL-SOURCE-ADMIN-004 | Track Campaign UTM      | `[ ]` Not Started | 0/3          |

**Total**: 0 complete, 0 partial, 4 not started (0% complete)

---

> **Navigation**: [← Back to Analytics Domain](../README.md)
