# Design Tokens

> **Feature Area**: Theming - Design System
> **Schema**: `src/domain/models/app/theme/`
> **E2E Specs**: `specs/app/theme/`

---

## Overview

Sovrium provides a comprehensive theming system based on design tokens. Design tokens define the visual language of your application including colors, typography, spacing, shadows, and border radius. Tokens can be customized globally and used consistently throughout your app.

---

## US-APP-THEME-001: Configure Theme Settings

**As a** developer,
**I want to** configure global theme settings,
**so that** my application has a consistent visual design.

### Configuration

```yaml
theme:
  name: default
  darkMode: auto # auto | light | dark
  colors:
    primary: '#3b82f6'
    secondary: '#8b5cf6'
    accent: '#f59e0b'
    background: '#ffffff'
    foreground: '#0f172a'
    muted: '#f1f5f9'
    border: '#e2e8f0'
    error: '#ef4444'
    warning: '#f59e0b'
    success: '#22c55e'
    info: '#3b82f6'
  fonts:
    sans: 'Inter, system-ui, sans-serif'
    serif: 'Georgia, serif'
    mono: 'Fira Code, monospace'
  spacing:
    xs: '0.25rem'
    sm: '0.5rem'
    md: '1rem'
    lg: '2rem'
    xl: '4rem'
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec               | Status |
| ------ | -------------------------------------------------- | ---------------------- | ------ |
| AC-001 | Theme name is validated                            | `APP-THEME-001`        | ✅     |
| AC-002 | Dark mode setting is respected                     | `APP-THEME-002`        | ✅     |
| AC-003 | Auto dark mode follows system preference           | `APP-THEME-003`        | ✅     |
| AC-004 | Theme can be toggled at runtime                    | `APP-THEME-004`        | ✅     |
| AC-005 | Custom theme overrides default values              | `APP-THEME-005`        | ✅     |
| AC-006 | Empty theme uses default settings                  | `APP-THEME-006`        | ✅     |
| AC-007 | Theme CSS variables are generated                  | `APP-THEME-007`        | ✅     |
| AC-008 | Theme is applied to root element                   | `APP-THEME-008`        | ✅     |
| AC-009 | Theme supports CSS custom properties               | `APP-THEME-009`        | ✅     |
| AC-010 | Invalid theme values return validation error       | `APP-THEME-010`        | ✅     |
| AC-011 | Theme persists across page navigation              | `APP-THEME-011`        | ✅     |
| AC-012 | Theme is accessible via JavaScript API             | `APP-THEME-012`        | ✅     |
| AC-013 | User can complete full theme workflow (regression) | `APP-THEME-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/theme/theme.spec.ts`

---

## US-APP-THEME-002: Color Tokens

**As a** developer,
**I want to** define a color palette for my application,
**so that** colors are consistent and easy to update.

### Configuration

```yaml
theme:
  colors:
    # Brand colors
    primary: '#3b82f6'
    primary-foreground: '#ffffff'
    secondary: '#8b5cf6'
    secondary-foreground: '#ffffff'

    # Semantic colors
    background: '#ffffff'
    foreground: '#0f172a'
    card: '#ffffff'
    card-foreground: '#0f172a'
    popover: '#ffffff'
    popover-foreground: '#0f172a'
    muted: '#f1f5f9'
    muted-foreground: '#64748b'

    # State colors
    destructive: '#ef4444'
    destructive-foreground: '#ffffff'
    border: '#e2e8f0'
    input: '#e2e8f0'
    ring: '#3b82f6'
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                      | Status |
| ------ | -------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Primary color is applied correctly                 | `APP-THEME-COLORS-001`        | ✅     |
| AC-002 | Secondary color is applied correctly               | `APP-THEME-COLORS-002`        | ✅     |
| AC-003 | Background color sets page background              | `APP-THEME-COLORS-003`        | ✅     |
| AC-004 | Foreground color sets default text color           | `APP-THEME-COLORS-004`        | ✅     |
| AC-005 | Muted colors are available for subtle UI           | `APP-THEME-COLORS-005`        | ✅     |
| AC-006 | Border color is applied to borders                 | `APP-THEME-COLORS-006`        | ✅     |
| AC-007 | Destructive color is used for errors               | `APP-THEME-COLORS-007`        | ✅     |
| AC-008 | Colors support hex format                          | `APP-THEME-COLORS-008`        | ✅     |
| AC-009 | Colors support RGB format                          | `APP-THEME-COLORS-009`        | ✅     |
| AC-010 | Colors support HSL format                          | `APP-THEME-COLORS-010`        | ✅     |
| AC-011 | Invalid color format returns error                 | `APP-THEME-COLORS-011`        | ✅     |
| AC-012 | Colors generate CSS variables                      | `APP-THEME-COLORS-012`        | ✅     |
| AC-013 | Dark mode colors are defined separately            | `APP-THEME-COLORS-013`        | ✅     |
| AC-014 | Color contrast is validated                        | `APP-THEME-COLORS-014`        | ✅     |
| AC-015 | Color palette supports custom names                | `APP-THEME-COLORS-015`        | ✅     |
| AC-016 | User can complete full color workflow (regression) | `APP-THEME-COLORS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/theme/colors.ts`
- **E2E Spec**: `specs/app/theme/colors.spec.ts`

