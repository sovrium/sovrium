# Icons (Lucide)

> **Feature Area**: Pages - Icon Rendering
> **Schema**: `src/domain/models/app/component/` (icon component type)
> **E2E Specs**: `specs/app/components/icon.spec.ts`

---

## Overview

Sovrium integrates the [Lucide](https://lucide.dev) open-source icon library to provide a comprehensive, consistent icon system. Icons are rendered as inline SVGs for sharp rendering at any size, accessibility compliance, and full theming support. Icons are used as a component type (`type: 'icon'`) within sections and component children, and support sizing, coloring, stroke width customization, Tailwind class styling, and accessibility attributes.

---

## US-PAGES-ICON-001: Render Icon by Name

**As a** developer,
**I want to** render an icon by specifying its Lucide name,
**so that** I can display recognizable icons throughout the application without bundling custom SVGs.

### Configuration

```yaml
components:
  - name: status-icon
    type: icon
    props:
      name: check-circle
```

### Acceptance Criteria

| ID     | Criterion                                                  | E2E Spec              | Status |
| ------ | ---------------------------------------------------------- | --------------------- | ------ |
| AC-001 | Icon renders as inline SVG with correct Lucide path data   | `APP-ICON-001`        | [ ]    |
| AC-002 | Icon name maps to the matching Lucide icon                 | `APP-ICON-002`        | [ ]    |
| AC-003 | Icon has data-testid="icon-{name}" for test selection      | `APP-ICON-003`        | [ ]    |
| AC-004 | User can use icons across various UI contexts (regression) | `APP-ICON-REGRESSION` | [ ]    |

### Implementation References

- **E2E Spec**: `specs/app/components/icon.spec.ts`

---

## US-PAGES-ICON-002: Icon Sizing

**As a** developer,
**I want to** control icon dimensions via a size prop,
**so that** icons scale appropriately for different UI contexts (inline text, buttons, hero sections).

### Configuration

```yaml
components:
  - name: large-icon
    type: icon
    props:
      name: star
      size: 32
  - name: small-icon
    type: icon
    props:
      name: star
      size: 16
```

### Acceptance Criteria

| ID     | Criterion                                      | E2E Spec       | Status |
| ------ | ---------------------------------------------- | -------------- | ------ |
| AC-001 | Icon respects size prop for width and height   | `APP-ICON-004` | [ ]    |
| AC-002 | Default size is 24px when size prop is omitted | `APP-ICON-005` | [ ]    |

### Implementation References

- **E2E Spec**: `specs/app/components/icon.spec.ts`

---

## US-PAGES-ICON-003: Icon Coloring

**As a** developer,
**I want to** set icon color via a color prop or inherit from parent text color,
**so that** icons visually integrate with surrounding content and theme tokens.

### Configuration

```yaml
components:
  - name: colored-icon
    type: icon
    props:
      name: heart
      color: '#e11d48'
  - name: themed-icon
    type: icon
    props:
      name: settings
      className: text-primary
```

### Acceptance Criteria

| ID     | Criterion                                                  | E2E Spec       | Status |
| ------ | ---------------------------------------------------------- | -------------- | ------ |
| AC-001 | Icon color prop sets the SVG stroke color                  | `APP-ICON-006` | [ ]    |
| AC-002 | Icon inherits currentColor when no color prop is specified | `APP-ICON-007` | [ ]    |
| AC-003 | Tailwind color classes applied via className prop work     | `APP-ICON-008` | [ ]    |

### Implementation References

- **E2E Spec**: `specs/app/components/icon.spec.ts`

---

## US-PAGES-ICON-004: Icon Stroke Width

**As a** developer,
**I want to** customize the icon stroke width,
**so that** I can match icon weight to the typography and design system.

### Configuration

```yaml
components:
  - name: thin-icon
    type: icon
    props:
      name: arrow-right
      strokeWidth: 1
  - name: bold-icon
    type: icon
    props:
      name: arrow-right
      strokeWidth: 3
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec       | Status |
| ------ | ---------------------------------------------------- | -------------- | ------ |
| AC-001 | strokeWidth prop controls SVG stroke-width attribute | `APP-ICON-009` | [ ]    |
| AC-002 | Default stroke width is 2 when omitted               | `APP-ICON-010` | [ ]    |

### Implementation References

- **E2E Spec**: `specs/app/components/icon.spec.ts`

---

## US-PAGES-ICON-005: Icon Accessibility

**As a** developer,
**I want to** ensure icons are accessible by default,
**so that** screen readers handle decorative and informative icons correctly.

### Configuration

```yaml
# Decorative icon (default - hidden from screen readers)
components:
  - name: decorative-icon
    type: icon
    props:
      name: chevron-right

  # Informative icon (announced to screen readers)
  - name: status-ok
    type: icon
    props:
      name: check-circle
      ariaLabel: Status OK
```

### Acceptance Criteria

| ID     | Criterion                                                    | E2E Spec       | Status |
| ------ | ------------------------------------------------------------ | -------------- | ------ |
| AC-001 | Icon without ariaLabel gets aria-hidden="true"               | `APP-ICON-011` | [ ]    |
| AC-002 | Icon with ariaLabel gets role="img" and aria-label attribute | `APP-ICON-012` | [ ]    |

### Implementation References

- **E2E Spec**: `specs/app/components/icon.spec.ts`

---

## US-PAGES-ICON-006: Icon in Component Composition

**As a** developer,
**I want to** use icons inside buttons, links, and flex containers,
**so that** I can build rich interactive elements with icon + text combinations.

### Configuration

```yaml
components:
  - name: icon-button
    type: button
    props:
      className: flex items-center gap-2
    children:
      - type: icon
        props:
          name: download
          size: 16
      - type: span
        content: Download
```

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec       | Status |
| ------ | --------------------------------------------------- | -------------- | ------ |
| AC-001 | Icon renders correctly as child of button component | `APP-ICON-013` | [ ]    |
| AC-002 | Icon renders correctly as child of link component   | `APP-ICON-014` | [ ]    |

### Implementation References

- **E2E Spec**: `specs/app/components/icon.spec.ts`

---

## US-PAGES-ICON-007: Icon with Component Templates ($ref/$vars)

**As a** developer,
**I want to** use variable substitution in icon props,
**so that** I can create reusable icon components where the icon name and styling are configurable per instance.

### Configuration

```yaml
components:
  - name: feature-item
    type: flex
    props:
      className: items-center gap-3
    children:
      - type: icon
        props:
          name: '$icon'
          color: '$iconColor'
          size: 20
      - type: span
        content: '$label'

pages:
  - name: home
    path: /
    sections:
      - component: feature-item
        vars:
          icon: zap
          iconColor: '#f59e0b'
          label: Lightning Fast
      - component: feature-item
        vars:
          icon: shield
          iconColor: '#10b981'
          label: Secure by Default
```

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec       | Status |
| ------ | -------------------------------------------------------- | -------------- | ------ |
| AC-001 | Icon name resolves from $variable in component template  | `APP-ICON-015` | [ ]    |
| AC-002 | Icon color resolves from $variable in component template | `APP-ICON-016` | [ ]    |

### Implementation References

- **E2E Spec**: `specs/app/components/icon.spec.ts`

---

## US-PAGES-ICON-008: Graceful Fallback for Unknown Icons

**As a** developer,
**I want to** see a graceful fallback when an invalid icon name is used,
**so that** the application does not crash and I can identify the issue easily.

### Configuration

```yaml
components:
  - name: mystery-icon
    type: icon
    props:
      name: nonexistent-icon-name
```

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec       | Status |
| ------ | ------------------------------------------------------ | -------------- | ------ |
| AC-001 | Unknown icon name does not crash the page              | `APP-ICON-017` | [ ]    |
| AC-002 | Unknown icon renders a fallback indicator or empty SVG | `APP-ICON-018` | [ ]    |

### Implementation References

- **E2E Spec**: `specs/app/components/icon.spec.ts`

---

## Regression Tests

| Spec ID               | Workflow                                        | Status |
| --------------------- | ----------------------------------------------- | ------ |
| `APP-ICON-REGRESSION` | Developer uses icons across various UI contexts | [ ]    |

---

## Coverage Summary

| User Story        | Title                               | Spec Count            | Status      |
| ----------------- | ----------------------------------- | --------------------- | ----------- |
| US-PAGES-ICON-001 | Render Icon by Name                 | 4                     | Not Started |
| US-PAGES-ICON-002 | Icon Sizing                         | 2                     | Not Started |
| US-PAGES-ICON-003 | Icon Coloring                       | 3                     | Not Started |
| US-PAGES-ICON-004 | Icon Stroke Width                   | 2                     | Not Started |
| US-PAGES-ICON-005 | Icon Accessibility                  | 2                     | Not Started |
| US-PAGES-ICON-006 | Icon in Component Composition       | 2                     | Not Started |
| US-PAGES-ICON-007 | Icon with Templates ($ref/$vars)    | 2                     | Not Started |
| US-PAGES-ICON-008 | Graceful Fallback for Unknown Icons | 2                     | Not Started |
| **Total**         |                                     | **19 + 1 regression** |             |
