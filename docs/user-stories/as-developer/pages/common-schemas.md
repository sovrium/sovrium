# Common Page Schemas

> **Feature Area**: Pages - Common Schema Definitions
> **Schema**: `src/domain/models/app/pages/common/`
> **E2E Specs**: `specs/app/pages/common/`

---

## Overview

Sovrium provides common schema definitions shared across all page components. These include primitive type definitions, component props validation, responsive design overrides, and variable reference patterns for dynamic content.

---

## US-PAGES-COMMON-001: Primitive Definitions

**As a** developer,
**I want to** use validated primitive types for page configuration,
**so that** all page components use consistent patterns for strings, URLs, colors, and identifiers.

### Schema Types

```typescript
// Validated primitive types
type NonEmptyString = string // At least 1 character
type KebabCase = string // e.g., "my-page-slug"
type VariableName = string // e.g., "myVariable" (camelCase)
type VariableReference = string // e.g., "$myVariable"
type HexColor = string // e.g., "#FF5733" or "#F53"
type Url = string // Full URL with http/https
type RelativePath = string // e.g., "/about" or "./image.png"
type EmailAddress = string // Valid email format
type ClassName = string // CSS class name(s)
type IconName = 'home' | 'user' | 'settings' | ... // Enum of icons
type Dimensions = { width: number; height: number }
```

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec                           | Status |
| ------ | -------------------------------------------------------- | ---------------------------------- | ------ |
| AC-001 | Validates as nonEmptyString                              | `APP-PAGES-DEFINITIONS-001`        | ✅     |
| AC-002 | Validates as kebabCase pattern                           | `APP-PAGES-DEFINITIONS-002`        | ✅     |
| AC-003 | Validates as variableName pattern                        | `APP-PAGES-DEFINITIONS-003`        | ✅     |
| AC-004 | Validates as variableReference pattern                   | `APP-PAGES-DEFINITIONS-004`        | ✅     |
| AC-005 | Validates as hexColor pattern                            | `APP-PAGES-DEFINITIONS-005`        | ✅     |
| AC-006 | Validates as url with http/https protocol                | `APP-PAGES-DEFINITIONS-006`        | ✅     |
| AC-007 | Validates as relativePath pattern                        | `APP-PAGES-DEFINITIONS-007`        | ✅     |
| AC-008 | Validates as emailAddress format                         | `APP-PAGES-DEFINITIONS-008`        | ✅     |
| AC-009 | Validates as className                                   | `APP-PAGES-DEFINITIONS-009`        | ✅     |
| AC-010 | Validates as iconName enum                               | `APP-PAGES-DEFINITIONS-010`        | ✅     |
| AC-011 | Validates as dimensions object                           | `APP-PAGES-DEFINITIONS-011`        | ✅     |
| AC-012 | Provides comprehensive icon set for all UI needs         | `APP-PAGES-DEFINITIONS-012`        | ✅     |
| AC-013 | User can complete full definitions workflow (regression) | `APP-PAGES-DEFINITIONS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/pages/common/definitions.spec.ts`

---

## US-PAGES-COMMON-002: Component Props

**As a** developer,
**I want to** pass typed properties to page components,
**so that** components receive validated configuration with support for primitives, objects, arrays, and variable references.

### Configuration

```yaml
pages:
  - path: /dashboard
    components:
      - type: hero
        props:
          title: 'Welcome to $appName'
          subtitle: 'Your dashboard'
          showCta: true
          maxItems: 5
          settings:
            theme: 'dark'
            showBorder: true
          tags: ['featured', 'new']
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                     | Status |
| ------ | -------------------------------------------------- | ---------------------------- | ------ |
| AC-001 | Accepts string property                            | `APP-PAGES-PROPS-001`        | ✅     |
| AC-002 | Accepts numeric property                           | `APP-PAGES-PROPS-002`        | ✅     |
| AC-003 | Accepts boolean property                           | `APP-PAGES-PROPS-003`        | ✅     |
| AC-004 | Accepts nested object property                     | `APP-PAGES-PROPS-004`        | ✅     |
| AC-005 | Accepts array property                             | `APP-PAGES-PROPS-005`        | ✅     |
| AC-006 | Accepts string with $variable syntax               | `APP-PAGES-PROPS-006`        | ✅     |
| AC-007 | Supports mixed property types                      | `APP-PAGES-PROPS-007`        | ✅     |
| AC-008 | Validates camelCase naming convention              | `APP-PAGES-PROPS-008`        | ✅     |
| AC-009 | Supports multiple variable references across props | `APP-PAGES-PROPS-009`        | ✅     |
| AC-010 | Accepts empty object for components without props  | `APP-PAGES-PROPS-010`        | ✅     |
| AC-011 | User can complete full props workflow (regression) | `APP-PAGES-PROPS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/pages/common/props.spec.ts`

---

## US-PAGES-COMMON-003: Responsive Overrides

**As a** developer,
**I want to** define responsive behavior for page components,
**so that** I can customize layout, visibility, and props at different breakpoints.

### Configuration

```yaml
pages:
  - path: /home
    components:
      - type: navigation
        props:
          showSearch: false
        responsive:
          sm:
            props:
              showSearch: true
          md:
            className: 'nav-expanded'
          lg:
            children:
              - type: searchBar
                props:
                  expanded: true
          xl:
            hidden: false
