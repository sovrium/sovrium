# Theme > Branding > As Developer

> **Domain**: theme
> **Feature Area**: branding
> **Role**: Developer
> **Schema Path**: `src/domain/models/app/theme/branding/`
> **Spec Path**: `specs/api/theme/branding/`

---

## User Stories

### US-THEME-BRAND-001: Configure Logo Dimensions and Placement

**Story**: As a developer, I want to configure logo dimensions and placement so that it fits the layout.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                       | Spec Test            | Schema           | Status |
| ------ | ----------------------------------------------- | -------------------- | ---------------- | ------ |
| AC-001 | Logo dimensions configurable (width/height)     | `APP-THEME-LOGO-001` | `theme.branding` | `[x]`  |
| AC-002 | Logo placement configurable (header position)   | `APP-THEME-LOGO-002` | `theme.branding` | `[x]`  |
| AC-003 | Logo displays at appropriate sizes per viewport | `APP-THEME-LOGO-003` | `theme.branding` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/theme/branding.ts` `[x] Exists`
- **E2E Spec**: Logo dimensions tested via header component
- **Implementation**: CSS variables for logo size and position

---

### US-THEME-BRAND-002: Set Social Preview Images

**Story**: As a developer, I want to set social preview images (Open Graph) so that shared links look good.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                        | Spec Test          | Schema           | Status |
| ------ | -------------------------------- | ------------------ | ---------------- | ------ |
| AC-001 | Open Graph image configurable    | `APP-THEME-OG-001` | `theme.branding` | `[x]`  |
| AC-002 | Image sized correctly (1200x630) | `APP-THEME-OG-002` | `theme.branding` | `[x]`  |
| AC-003 | Fallback image available         | `APP-THEME-OG-003` | `theme.branding` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/theme/branding.ts` `[x] Exists`
- **E2E Spec**: OG images tested via meta tag output
- **Implementation**: Meta tags generated in HTML head

---

## Coverage Summary

| Story ID           | Title                     | Status         | Criteria Met |
| ------------------ | ------------------------- | -------------- | ------------ |
| US-THEME-BRAND-001 | Configure Logo Dimensions | `[x]` Complete | 3/3          |
| US-THEME-BRAND-002 | Social Preview Images     | `[x]` Complete | 3/3          |

**Total**: 2 complete, 0 partial, 0 not started (100% complete)

---

> **Navigation**: [← Back to Theme Domain](../README.md) | [Branding as App Administrator →](./as-app-administrator.md)