---

## US-APP-THEME-003: Typography Tokens

**As a** developer,
**I want to** configure typography settings,
**so that** text is readable and consistent.

### Configuration

```yaml
theme:
  fonts:
    sans: 'Inter, ui-sans-serif, system-ui, sans-serif'
    serif: 'Merriweather, ui-serif, Georgia, serif'
    mono: 'Fira Code, ui-monospace, monospace'
    display: 'Playfair Display, serif'
  fontSizes:
    xs: '0.75rem'
    sm: '0.875rem'
    base: '1rem'
    lg: '1.125rem'
    xl: '1.25rem'
    2xl: '1.5rem'
    3xl: '1.875rem'
    4xl: '2.25rem'
  lineHeights:
    tight: '1.25'
    normal: '1.5'
    relaxed: '1.75'
  fontWeights:
    normal: '400'
    medium: '500'
    semibold: '600'
    bold: '700'
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                     | Status |
| ------ | ------------------------------------------------------- | ---------------------------- | ------ |
| AC-001 | Sans-serif font family is applied                       | `APP-THEME-FONTS-001`        | ✅     |
| AC-002 | Serif font family is available                          | `APP-THEME-FONTS-002`        | ✅     |
| AC-003 | Monospace font is used for code                         | `APP-THEME-FONTS-003`        | ✅     |
| AC-004 | Custom font families are supported                      | `APP-THEME-FONTS-004`        | ✅     |
| AC-005 | Font sizes generate utility classes                     | `APP-THEME-FONTS-005`        | ✅     |
| AC-006 | Line heights are applied correctly                      | `APP-THEME-FONTS-006`        | ✅     |
| AC-007 | Font weights are available                              | `APP-THEME-FONTS-007`        | ✅     |
| AC-008 | Display font is used for headings                       | `APP-THEME-FONTS-008`        | ✅     |
| AC-009 | Invalid font family returns error                       | `APP-THEME-FONTS-009`        | ✅     |
| AC-010 | Fonts generate CSS variables                            | `APP-THEME-FONTS-010`        | ✅     |
| AC-011 | System font stack fallbacks work                        | `APP-THEME-FONTS-011`        | ✅     |
| AC-012 | Google Fonts integration is supported                   | `APP-THEME-FONTS-012`        | ✅     |
| AC-013 | User can complete full typography workflow (regression) | `APP-THEME-FONTS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/theme/fonts.ts`
- **E2E Spec**: `specs/app/theme/fonts.spec.ts`

---

## US-APP-THEME-004: Spacing Tokens

**As a** developer,
**I want to** define spacing values,
**so that** layout is consistent throughout the application.

### Configuration

```yaml
theme:
  spacing:
    px: '1px'
    0: '0'
    0.5: '0.125rem'
    1: '0.25rem'
    2: '0.5rem'
    3: '0.75rem'
    4: '1rem'
    5: '1.25rem'
    6: '1.5rem'
    8: '2rem'
    10: '2.5rem'
    12: '3rem'
    16: '4rem'
    20: '5rem'
    24: '6rem'
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                       | Status |
| ------ | ---------------------------------------------------- | ------------------------------ | ------ |
| AC-001 | Spacing values are applied to padding                | `APP-THEME-SPACING-001`        | ✅     |
| AC-002 | Spacing values are applied to margin                 | `APP-THEME-SPACING-002`        | ✅     |
| AC-003 | Spacing values are applied to gap                    | `APP-THEME-SPACING-003`        | ✅     |
| AC-004 | Custom spacing values are supported                  | `APP-THEME-SPACING-004`        | ✅     |
| AC-005 | Spacing generates utility classes                    | `APP-THEME-SPACING-005`        | ✅     |
| AC-006 | Pixel spacing values work correctly                  | `APP-THEME-SPACING-006`        | ✅     |
| AC-007 | Rem spacing values work correctly                    | `APP-THEME-SPACING-007`        | ✅     |
| AC-008 | Zero spacing removes space                           | `APP-THEME-SPACING-008`        | ✅     |
| AC-009 | Negative spacing values are supported                | `APP-THEME-SPACING-009`        | ✅     |
| AC-010 | Invalid spacing format returns error                 | `APP-THEME-SPACING-010`        | ✅     |
| AC-011 | Spacing generates CSS variables                      | `APP-THEME-SPACING-011`        | ✅     |
| AC-012 | Fractional spacing values work                       | `APP-THEME-SPACING-012`        | ✅     |
| AC-013 | Spacing scale is consistent                          | `APP-THEME-SPACING-013`        | ✅     |
| AC-014 | User can complete full spacing workflow (regression) | `APP-THEME-SPACING-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/theme/spacing.ts`
- **E2E Spec**: `specs/app/theme/spacing.spec.ts`

