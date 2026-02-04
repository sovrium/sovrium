# Theme > Dark Mode > As App Administrator

> **Domain**: theme
> **Feature Area**: dark-mode
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/app/theme/`
> **Spec Path**: `specs/api/theme/dark-mode/admin/`

---

## User Stories

### US-THEME-DARK-ADMIN-001: Enable/Disable Dark Mode Support

**Story**: As an app administrator, I want to enable/disable dark mode support so that I can control the user experience.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                             | Spec Test              | Schema           | Status |
| ------ | ------------------------------------- | ---------------------- | ---------------- | ------ |
| AC-001 | Dark mode can be enabled in settings  | `APP-THEME-ENABLE-001` | `theme.darkMode` | `[x]`  |
| AC-002 | Dark mode can be disabled in settings | `APP-THEME-ENABLE-002` | `theme.darkMode` | `[x]`  |
| AC-003 | Toggle UI hidden when disabled        | `APP-THEME-ENABLE-003` | `theme.darkMode` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/theme/dark-mode.ts` `[x] Exists`
- **E2E Spec**: Dark mode enable/disable tested via settings
- **Implementation**: Boolean flag `darkMode.enabled` in schema

---

### US-THEME-DARK-ADMIN-002: Preview Both Modes in Editor

**Story**: As an app administrator, I want to preview both light and dark modes in the editor so that I can verify both look good.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test               | Schema        | Status |
| ------ | --------------------------------------- | ----------------------- | ------------- | ------ |
| AC-001 | Side-by-side preview available          | `API-THEME-PREVIEW-001` | `theme.admin` | `[ ]`  |
| AC-002 | Mode toggle in preview panel            | `API-THEME-PREVIEW-002` | `theme.admin` | `[ ]`  |
| AC-003 | Preview updates live with theme changes | `API-THEME-PREVIEW-003` | `theme.admin` | `[ ]`  |
| AC-004 | Returns 401 without authentication      | `API-THEME-PREVIEW-004` | `theme.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/theme/` `[x] Exists`
- **E2E Spec**: `specs/api/theme/dark-mode/admin/preview.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/theme/admin/preview` `[ ] Not Implemented`

---

## Coverage Summary

| Story ID                | Title                    | Status            | Criteria Met |
| ----------------------- | ------------------------ | ----------------- | ------------ |
| US-THEME-DARK-ADMIN-001 | Enable/Disable Dark Mode | `[x]` Complete    | 3/3          |
| US-THEME-DARK-ADMIN-002 | Preview Both Modes       | `[ ]` Not Started | 0/4          |

**Total**: 1 complete, 0 partial, 1 not started (50% complete)

---

> **Navigation**: [← Back to Theme Domain](../README.md) | [← Dark Mode as Developer](./as-developer.md)
