# Theme > Typography > As App Administrator

> **Domain**: theme
> **Feature Area**: typography
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/app/theme/fonts/`
> **Spec Path**: `specs/api/theme/typography/`

---

## User Stories

### US-THEME-TYPO-ADMIN-001: Select Heading Fonts

**Story**: As an app administrator, I want to select heading fonts so that titles have appropriate styling.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                              | Spec Test               | Schema        | Status |
| ------ | -------------------------------------- | ----------------------- | ------------- | ------ |
| AC-001 | Heading font family configurable       | `APP-THEME-HEADING-001` | `theme.fonts` | `[x]`  |
| AC-002 | Heading font applied to h1-h6 elements | `APP-THEME-HEADING-002` | `theme.fonts` | `[x]`  |
| AC-003 | Preview of heading font available      | `APP-THEME-HEADING-003` | `theme.fonts` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/theme/fonts.ts` `[x] Exists`
- **E2E Spec**: Heading fonts tested via heading elements
- **Implementation**: CSS variable `--font-heading`

---

### US-THEME-TYPO-ADMIN-002: Select Body Fonts

**Story**: As an app administrator, I want to select body fonts so that content is readable.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                | Spec Test            | Schema        | Status |
| ------ | ---------------------------------------- | -------------------- | ------------- | ------ |
| AC-001 | Body font family configurable            | `APP-THEME-BODY-001` | `theme.fonts` | `[x]`  |
| AC-002 | Body font applied to paragraphs and text | `APP-THEME-BODY-002` | `theme.fonts` | `[x]`  |
| AC-003 | Preview of body font available           | `APP-THEME-BODY-003` | `theme.fonts` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/theme/fonts.ts` `[x] Exists`
- **E2E Spec**: Body fonts tested via paragraph elements
- **Implementation**: CSS variable `--font-body`

---

### US-THEME-TYPO-ADMIN-003: Adjust Base Font Size

**Story**: As an app administrator, I want to adjust base font size so that text is appropriately sized.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                               | Spec Test            | Schema        | Status |
| ------ | --------------------------------------- | -------------------- | ------------- | ------ |
| AC-001 | Base font size configurable (px or rem) | `APP-THEME-SIZE-001` | `theme.fonts` | `[x]`  |
| AC-002 | Size affects all relative typography    | `APP-THEME-SIZE-002` | `theme.fonts` | `[x]`  |
| AC-003 | Reasonable size bounds enforced         | `APP-THEME-SIZE-003` | `theme.fonts` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/theme/fonts.ts` `[x] Exists`
- **E2E Spec**: Base font size tested via root element
- **Implementation**: CSS variable `--font-size-base`

---

### US-THEME-TYPO-ADMIN-004: Set Line Height and Spacing

**Story**: As an app administrator, I want to set line height and spacing so that text is comfortable to read.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                    | Spec Test            | Schema        | Status |
| ------ | ---------------------------- | -------------------- | ------------- | ------ |
| AC-001 | Line height configurable     | `APP-THEME-LINE-001` | `theme.fonts` | `[x]`  |
| AC-002 | Letter spacing configurable  | `APP-THEME-LINE-002` | `theme.fonts` | `[x]`  |
| AC-003 | Spacing applied consistently | `APP-THEME-LINE-003` | `theme.fonts` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/theme/fonts.ts` `[x] Exists`
- **E2E Spec**: Line height tested via text blocks
- **Implementation**: CSS variables `--line-height-*`, `--letter-spacing-*`

---

## Coverage Summary

| Story ID                | Title                   | Status         | Criteria Met |
| ----------------------- | ----------------------- | -------------- | ------------ |
| US-THEME-TYPO-ADMIN-001 | Select Heading Fonts    | `[x]` Complete | 3/3          |
| US-THEME-TYPO-ADMIN-002 | Select Body Fonts       | `[x]` Complete | 3/3          |
| US-THEME-TYPO-ADMIN-003 | Adjust Base Font Size   | `[x]` Complete | 3/3          |
| US-THEME-TYPO-ADMIN-004 | Set Line Height/Spacing | `[x]` Complete | 3/3          |

**Total**: 4 complete, 0 partial, 0 not started (100% complete)

---

> **Navigation**: [← Back to Theme Domain](../README.md) | [← Typography as Developer](./as-developer.md)
