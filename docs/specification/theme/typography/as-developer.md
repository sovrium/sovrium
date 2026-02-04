# Theme > Typography > As Developer

> **Domain**: theme
> **Feature Area**: typography
> **Role**: Developer
> **Schema Path**: `src/domain/models/app/theme/fonts/`
> **Spec Path**: `specs/api/theme/typography/`

---

## User Stories

### US-THEME-TYPO-001: Type Scale Definition

**Story**: As a developer, I want a type scale (h1-h6, body, small) so that typography is consistent.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                    | Spec Test             | Schema        | Status |
| ------ | -------------------------------------------- | --------------------- | ------------- | ------ |
| AC-001 | Type scale defined for h1-h6                 | `APP-THEME-SCALE-001` | `theme.fonts` | `[x]`  |
| AC-002 | Body and small text sizes defined            | `APP-THEME-SCALE-002` | `theme.fonts` | `[x]`  |
| AC-003 | Scale is mathematically consistent           | `APP-THEME-SCALE-003` | `theme.fonts` | `[x]`  |
| AC-004 | Line heights ensure readability at all sizes | `APP-THEME-SCALE-004` | `theme.fonts` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/theme/fonts.ts` `[x] Exists`
- **E2E Spec**: Type scale tested via heading/body rendering
- **Implementation**: CSS variables for each level in type scale

---

### US-THEME-TYPO-002: Configure Font Weights

**Story**: As a developer, I want to configure font weights so that I can create visual hierarchy.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                      | Spec Test              | Schema        | Status |
| ------ | ---------------------------------------------- | ---------------------- | ------------- | ------ |
| AC-001 | Font weights configurable (400, 500, 600, 700) | `APP-THEME-WEIGHT-001` | `theme.fonts` | `[x]`  |
| AC-002 | Weights applied to semantic elements           | `APP-THEME-WEIGHT-002` | `theme.fonts` | `[x]`  |
| AC-003 | Bold/semibold variants available               | `APP-THEME-WEIGHT-003` | `theme.fonts` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/theme/fonts.ts` `[x] Exists`
- **E2E Spec**: Font weights tested via text rendering
- **Implementation**: CSS variable `--font-weight-*`

---

### US-THEME-TYPO-003: System Font Fallbacks

**Story**: As a developer, I want to use system fonts as fallbacks so that the app loads quickly.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                    | Spec Test                | Schema        | Status |
| ------ | -------------------------------------------- | ------------------------ | ------------- | ------ |
| AC-001 | System font stack defined as fallback        | `APP-THEME-FALLBACK-001` | `theme.fonts` | `[x]`  |
| AC-002 | Custom fonts fall back gracefully            | `APP-THEME-FALLBACK-002` | `theme.fonts` | `[x]`  |
| AC-003 | Font files loaded efficiently (font-display) | `APP-THEME-FALLBACK-003` | `theme.fonts` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/theme/fonts.ts` `[x] Exists`
- **E2E Spec**: Font fallback tested via network throttling
- **Implementation**: CSS font-family with system font stack

---

## Coverage Summary

| Story ID          | Title                  | Status         | Criteria Met |
| ----------------- | ---------------------- | -------------- | ------------ |
| US-THEME-TYPO-001 | Type Scale Definition  | `[x]` Complete | 4/4          |
| US-THEME-TYPO-002 | Configure Font Weights | `[x]` Complete | 3/3          |
| US-THEME-TYPO-003 | System Font Fallbacks  | `[x]` Complete | 3/3          |

**Total**: 3 complete, 0 partial, 0 not started (100% complete)

---

> **Navigation**: [← Back to Theme Domain](../README.md) | [Typography as App Administrator →](./as-app-administrator.md)
