# Theme Specification

> Design tokens for visual identity (colors, fonts, spacing, animations, shadows, breakpoints, border-radius)

## Overview

The Theme configuration provides a unified design system for Sovrium applications. It composes seven optional categories of design tokens, allowing minimal themes (colors-only) or comprehensive design systems.

**Vision Alignment**: Theme tokens enable consistent, configuration-driven visual identity across all app components without writing custom CSS.

## Schema Definition

**Location**: `src/domain/models/app/theme.ts`

```typescript
ThemeSchema = {
  colors?: ColorsConfigSchema,      // Visual identity
  fonts?: FontsConfigSchema,        // Typography system
  spacing?: SpacingConfigSchema,    // Layout rhythm
  animations?: AnimationsConfigSchema, // Motion design
  breakpoints?: BreakpointsConfigSchema, // Responsive thresholds
  shadows?: ShadowsConfigSchema,    // Elevation/depth
  borderRadius?: BorderRadiusConfigSchema, // Corner styling
}
```

| Property       | Type                              | Required | Description            |
| -------------- | --------------------------------- | -------- | ---------------------- |
| `colors`       | `Record<string, string>`          | No       | Color palette          |
| `fonts`        | `Record<string, FontConfig>`      | No       | Typography system      |
| `spacing`      | `Record<string, string>`          | No       | Layout tokens          |
| `animations`   | `Record<string, AnimationConfig>` | No       | Motion library         |
| `breakpoints`  | `Record<string, string>`          | No       | Responsive breakpoints |
| `shadows`      | `Record<string, string>`          | No       | Elevation system       |
| `borderRadius` | `Record<string, string>`          | No       | Corner radius tokens   |

---

## Sub-Schemas

### 1. Colors

**Location**: `src/domain/models/app/theme/colors.ts`

Design tokens for visual identity and branding.

#### Key Format

| Pattern                          | Description | Examples                            |
| -------------------------------- | ----------- | ----------------------------------- |
| `^[a-z]+[a-z0-9]*(-[a-z0-9]+)*$` | Kebab-case  | `primary`, `text-muted`, `gray-500` |

#### Value Formats

| Format      | Example                     | Alpha Support |
| ----------- | --------------------------- | ------------- |
| Hex 6-digit | `#007bff`                   | No            |
| Hex 8-digit | `#007bff80`                 | Yes (50%)     |
| RGB         | `rgb(0, 123, 255)`          | No            |
| RGBA        | `rgba(0, 123, 255, 0.5)`    | Yes           |
| HSL         | `hsl(210, 100%, 50%)`       | No            |
| HSLA        | `hsla(210, 100%, 50%, 0.8)` | Yes           |

#### Example

```yaml
theme:
  colors:
    primary: '#007bff'
    primary-hover: '#0056b3'
    primary-light: '#e7f1ff'
    secondary: '#6c757d'
    success: '#28a745'
    danger: '#dc3545'
    gray-100: '#f8f9fa'
    gray-500: '#adb5bd'
    gray-900: '#212529'
```

---

### 2. Fonts

**Location**: `src/domain/models/app/theme/fonts.ts`

Typography system with semantic font categories.

#### Font Category Key

| Pattern       | Description     | Examples                           |
| ------------- | --------------- | ---------------------------------- |
| `^[a-zA-Z]+$` | Alphabetic only | `body`, `title`, `mono`, `heading` |

#### Font Configuration

| Property        | Type                                                   | Required | Description                    |
| --------------- | ------------------------------------------------------ | -------- | ------------------------------ |
| `family`        | `string`                                               | Yes      | Primary font family name       |
| `fallback`      | `string`                                               | No       | Fallback font stack            |
| `weights`       | `number[]`                                             | No       | Available weights (100-900)    |
| `style`         | `'normal' \| 'italic' \| 'oblique'`                    | No       | Font style                     |
| `size`          | `string`                                               | No       | Default size (`16px`, `1rem`)  |
| `lineHeight`    | `string`                                               | No       | Line height (`1.5`, `24px`)    |
| `letterSpacing` | `string`                                               | No       | Letter spacing (`0`, `0.05em`) |
| `transform`     | `'none' \| 'uppercase' \| 'lowercase' \| 'capitalize'` | No       | Text transform                 |
| `url`           | `string`                                               | No       | Font file URL                  |

#### Example

```yaml
theme:
  fonts:
    body:
      family: 'Inter'
      fallback: 'system-ui, sans-serif'
      weights: [400, 500, 600, 700]
      size: '16px'
      lineHeight: '1.5'
    title:
      family: 'Playfair Display'
      fallback: 'Georgia, serif'
      weights: [400, 700]
      style: 'normal'
    mono:
      family: 'Fira Code'
      fallback: 'monospace'
      weights: [400, 500]
```

---

### 3. Spacing

**Location**: `src/domain/models/app/theme/spacing.ts`

Layout rhythm and whitespace tokens.

#### Token Categories

| Category  | Purpose                           | Examples                 |
| --------- | --------------------------------- | ------------------------ |
| Section   | Vertical rhythm for page sections | `py-16 sm:py-20`         |
| Container | Width constraints + centering     | `max-w-7xl mx-auto px-4` |
| Gap       | Space between flex/grid items     | `gap-6`                  |
| Padding   | Internal component spacing        | `p-6`, `p-4`             |
| Margin    | External component spacing        | `m-6`, `m-4`             |