---

## US-APP-THEME-005: Shadow Tokens

**As a** developer,
**I want to** define shadow values,
**so that** elevation and depth are consistent.

### Configuration

```yaml
theme:
  shadows:
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
    default: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
    2xl: '0 25px 50px -12px rgb(0 0 0 / 0.25)'
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)'
    none: 'none'
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                       | Status |
| ------ | ---------------------------------------------------- | ------------------------------ | ------ |
| AC-001 | Small shadow is applied correctly                    | `APP-THEME-SHADOWS-001`        | ✅     |
| AC-002 | Default shadow is applied correctly                  | `APP-THEME-SHADOWS-002`        | ✅     |
| AC-003 | Medium shadow is applied correctly                   | `APP-THEME-SHADOWS-003`        | ✅     |
| AC-004 | Large shadow is applied correctly                    | `APP-THEME-SHADOWS-004`        | ✅     |
| AC-005 | Extra large shadow is applied                        | `APP-THEME-SHADOWS-005`        | ✅     |
| AC-006 | Inner shadow is applied correctly                    | `APP-THEME-SHADOWS-006`        | ✅     |
| AC-007 | No shadow removes box-shadow                         | `APP-THEME-SHADOWS-007`        | ✅     |
| AC-008 | Custom shadow values are supported                   | `APP-THEME-SHADOWS-008`        | ✅     |
| AC-009 | Shadow generates utility classes                     | `APP-THEME-SHADOWS-009`        | ✅     |
| AC-010 | Shadows support RGB color format                     | `APP-THEME-SHADOWS-010`        | ✅     |
| AC-011 | Shadows support multiple layers                      | `APP-THEME-SHADOWS-011`        | ✅     |
| AC-012 | Invalid shadow format returns error                  | `APP-THEME-SHADOWS-012`        | ✅     |
| AC-013 | Shadows generate CSS variables                       | `APP-THEME-SHADOWS-013`        | ✅     |
| AC-014 | Dark mode shadows are defined                        | `APP-THEME-SHADOWS-014`        | ✅     |
| AC-015 | Colored shadows are supported                        | `APP-THEME-SHADOWS-015`        | ✅     |
| AC-016 | Shadow hover states work                             | `APP-THEME-SHADOWS-016`        | ✅     |
| AC-017 | User can complete full shadows workflow (regression) | `APP-THEME-SHADOWS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/theme/shadows.ts`
- **E2E Spec**: `specs/app/theme/shadows.spec.ts`

---

## US-APP-THEME-006: Border Radius Tokens

**As a** developer,
**I want to** define border radius values,
**so that** corners are consistent throughout the application.

### Configuration

```yaml
theme:
  borderRadius:
    none: '0'
    sm: '0.125rem'
    default: '0.25rem'
    md: '0.375rem'
    lg: '0.5rem'
    xl: '0.75rem'
    2xl: '1rem'
    3xl: '1.5rem'
    full: '9999px'
