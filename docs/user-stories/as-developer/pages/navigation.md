# Navigation

> **Feature Area**: Pages - Navigation & Links
> **Schema**: `src/domain/models/app/page/sections.ts` (navigation component type)
> **E2E Specs**: Navigation is tested via page sections specs

---

## Overview

Sovrium supports navigation through section-based components. Navigation menus, call-to-action buttons, and links are defined as page sections using the component system. This approach provides full flexibility — navigation is composed from reusable components just like any other page content.

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
    sections:
      - type: navigation
        props:
          id: main-nav
        children:
          - type: link
            props:
              href: /
              className: nav-link
            content: Home
          - type: link
            props:
              href: /features
              className: nav-link
            content: Features
          - type: link
            props:
              href: /pricing
              className: nav-link
            content: Pricing
      - type: hero
        props:
          id: hero
          title: Welcome
```

### Acceptance Criteria

| ID     | Criterion                                        | E2E Spec                 | Status |
| ------ | ------------------------------------------------ | ------------------------ | ------ |
| AC-001 | Navigation section renders child link components | `APP-PAGES-SECTIONS-004` | ✅     |
| AC-002 | Navigation links navigate between pages          | `APP-PAGES-SECTIONS-004` | ✅     |

### Notes

Navigation is built using section components (`type: navigation`, `type: link`, etc.) rather than a dedicated layout configuration. This allows mixing navigation with any other section content and leveraging the full component system (responsive overrides, i18n, interactions).

### Implementation References

- **Schema**: `src/domain/models/app/page/sections.ts` (ComponentTypeSchema includes `navigation`, `nav`, `link`, `a`)

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
      - type: section
        props:
          id: cta
          className: text-center py-16
        children:
          - type: heading
            content: Get Started Today
          - type: paragraph
            content: Join thousands of users building amazing apps
          - type: flex
            props:
              className: gap-4 justify-center
            children:
              - type: button
                props:
                  className: bg-primary text-white px-6 py-3
                content: Sign Up Free
              - type: link
                props:
                  href: /features
                  className: border px-6 py-3
                content: Learn More
```

### Acceptance Criteria

| ID     | Criterion                                                  | E2E Spec                 | Status |
| ------ | ---------------------------------------------------------- | ------------------------ | ------ |
| AC-001 | CTA section renders heading, paragraph, and action buttons | `APP-PAGES-SECTIONS-006` | ✅     |

### Notes

CTA sections are composed from standard section components (heading, paragraph, button, link). No special CTA component type is needed — the flexibility of the section system handles any layout.

### Implementation References

- **Schema**: `src/domain/models/app/page/sections.ts` (section, heading, paragraph, button, link types)

---

## US-PAGES-NAV-003: Navigation Links

**As a** developer,
**I want to** configure navigation links with various behaviors,
**so that** I can create rich navigation experiences.

### Configuration

```yaml
components:
  - name: main-nav
    type: navigation
    props:
      className: flex items-center gap-8
    children:
      - type: link
        props:
          href: /docs
        content: $documentation
      - type: a
        props:
          href: https://github.com/sovrium
          target: _blank
          rel: noopener noreferrer
        content: GitHub
      - type: button
        props:
          className: bg-primary text-white px-4 py-2 rounded
        content: $ctaText

pages:
  - id: 1
    name: home
    path: /
    sections:
      - component: main-nav
```

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec                 | Status |
| ------ | -------------------------------------------------------- | ------------------------ | ------ |
| AC-001 | Link components support internal navigation (type: link) | `APP-PAGES-SECTIONS-004` | ✅     |
| AC-002 | Anchor components support external links (type: a)       | `APP-PAGES-SECTIONS-004` | ✅     |
| AC-003 | Component templates can be referenced in page sections   | `APP-PAGES-SECTIONS-004` | ✅     |

### Notes

Navigation links use standard `link` and `a` component types. External links use `a` with `target: _blank`. Reusable navigation is achieved through the component template system (`components` array + `component` reference in sections).

### Implementation References

- **Schema**: `src/domain/models/app/page/sections.ts` (link, a types), `src/domain/models/app/component/component.ts` (component templates)

---

## Coverage Summary

| User Story       | Title            | Status                                                    |
| ---------------- | ---------------- | --------------------------------------------------------- |
| US-PAGES-NAV-001 | Page Navigation  | Documented (section-based approach)                       |
| US-PAGES-NAV-002 | Call-to-Action   | Documented (composable from standard components)          |
| US-PAGES-NAV-003 | Navigation Links | Documented (link/a types + component template references) |