```

### Acceptance Criteria

| ID     | Criterion                                                        | E2E Spec                          | Status |
| ------ | ---------------------------------------------------------------- | --------------------------------- | ------ |
| AC-001 | Applies mobile className and styles                              | `APP-PAGES-RESPONSIVE-001`        | ✅     |
| AC-002 | Content updates to match each breakpoint                         | `APP-PAGES-RESPONSIVE-002`        | ✅     |
| AC-003 | Component is hidden on mobile and shown on large screens         | `APP-PAGES-RESPONSIVE-003`        | ✅     |
| AC-004 | Renders different child components based on breakpoint           | `APP-PAGES-RESPONSIVE-004`        | ✅     |
| AC-005 | Applies sm-specific props                                        | `APP-PAGES-RESPONSIVE-005`        | ✅     |
| AC-006 | Applies md-specific props                                        | `APP-PAGES-RESPONSIVE-006`        | ✅     |
| AC-007 | Applies xl/2xl-specific props for very wide screens              | `APP-PAGES-RESPONSIVE-007`        | ✅     |
| AC-008 | Each breakpoint overrides the previous (progressive enhancement) | `APP-PAGES-RESPONSIVE-008`        | ✅     |
| AC-009 | All three override types apply simultaneously at each breakpoint | `APP-PAGES-RESPONSIVE-009`        | ✅     |
| AC-010 | Mobile shows hamburger menu, desktop shows full navigation links | `APP-PAGES-RESPONSIVE-010`        | ✅     |
| AC-011 | User can complete full responsive workflow (regression)          | `APP-PAGES-RESPONSIVE-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/pages/common/responsive.spec.ts`

---

## US-PAGES-COMMON-004: Variable References

**As a** developer,
**I want to** use variable references in page content,
**so that** I can dynamically inject values from app configuration and runtime context.

### Configuration

```yaml
# App-level variables
variables:
  appName: 'My Application'
  supportEmail: 'support@example.com'
  currentYear: 2025

# Using variables in pages
pages:
  - path: /about
    components:
      - type: heading
        props:
          title: 'Welcome to $appName'
          subtitle: 'Contact us at $supportEmail'
      - type: footer
        props:
          copyright: 'Copyright $currentYear $appName'
          links:
            - text: 'Email: $supportEmail'
              href: 'mailto:$supportEmail'
```

### Acceptance Criteria

| ID     | Criterion                                                       | E2E Spec                      | Status |
| ------ | --------------------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Validates variable syntax                                       | `APP-PAGES-VARREF-001`        | ✅     |
| AC-002 | Accepts camelCase variable names                                | `APP-PAGES-VARREF-002`        | ✅     |
| AC-003 | Accepts variable at start of string                             | `APP-PAGES-VARREF-003`        | ✅     |
| AC-004 | Accepts variable in middle of string                            | `APP-PAGES-VARREF-004`        | ✅     |
| AC-005 | Accepts variable at end of string                               | `APP-PAGES-VARREF-005`        | ✅     |
| AC-006 | Accepts multiple $variable references                           | `APP-PAGES-VARREF-006`        | ✅     |
| AC-007 | Accepts alphanumeric variable names                             | `APP-PAGES-VARREF-007`        | ✅     |
| AC-008 | Supports variable composition patterns                          | `APP-PAGES-VARREF-008`        | ✅     |
| AC-009 | User can complete full variable reference workflow (regression) | `APP-PAGES-VARREF-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/pages/common/variable-reference.spec.ts`

---

## Regression Tests

| Spec ID                            | Workflow                                 | Status |
| ---------------------------------- | ---------------------------------------- | ------ |
| `APP-PAGES-DEFINITIONS-REGRESSION` | Primitive definitions workflow completes | ⏳     |
| `APP-PAGES-PROPS-REGRESSION`       | Component props workflow completes       | ⏳     |
| `APP-PAGES-RESPONSIVE-REGRESSION`  | Responsive overrides workflow completes  | ⏳     |
| `APP-PAGES-VARREF-REGRESSION`      | Variable references workflow completes   | ⏳     |

---

## Coverage Summary

| User Story          | Title                 | Spec Count            | Status      |
| ------------------- | --------------------- | --------------------- | ----------- |
| US-PAGES-COMMON-001 | Primitive Definitions | 12                    | Not Started |
| US-PAGES-COMMON-002 | Component Props       | 10                    | Not Started |
| US-PAGES-COMMON-003 | Responsive Overrides  | 10                    | Not Started |
| US-PAGES-COMMON-004 | Variable References   | 8                     | Not Started |
| **Total**           |                       | **40 + 4 regression** |             |
