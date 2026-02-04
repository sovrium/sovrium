# Pages > Page Definition > As Developer

> **Domain**: pages
> **Feature Area**: page-definition
> **Role**: Developer
> **Schema Path**: `src/domain/models/app/pages/`
> **Spec Path**: `specs/api/pages/`

---

## User Stories

### US-PAGE-DEF-001: Define Pages with Routes

**Story**: As a developer, I want to define pages with routes (paths) so that users can navigate to different views.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                 | Spec Test            | Schema        | Status |
| ------ | ----------------------------------------- | -------------------- | ------------- | ------ |
| AC-001 | Pages are accessible at configured routes | `APP-PAGE-ROUTE-001` | `pages.route` | `[x]`  |
| AC-002 | Invalid routes return 404 responses       | `APP-PAGE-ROUTE-002` | `pages.route` | `[x]`  |
| AC-003 | Route conflicts are detected              | `APP-PAGE-ROUTE-003` | `pages.route` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/pages/route.ts` `[x] Exists`
- **E2E Spec**: Route handling tested via API routes
- **Implementation**: Hono router with dynamic route matching

---

### US-PAGE-DEF-002: Set Page Titles and Metadata

**Story**: As a developer, I want to set page titles and metadata so that pages are properly identified.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                      | Spec Test               | Schema           | Status |
| ------ | ---------------------------------------------- | ----------------------- | ---------------- | ------ |
| AC-001 | Page title renders in HTML head                | `APP-PAGE-METADATA-001` | `pages.metadata` | `[x]`  |
| AC-002 | Meta description renders correctly             | `APP-PAGE-METADATA-002` | `pages.metadata` | `[x]`  |
| AC-003 | Open Graph metadata renders for social sharing | `APP-PAGE-METADATA-003` | `pages.metadata` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/pages/metadata.ts` `[x] Exists`
- **E2E Spec**: Metadata rendering tested via page responses
- **Implementation**: React 19 document metadata support

---

### US-PAGE-DEF-003: Define Dynamic Routes with Parameters

**Story**: As a developer, I want to define dynamic routes with parameters (e.g., `/users/:id`) so that I can create detail pages.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                | Spec Test                    | Schema        | Status |
| ------ | ---------------------------------------- | ---------------------------- | ------------- | ------ |
| AC-001 | Dynamic routes capture parameters        | `APP-PAGE-DYNAMIC-ROUTE-001` | `pages.route` | `[x]`  |
| AC-002 | Parameters are passed to page components | `APP-PAGE-DYNAMIC-ROUTE-002` | `pages.route` | `[x]`  |
| AC-003 | Invalid parameter formats return 404     | `APP-PAGE-DYNAMIC-ROUTE-003` | `pages.route` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/pages/route.ts` `[x] Exists`
- **E2E Spec**: Dynamic route handling tested via API routes
- **Implementation**: Hono path parameters with type validation

---

### US-PAGE-DEF-004: Configure Page Layouts

**Story**: As a developer, I want to configure page layouts so that I can create consistent page structures.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test             | Schema       | Status |
| ------ | --------------------------------------- | --------------------- | ------------ | ------ |
| AC-001 | Pages can specify layout to use         | `APP-PAGE-LAYOUT-001` | `pages.page` | `[x]`  |
| AC-002 | Layout applies consistently to page     | `APP-PAGE-LAYOUT-002` | `pages.page` | `[x]`  |
| AC-003 | Default layout used when none specified | `APP-PAGE-LAYOUT-003` | `pages.page` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/pages/page.ts` `[x] Exists`
- **E2E Spec**: Layout application tested via page rendering
- **Implementation**: Layout wrapper components with slot rendering

---

## Coverage Summary

| Story ID        | Title                        | Status         | Criteria Met |
| --------------- | ---------------------------- | -------------- | ------------ |
| US-PAGE-DEF-001 | Define Pages with Routes     | `[x]` Complete | 3/3          |
| US-PAGE-DEF-002 | Set Page Titles and Metadata | `[x]` Complete | 3/3          |
| US-PAGE-DEF-003 | Dynamic Routes with Params   | `[x]` Complete | 3/3          |
| US-PAGE-DEF-004 | Configure Page Layouts       | `[x]` Complete | 3/3          |

**Total**: 4 complete, 0 partial, 0 not started (100% complete)

---

> **Navigation**: [← Back to Pages Domain](../README.md) | [Page Definition as App Administrator →](./as-app-administrator.md)
