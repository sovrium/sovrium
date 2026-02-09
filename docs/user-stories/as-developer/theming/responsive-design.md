# Responsive Design

> **Feature Area**: Theming - Breakpoints & Responsive Utilities
> **Schema**: `src/domain/models/app/theme/breakpoints/`
> **E2E Specs**: `specs/app/theme/breakpoints/`

---

## Overview

Sovrium supports responsive design through configurable breakpoints. Breakpoints define screen size thresholds where layouts can adapt. All theme tokens (spacing, typography, colors) can be customized per breakpoint for optimal display across devices.

---

## US-THEME-RESPONSIVE-001: Configure Breakpoints

**As a** developer,
**I want to** configure responsive breakpoints,
**so that** my application adapts to different screen sizes.

### Configuration

```yaml
theme:
  breakpoints:
    xs: '0px' # Mobile phones (portrait)
    sm: '640px' # Mobile phones (landscape)
    md: '768px' # Tablets
    lg: '1024px' # Laptops
    xl: '1280px' # Desktops
    2xl: '1536px' # Large screens
```

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec                           | Status |
| ------ | -------------------------------------------------------- | ---------------------------------- | ------ |
| AC-001 | Breakpoints generate media queries                       | `APP-THEME-BREAKPOINTS-001`        | ✅     |
| AC-002 | Mobile-first approach is default                         | `APP-THEME-BREAKPOINTS-002`        | ✅     |
| AC-003 | Custom breakpoint values are supported                   | `APP-THEME-BREAKPOINTS-003`        | ✅     |
| AC-004 | Breakpoints support pixel values                         | `APP-THEME-BREAKPOINTS-004`        | ✅     |
| AC-005 | Breakpoints support rem values                           | `APP-THEME-BREAKPOINTS-005`        | ✅     |
| AC-006 | Invalid breakpoint value returns error                   | `APP-THEME-BREAKPOINTS-006`        | ✅     |
| AC-007 | Breakpoints must be in ascending order                   | `APP-THEME-BREAKPOINTS-007`        | ✅     |
| AC-008 | Breakpoint prefixes work in utility classes              | `APP-THEME-BREAKPOINTS-008`        | ✅     |
| AC-009 | Container max-widths follow breakpoints                  | `APP-THEME-BREAKPOINTS-009`        | ✅     |
| AC-010 | User can complete full breakpoints workflow (regression) | `APP-THEME-BREAKPOINTS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/theme/breakpoints.ts`

---

## Regression Tests

| Spec ID                            | Workflow                                    | Status |
| ---------------------------------- | ------------------------------------------- | ------ |
| `APP-THEME-BREAKPOINTS-REGRESSION` | Developer configures responsive breakpoints | `[x]`  |

---

## Coverage Summary

| User Story              | Title       | Spec Count           | Status   |
| ----------------------- | ----------- | -------------------- | -------- |
| US-THEME-RESPONSIVE-001 | Breakpoints | 9                    | Complete |
| **Total**               |             | **9 + 1 regression** |          |
