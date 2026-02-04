# Pages > Layouts & Templates > As Developer

> **Domain**: pages
> **Feature Area**: layouts-templates
> **Role**: Developer
> **Schema Path**: `src/domain/models/app/pages/layouts/`
> **Spec Path**: `specs/api/layouts/`

---

## User Stories

### US-PAGE-LAYOUT-001: Define Reusable Layouts

**Story**: As a developer, I want to define reusable layouts so that pages share common structure.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test                 | Schema           | Status |
| ------ | --------------------------------------- | ------------------------- | ---------------- | ------ |
| AC-001 | Layouts are defined in configuration    | `APP-PAGE-LAYOUT-DEF-001` | `layouts.layout` | `[x]`  |
| AC-002 | Layouts apply consistently across pages | `APP-PAGE-LAYOUT-DEF-002` | `layouts.layout` | `[x]`  |
| AC-003 | Layout changes propagate to all pages   | `APP-PAGE-LAYOUT-DEF-003` | `layouts.layout` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/pages/layouts/layout.ts` `[x] Exists`
- **E2E Spec**: Layout application tested via page rendering
- **Implementation**: React layout components with children slots

---

### US-PAGE-LAYOUT-002: Nest Layouts

**Story**: As a developer, I want to nest layouts so that I can create hierarchical page structures.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                | Spec Test                  | Schema           | Status |
| ------ | ---------------------------------------- | -------------------------- | ---------------- | ------ |
| AC-001 | Layouts can extend parent layouts        | `APP-PAGE-LAYOUT-NEST-001` | `layouts.layout` | `[x]`  |
| AC-002 | Nested layouts inherit parent structure  | `APP-PAGE-LAYOUT-NEST-002` | `layouts.layout` | `[x]`  |
| AC-003 | Deep nesting (3+ levels) works correctly | `APP-PAGE-LAYOUT-NEST-003` | `layouts.layout` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/pages/layouts/layout.ts` `[x] Exists`
- **E2E Spec**: Nested layout rendering tested via page responses
- **Implementation**: Layout composition with parent reference

---

### US-PAGE-LAYOUT-003: Define Header, Footer, and Sidebar Regions

**Story**: As a developer, I want to define header, footer, and sidebar regions so that navigation is consistent.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                        | Spec Test                    | Schema           | Status |
| ------ | -------------------------------- | ---------------------------- | ---------------- | ------ |
| AC-001 | Header region renders at top     | `APP-PAGE-LAYOUT-REGION-001` | `layouts.region` | `[x]`  |
| AC-002 | Footer region renders at bottom  | `APP-PAGE-LAYOUT-REGION-002` | `layouts.region` | `[x]`  |
| AC-003 | Sidebar region renders correctly | `APP-PAGE-LAYOUT-REGION-003` | `layouts.region` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/pages/layouts/region.ts` `[x] Exists`
- **E2E Spec**: Region rendering tested via page structure
- **Implementation**: Named slots for layout regions

---

### US-PAGE-LAYOUT-004: Responsive Layouts

**Story**: As a developer, I want responsive layouts that work on mobile and desktop so that the app is accessible everywhere.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                             | Spec Test                        | Schema           | Status |
| ------ | ------------------------------------- | -------------------------------- | ---------------- | ------ |
| AC-001 | Layouts adapt to mobile screen sizes  | `APP-PAGE-LAYOUT-RESPONSIVE-001` | `layouts.layout` | `[x]`  |
| AC-002 | Responsive breakpoints work correctly | `APP-PAGE-LAYOUT-RESPONSIVE-002` | `layouts.layout` | `[x]`  |
| AC-003 | Sidebar collapses on mobile           | `APP-PAGE-LAYOUT-RESPONSIVE-003` | `layouts.layout` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/pages/layouts/layout.ts` `[x] Exists`
- **E2E Spec**: Responsive behavior tested at multiple viewports
- **Implementation**: Tailwind CSS responsive utilities

---

## Coverage Summary

| Story ID           | Title                   | Status         | Criteria Met |
| ------------------ | ----------------------- | -------------- | ------------ |
| US-PAGE-LAYOUT-001 | Define Reusable Layouts | `[x]` Complete | 3/3          |
| US-PAGE-LAYOUT-002 | Nest Layouts            | `[x]` Complete | 3/3          |
| US-PAGE-LAYOUT-003 | Header/Footer/Sidebar   | `[x]` Complete | 3/3          |
| US-PAGE-LAYOUT-004 | Responsive Layouts      | `[x]` Complete | 3/3          |

**Total**: 4 complete, 0 partial, 0 not started (100% complete)

---

> **Navigation**: [← Back to Pages Domain](../README.md) | [Layouts as App Administrator →](./as-app-administrator.md)
