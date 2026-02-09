# Navigation

> **Feature Area**: Pages - Navigation & Links
> **Schema**: `src/domain/models/app/page/navigation/`
> **E2E Specs**: `specs/app/pages/navigation/`

---

## Overview

Sovrium provides a flexible navigation system for pages, including main navigation menus, call-to-action sections, and navigation links. Navigation can be customized with icons, styling, and responsive behavior.

---

## US-PAGES-NAV-001: Configure Page Navigation

**As a** developer,
**I want to** configure navigation menus for my pages,
**so that** users can easily navigate between different sections of my application.

### Configuration

```yaml
pages:
  - id: 1
    name: home
    path: /
    navigation:
      main:
        items:
          - label: Home
            path: /
            icon: home
          - label: Features
            path: /features
            icon: zap
          - label: Pricing
            path: /pricing
            icon: dollar-sign
          - label: Contact
            path: /contact
            icon: mail
      position: top # top | left | bottom
      sticky: true
      transparent: false
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                   | Status |
| ------ | ------------------------------------------------------- | -------------------------- | ------ |
| AC-001 | Navigation renders in specified position                | `APP-PAGES-NAV-001`        | ✅     |
| AC-002 | Navigation items display labels correctly               | `APP-PAGES-NAV-002`        | ✅     |
| AC-003 | Navigation items link to correct paths                  | `APP-PAGES-NAV-003`        | ✅     |
| AC-004 | Navigation supports icons for items                     | `APP-PAGES-NAV-004`        | ✅     |
| AC-005 | Sticky navigation stays fixed on scroll                 | `APP-PAGES-NAV-005`        | ✅     |
| AC-006 | Transparent navigation overlays content                 | `APP-PAGES-NAV-006`        | ✅     |
| AC-007 | Active navigation item is highlighted                   | `APP-PAGES-NAV-007`        | ✅     |
| AC-008 | Navigation respects responsive breakpoints              | `APP-PAGES-NAV-008`        | ✅     |
| AC-009 | Mobile navigation displays hamburger menu               | `APP-PAGES-NAV-009`        | ✅     |
| AC-010 | Navigation dropdown menus expand on hover/click         | `APP-PAGES-NAV-010`        | ✅     |
| AC-011 | Navigation supports nested menu items                   | `APP-PAGES-NAV-011`        | ✅     |
| AC-012 | Empty navigation array renders no menu                  | `APP-PAGES-NAV-012`        | ✅     |
| AC-013 | User can complete full navigation workflow (regression) | `APP-PAGES-NAV-REGRESSION` | ✅     |

### Implementation References


---

## US-PAGES-NAV-002: Call-to-Action Sections

**As a** developer,
**I want to** add call-to-action (CTA) sections to pages,
**so that** users are guided towards key actions like sign-up or purchase.

### Configuration

```yaml
pages:
  - id: 1
    name: home
    path: /
    sections:
      - type: cta
        heading: Get Started Today
        subheading: Join thousands of users building amazing apps
        primaryButton:
          text: Sign Up Free
          link: /signup
          variant: primary
        secondaryButton:
          text: Learn More
          link: /features
          variant: outline
        background: gradient # solid | gradient | image
        alignment: center # left | center | right
```

### Acceptance Criteria

| ID     | Criterion                                        | E2E Spec                   | Status |
| ------ | ------------------------------------------------ | -------------------------- | ------ |
| AC-001 | CTA heading renders with correct text            | `APP-PAGES-CTA-001`        | ✅     |
| AC-002 | CTA subheading renders below heading             | `APP-PAGES-CTA-002`        | ✅     |
| AC-003 | Primary button displays with correct text        | `APP-PAGES-CTA-003`        | ✅     |
| AC-004 | Primary button links to correct path             | `APP-PAGES-CTA-004`        | ✅     |
| AC-005 | Secondary button displays with correct style     | `APP-PAGES-CTA-005`        | ✅     |
| AC-006 | CTA respects alignment setting                   | `APP-PAGES-CTA-006`        | ✅     |
| AC-007 | CTA background applies gradient correctly        | `APP-PAGES-CTA-007`        | ✅     |
| AC-008 | CTA background supports image                    | `APP-PAGES-CTA-008`        | ✅     |
| AC-009 | CTA buttons support variant styling              | `APP-PAGES-CTA-009`        | ✅     |
| AC-010 | CTA section is responsive on mobile              | `APP-PAGES-CTA-010`        | ✅     |
| AC-011 | User can complete full CTA workflow (regression) | `APP-PAGES-CTA-REGRESSION` | ✅     |

### Implementation References


---

## US-PAGES-NAV-003: Navigation Links

**As a** developer,
**I want to** configure navigation links with various behaviors,
**so that** I can create rich navigation experiences.

### Configuration

```yaml
pages:
  - id: 1
    name: home
    path: /
    navigation:
      links:
        - id: 1
          label: Documentation
          path: /docs
          target: _self # _self | _blank
          rel: '' # noopener, noreferrer
        - id: 2
          label: GitHub
          path: https://github.com/sovrium
          target: _blank
          rel: noopener noreferrer
          external: true
        - id: 3
          label: API Reference
          path: /api
          badge: New
          badgeColor: green
```

### Acceptance Criteria

| ID     | Criterion                                                     | E2E Spec                        | Status |
| ------ | ------------------------------------------------------------- | ------------------------------- | ------ |
| AC-001 | Navigation link renders with label                            | `APP-PAGES-NAVLINKS-001`        | ✅     |
| AC-002 | Navigation link navigates to internal path                    | `APP-PAGES-NAVLINKS-002`        | ✅     |
| AC-003 | External link opens in new tab                                | `APP-PAGES-NAVLINKS-003`        | ✅     |
| AC-004 | External link includes rel attributes                         | `APP-PAGES-NAVLINKS-004`        | ✅     |
| AC-005 | Navigation link displays badge when configured                | `APP-PAGES-NAVLINKS-005`        | ✅     |
| AC-006 | Badge color applies correctly                                 | `APP-PAGES-NAVLINKS-006`        | ✅     |
| AC-007 | Link IDs must be unique                                       | `APP-PAGES-NAVLINKS-007`        | ✅     |
| AC-008 | Missing path returns validation error                         | `APP-PAGES-NAVLINKS-008`        | ✅     |
| AC-009 | Empty label returns validation error                          | `APP-PAGES-NAVLINKS-009`        | ✅     |
| AC-010 | Links support keyboard navigation                             | `APP-PAGES-NAVLINKS-010`        | ✅     |
| AC-011 | User can complete full navigation links workflow (regression) | `APP-PAGES-NAVLINKS-REGRESSION` | ✅     |

### Implementation References


---

## Regression Tests

| Spec ID                         | Workflow                                      | Status |
| ------------------------------- | --------------------------------------------- | ------ |
| `APP-PAGES-NAV-REGRESSION`      | Developer configures complete navigation      | `[x]`  |
| `APP-PAGES-CTA-REGRESSION`      | Developer creates call-to-action sections     | `[x]`  |
| `APP-PAGES-NAVLINKS-REGRESSION` | Developer configures various navigation links | `[x]`  |

---

## Coverage Summary

| User Story       | Title            | Spec Count            | Status   |
| ---------------- | ---------------- | --------------------- | -------- |
| US-PAGES-NAV-001 | Page Navigation  | 12                    | Complete |
| US-PAGES-NAV-002 | Call-to-Action   | 10                    | Complete |
| US-PAGES-NAV-003 | Navigation Links | 10                    | Complete |
| **Total**        |                  | **32 + 3 regression** |          |