#### Value Formats

- **Tailwind utilities**: `py-16`, `px-4`, `gap-6`
- **Responsive**: `py-16 sm:py-20 lg:py-24`
- **CSS values**: `4rem`, `16px`, `1.5em`

#### Example

```yaml
theme:
  spacing:
    section: 'py-16 sm:py-20'
    container: 'max-w-7xl mx-auto px-4'
    container-small: 'max-w-4xl mx-auto px-4'
    gap: 'gap-6'
    gap-small: 'gap-4'
    gap-large: 'gap-8'
    padding: 'p-6'
```

---

### 4. Shadows

**Location**: `src/domain/models/app/theme/shadows.ts`

Elevation and depth system.

#### Key Format

| Pattern                    | Description | Examples                         |
| -------------------------- | ----------- | -------------------------------- |
| `^[a-z0-9]+(-[a-z0-9]+)*$` | Kebab-case  | `sm`, `md`, `lg`, `2xl`, `inner` |

#### Value Format

CSS `box-shadow` syntax:

- `offset-x offset-y blur-radius spread-radius color`
- Example: `0 4px 6px -1px rgb(0 0 0 / 0.1)`

#### Example

```yaml
theme:
  shadows:
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)'
    none: '0 0 #0000'
```

---

### 5. Breakpoints

**Location**: `src/domain/models/app/theme/breakpoints.ts`

Responsive design thresholds.

#### Example

```yaml
theme:
  breakpoints:
    sm: '640px'
    md: '768px'
    lg: '1024px'
    xl: '1280px'
    2xl: '1536px'
```

---

### 6. Animations

**Location**: `src/domain/models/app/theme/animations.ts`

Motion design library.

#### Example

```yaml
theme:
  animations:
    fadeIn:
      enabled: true
      duration: '300ms'
      easing: 'ease-in-out'
    slideUp:
      enabled: true
      duration: '200ms'
```

---

### 7. Border Radius

**Location**: `src/domain/models/app/theme/border-radius.ts`

Corner styling tokens.

#### Example

```yaml
theme:
  borderRadius:
    none: '0'
    sm: '0.125rem'
    md: '0.375rem'
    lg: '0.5rem'
    xl: '0.75rem'
    full: '9999px'
```

---

## E2E Test Coverage

| Spec File                               | Tests | Status  | Description               |
| --------------------------------------- | ----- | ------- | ------------------------- |
| `specs/app/theme/theme.spec.ts`         | ~5    | 🟢 100% | Root theme validation     |
| `specs/app/theme/colors.spec.ts`        | ~10   | 🟢 100% | Color palette validation  |
| `specs/app/theme/fonts.spec.ts`         | ~8    | 🟢 100% | Typography validation     |
| `specs/app/theme/spacing.spec.ts`       | ~6    | 🟢 100% | Spacing tokens validation |
| `specs/app/theme/shadows.spec.ts`       | ~5    | 🟢 100% | Shadow validation         |
| `specs/app/theme/breakpoints.spec.ts`   | ~5    | 🟢 100% | Breakpoint validation     |
| `specs/app/theme/animations.spec.ts`    | ~5    | 🟢 100% | Animation validation      |
| `specs/app/theme/border-radius.spec.ts` | ~5    | 🟢 100% | Border radius validation  |

**Total**: 8 spec files, ~49 tests

---

## Implementation Status

**Overall**: 🟢 100%

All seven sub-schemas are fully implemented with:

- ✅ Effect Schema validation
- ✅ TypeScript type inference
- ✅ CSS compiler integration
- ✅ Comprehensive E2E tests

---

## Use Cases

### Example 1: Minimal Theme (Colors Only)

```yaml
theme:
  colors:
    primary: '#007bff'
    secondary: '#6c757d'
```

### Example 2: Complete Design System

```yaml
theme:
  colors:
    primary: '#007bff'
    primary-hover: '#0056b3'
    secondary: '#6c757d'
    success: '#28a745'
    danger: '#dc3545'
  fonts:
    body:
      family: 'Inter'
      fallback: 'system-ui, sans-serif'
      weights: [400, 500, 600, 700]
    title:
      family: 'Playfair Display'
      fallback: 'Georgia, serif'
  spacing:
    section: 'py-16 sm:py-20'
    container: 'max-w-7xl mx-auto px-4'
    gap: 'gap-6'
  shadows:
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
  breakpoints:
    md: '768px'
    lg: '1024px'
  borderRadius:
    md: '0.375rem'
    lg: '0.5rem'
```

### Example 3: Dark Mode Theme

```yaml
theme:
  colors:
    background: '#1a1a2e'
    surface: '#16213e'
    text: '#e4e4e7'
    text-muted: '#a1a1aa'
    primary: '#60a5fa'
    primary-hover: '#3b82f6'
```

---

## Related Features

- [App Schema](./app-schema.md) - Root configuration
- [Pages](./pages.md) - UI that uses theme tokens
- [Blocks](./blocks.md) - Components that use theme tokens

## Related Documentation

- [Tailwind CSS](../infrastructure/ui/tailwind.md) - CSS framework integration
- [CSS Compiler](../infrastructure/css/css-compiler.md) - How themes compile to CSS
- [Theming Architecture](../architecture/patterns/theming-architecture.md) - Architecture patterns