```

### Acceptance Criteria

| ID     | Criterion                                                  | E2E Spec                      | Status |
| ------ | ---------------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | No radius removes rounding                                 | `APP-THEME-RADIUS-001`        | ✅     |
| AC-002 | Small radius is applied correctly                          | `APP-THEME-RADIUS-002`        | ✅     |
| AC-003 | Default radius is applied correctly                        | `APP-THEME-RADIUS-003`        | ✅     |
| AC-004 | Medium radius is applied correctly                         | `APP-THEME-RADIUS-004`        | ✅     |
| AC-005 | Large radius is applied correctly                          | `APP-THEME-RADIUS-005`        | ✅     |
| AC-006 | Full radius creates circles                                | `APP-THEME-RADIUS-006`        | ✅     |
| AC-007 | Custom radius values are supported                         | `APP-THEME-RADIUS-007`        | ✅     |
| AC-008 | Radius generates utility classes                           | `APP-THEME-RADIUS-008`        | ✅     |
| AC-009 | Radius supports rem values                                 | `APP-THEME-RADIUS-009`        | ✅     |
| AC-010 | Radius supports pixel values                               | `APP-THEME-RADIUS-010`        | ✅     |
| AC-011 | Invalid radius format returns error                        | `APP-THEME-RADIUS-011`        | ✅     |
| AC-012 | Radius generates CSS variables                             | `APP-THEME-RADIUS-012`        | ✅     |
| AC-013 | Per-corner radius is supported                             | `APP-THEME-RADIUS-013`        | ✅     |
| AC-014 | Radius scale is consistent                                 | `APP-THEME-RADIUS-014`        | ✅     |
| AC-015 | User can complete full border radius workflow (regression) | `APP-THEME-RADIUS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/theme/border-radius.ts`
- **E2E Spec**: `specs/app/theme/border-radius.spec.ts`

---

## Regression Tests

| Spec ID                        | Workflow                                 | Status |
| ------------------------------ | ---------------------------------------- | ------ |
| `APP-THEME-REGRESSION`         | Developer configures complete theme      | `[x]`  |
| `APP-THEME-COLORS-REGRESSION`  | Color palette is applied throughout app  | `[x]`  |
| `APP-THEME-FONTS-REGRESSION`   | Typography is consistent across pages    | `[x]`  |
| `APP-THEME-SPACING-REGRESSION` | Spacing creates consistent layouts       | `[x]`  |
| `APP-THEME-SHADOWS-REGRESSION` | Shadows provide visual depth             | `[x]`  |
| `APP-THEME-RADIUS-REGRESSION`  | Border radius creates consistent corners | `[x]`  |

---

## Coverage Summary

| User Story       | Title         | Spec Count            | Status   |
| ---------------- | ------------- | --------------------- | -------- |
| US-APP-THEME-001 | Theme Config  | 12                    | Complete |
| US-APP-THEME-002 | Colors        | 15                    | Complete |
| US-APP-THEME-003 | Typography    | 12                    | Complete |
| US-APP-THEME-004 | Spacing       | 13                    | Complete |
| US-APP-THEME-005 | Shadows       | 16                    | Complete |
| US-APP-THEME-006 | Border Radius | 14                    | Complete |
| **Total**        |               | **82 + 6 regression** |          |
