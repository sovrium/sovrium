# Pages > Layouts & Templates > As App Administrator

> **Domain**: pages
> **Feature Area**: layouts-templates
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/app/pages/layouts/`
> **Spec Path**: `specs/api/layouts/admin/`

---

## User Stories

### US-PAGE-LAYOUT-ADMIN-001: Select From Available Layouts

**Story**: As an app administrator, I want to select from available layouts when creating pages so that I maintain consistency.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                 | Spec Test                     | Schema          | Status |
| ------ | ----------------------------------------- | ----------------------------- | --------------- | ------ |
| AC-001 | Layout picker shows all available layouts | `API-LAYOUT-ADMIN-SELECT-001` | `layouts.admin` | `[ ]`  |
| AC-002 | Preview of each layout is visible         | `API-LAYOUT-ADMIN-SELECT-002` | `layouts.admin` | `[ ]`  |
| AC-003 | Selected layout applies to new page       | `API-LAYOUT-ADMIN-SELECT-003` | `layouts.admin` | `[ ]`  |
| AC-004 | Returns 401 without authentication        | `API-LAYOUT-ADMIN-SELECT-004` | `layouts.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/pages/layouts/` `[x] Exists`
- **E2E Spec**: `specs/api/layouts/admin/select.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/layouts/admin/select` `[ ] Not Implemented`

---

### US-PAGE-LAYOUT-ADMIN-002: Customize Layout Regions Visually

**Story**: As an app administrator, I want to customize layout regions (header, sidebar) visually so that I can adjust the structure.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                            | Spec Test                        | Schema          | Status |
| ------ | ------------------------------------ | -------------------------------- | --------------- | ------ |
| AC-001 | Region editor shows editable regions | `API-LAYOUT-ADMIN-CUSTOMIZE-001` | `layouts.admin` | `[ ]`  |
| AC-002 | Can toggle region visibility         | `API-LAYOUT-ADMIN-CUSTOMIZE-002` | `layouts.admin` | `[ ]`  |
| AC-003 | Can configure region content         | `API-LAYOUT-ADMIN-CUSTOMIZE-003` | `layouts.admin` | `[ ]`  |
| AC-004 | Changes preview in real-time         | `API-LAYOUT-ADMIN-CUSTOMIZE-004` | `layouts.admin` | `[ ]`  |
| AC-005 | Returns 401 without authentication   | `API-LAYOUT-ADMIN-CUSTOMIZE-005` | `layouts.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/pages/layouts/` `[x] Exists`
- **E2E Spec**: `specs/api/layouts/admin/customize.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/layouts/:id/admin/regions` `[ ] Not Implemented`

---

## Coverage Summary

| Story ID                 | Title                         | Status            | Criteria Met |
| ------------------------ | ----------------------------- | ----------------- | ------------ |
| US-PAGE-LAYOUT-ADMIN-001 | Select From Available Layouts | `[ ]` Not Started | 0/4          |
| US-PAGE-LAYOUT-ADMIN-002 | Customize Layout Regions      | `[ ]` Not Started | 0/5          |

**Total**: 0 complete, 0 partial, 2 not started (0% complete)

---

> **Navigation**: [← Back to Pages Domain](../README.md) | [← Layouts as Developer](./as-developer.md)
