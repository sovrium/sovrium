# Creating Pages

> **Feature Area**: Pages - Core Configuration
> **Schema**: `src/domain/models/app/page/`
> **E2E Specs**: `specs/app/pages/`

---

## Overview

Pages in Sovrium are defined declaratively in the app schema. Each page has a unique ID, name, path (URL route), and sections containing content blocks. Pages support layouts, scripts, and configurable SEO metadata.

---

## US-PAGES-DEFINITION-001: Define Pages Array

**As a** developer,
**I want to** define an array of pages in my app schema,
**so that** my application has multiple routes with distinct content.

### Configuration

```yaml
pages:
  - id: 1
    name: home
    path: /
    sections:
      - type: hero
        title: Welcome to My App
  - id: 2
    name: about
    path: /about
    sections:
      - type: content
        body: About us content here
  - id: 3
    name: contact
    path: /contact
    sections:
      - type: form
        formId: contact-form
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec               | Status |
| ------ | -------------------------------------------------- | ---------------------- | ------ |
| AC-001 | Pages array must contain at least one page         | `APP-PAGES-001`        | ✅     |
| AC-002 | Each page must have unique id within array         | `APP-PAGES-002`        | ✅     |
| AC-003 | Each page must have unique name within array       | `APP-PAGES-003`        | ✅     |
| AC-004 | Each page must have unique path within array       | `APP-PAGES-004`        | ✅     |
| AC-005 | Pages are rendered at their specified paths        | `APP-PAGES-005`        | ✅     |
| AC-006 | Empty pages array returns validation error         | `APP-PAGES-006`        | ✅     |
| AC-007 | Duplicate page IDs return validation error         | `APP-PAGES-007`        | ✅     |
| AC-008 | Duplicate page names return validation error       | `APP-PAGES-008`        | ✅     |
| AC-009 | Duplicate page paths return validation error       | `APP-PAGES-009`        | ✅     |
| AC-010 | User can complete full pages workflow (regression) | `APP-PAGES-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/pages/pages.spec.ts`

---

## US-PAGES-DEFINITION-002: Page Identifiers

**As a** developer,
**I want to** assign unique identifiers to each page,
**so that** pages can be referenced reliably in navigation and links.

### Configuration

```yaml
pages:
  - id: 1 # Numeric identifier (required, unique)
    name: home # String identifier (required, unique, lowercase)
    path: /
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                  | Status |
| ------ | ---------------------------------------------------- | ------------------------- | ------ |
| AC-001 | Page id must be positive integer                     | `APP-PAGES-ID-001`        | ✅     |
| AC-002 | Page id must be unique across all pages              | `APP-PAGES-ID-002`        | ✅     |
| AC-003 | Page id 0 returns validation error                   | `APP-PAGES-ID-003`        | ✅     |
| AC-004 | Negative page id returns validation error            | `APP-PAGES-ID-004`        | ✅     |
| AC-005 | Non-integer page id returns validation error         | `APP-PAGES-ID-005`        | ✅     |
| AC-006 | Missing page id returns validation error             | `APP-PAGES-ID-006`        | ✅     |
| AC-007 | User can complete full page ID workflow (regression) | `APP-PAGES-ID-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/pages/id.spec.ts`

---

## US-PAGES-DEFINITION-003: Page Names

**As a** developer,
**I want to** assign human-readable names to pages,
**so that** pages can be identified in navigation and internal references.

### Configuration

```yaml
pages:
  - id: 1
    name: home-page # lowercase, hyphens allowed
    path: /
  - id: 2
    name: about-us
    path: /about
```

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                    | Status |
| ------ | ------------------------------------------------------ | --------------------------- | ------ |
| AC-001 | Page name must be non-empty string                     | `APP-PAGES-NAME-001`        | ✅     |
| AC-002 | Page name must be unique across all pages              | `APP-PAGES-NAME-002`        | ✅     |
| AC-003 | Page name must be lowercase                            | `APP-PAGES-NAME-003`        | ✅     |
| AC-004 | Page name allows hyphens and underscores               | `APP-PAGES-NAME-004`        | ✅     |
| AC-005 | Page name with spaces returns validation error         | `APP-PAGES-NAME-005`        | ✅     |
| AC-006 | Page name with uppercase returns validation error      | `APP-PAGES-NAME-006`        | ✅     |
| AC-007 | Empty page name returns validation error               | `APP-PAGES-NAME-007`        | ✅     |
| AC-008 | Missing page name returns validation error             | `APP-PAGES-NAME-008`        | ✅     |
| AC-009 | User can complete full page name workflow (regression) | `APP-PAGES-NAME-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/pages/name.spec.ts`

---

## US-PAGES-DEFINITION-004: Page Paths (Routing)

**As a** developer,
**I want to** define URL paths for each page,
**so that** users can navigate to pages via their browser.

### Configuration

```yaml
pages:
  - id: 1
    name: home
    path: / # Root path
  - id: 2
    name: about
    path: /about # Static path
  - id: 3
    name: blog-post
    path: /blog/:slug # Dynamic parameter
  - id: 4
    name: user-profile
    path: /users/:id/profile # Multiple segments
  - id: 5
    name: not-found
    path: /404 # Error page
  - id: 6
    name: server-error
    path: /500 # Server error page
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                    | Status |
| ------ | -------------------------------------------------- | --------------------------- | ------ |
| AC-001 | Page path must start with /                        | `APP-PAGES-PATH-001`        | ✅     |
| AC-002 | Page path must be unique across all pages          | `APP-PAGES-PATH-002`        | ✅     |
| AC-003 | Root path / is valid                               | `APP-PAGES-PATH-003`        | ✅     |
| AC-004 | Static paths like /about are valid                 | `APP-PAGES-PATH-004`        | ✅     |
| AC-005 | Dynamic parameters :param are supported            | `APP-PAGES-PATH-005`        | ✅     |
| AC-006 | Multiple path segments are supported               | `APP-PAGES-PATH-006`        | ✅     |
| AC-007 | Trailing slashes are normalized                    | `APP-PAGES-PATH-007`        | ✅     |
| AC-008 | Path without leading / returns validation error    | `APP-PAGES-PATH-008`        | ✅     |
| AC-009 | Empty path returns validation error                | `APP-PAGES-PATH-009`        | ✅     |
| AC-010 | Reserved path /404 renders as 404 error page       | `APP-PAGES-PATH-010`        | ✅     |
| AC-011 | Reserved path /500 renders as 500 error page       | `APP-PAGES-PATH-011`        | ✅     |
| AC-012 | Wildcard paths /\* are supported                   | `APP-PAGES-PATH-012`        | ✅     |
| AC-013 | Optional parameters :param? are supported          | `APP-PAGES-PATH-013`        | ✅     |
| AC-014 | Path parameters are accessible in page context     | `APP-PAGES-PATH-014`        | ✅     |
| AC-015 | Query parameters are accessible in page context    | `APP-PAGES-PATH-015`        | ✅     |
| AC-016 | Hash fragments are preserved in navigation         | `APP-PAGES-PATH-016`        | ✅     |
| AC-017 | Path encoding handles special characters           | `APP-PAGES-PATH-017`        | ✅     |
| AC-018 | Duplicate dynamic segments return validation error | `APP-PAGES-PATH-018`        | ✅     |
| AC-019 | Missing path returns validation error              | `APP-PAGES-PATH-019`        | ✅     |
| AC-020 | User can complete full path workflow (regression)  | `APP-PAGES-PATH-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/pages/path.spec.ts`

---

## US-PAGES-DEFINITION-005: Page Sections

**As a** developer,
**I want to** define sections within each page,
**so that** I can compose page content from reusable components.

### Configuration

```yaml
pages:
  - id: 1
    name: home
    path: /
    sections:
      - type: hero
        title: Welcome
        subtitle: Build amazing apps
        cta:
          text: Get Started
          link: /signup
      - type: features
        items:
          - title: Fast
            icon: zap
          - title: Secure
            icon: shield
      - type: testimonials
        heading: What our users say
```

### Acceptance Criteria

| ID     | Criterion                                                  | E2E Spec                        | Status |
| ------ | ---------------------------------------------------------- | ------------------------------- | ------ |
| AC-001 | Sections array can be empty                                | `APP-PAGES-SECTIONS-001`        | ✅     |
| AC-002 | Each section must have a type                              | `APP-PAGES-SECTIONS-002`        | ✅     |
| AC-003 | Sections render in array order                             | `APP-PAGES-SECTIONS-003`        | ✅     |
| AC-004 | Section type maps to registered component                  | `APP-PAGES-SECTIONS-004`        | ✅     |
| AC-005 | Unknown section type returns validation error              | `APP-PAGES-SECTIONS-005`        | ✅     |
| AC-006 | Section properties are passed to component                 | `APP-PAGES-SECTIONS-006`        | ✅     |
| AC-007 | Sections support conditional rendering                     | `APP-PAGES-SECTIONS-007`        | ✅     |
| AC-008 | Sections support dynamic data binding                      | `APP-PAGES-SECTIONS-008`        | ✅     |
| AC-009 | Nested sections are supported                              | `APP-PAGES-SECTIONS-009`        | ✅     |
| AC-010 | Section id is auto-generated if not provided               | `APP-PAGES-SECTIONS-010`        | ✅     |
| AC-011 | Section className is applied to container                  | `APP-PAGES-SECTIONS-011`        | ✅     |
| AC-012 | Section visibility can be toggled                          | `APP-PAGES-SECTIONS-012`        | ✅     |
| AC-013 | Missing sections defaults to empty array                   | `APP-PAGES-SECTIONS-013`        | ✅     |
| AC-014 | User can complete full Page Sections workflow (regression) | `APP-PAGES-SECTIONS-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/pages/sections.spec.ts`

---

## US-PAGES-DEFINITION-006: Page Layout and Scripts

**As a** developer,
**I want to** configure layouts and custom scripts for pages,
**so that** I can share common structures and add page-specific functionality.

### Configuration

```yaml
pages:
  - id: 1
    name: home
    path: /
    layout: main # Use shared layout
    scripts:
      - src: /js/analytics.js
        async: true
      - src: /js/home-animations.js
        defer: true
    sections: []
```

### Acceptance Criteria

| ID     | Criterion                                         | E2E Spec        | Status |
| ------ | ------------------------------------------------- | --------------- | ------ |
| AC-001 | Layout reference applies shared wrapper           | `APP-PAGES-010` | ✅     |
| AC-002 | Invalid layout reference returns validation error | `APP-PAGES-011` | ✅     |
| AC-003 | Scripts are injected into page HTML               | `APP-PAGES-012` | ✅     |
| AC-004 | Script async attribute is respected               | `APP-PAGES-013` | ✅     |
| AC-005 | Script defer attribute is respected               | `APP-PAGES-014` | ✅     |
| AC-006 | Scripts load in specified order                   | `APP-PAGES-015` | ✅     |
| AC-007 | External script URLs are validated                | `APP-PAGES-016` | ✅     |
| AC-008 | Inline scripts are supported                      | `APP-PAGES-017` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/pages/pages.spec.ts`

---

## US-PAGES-DEFINITION-007: Page Layout Orchestration

**As a** developer,
**I want to** orchestrate global page layouts with navigation, header, footer, sidebar, and banner,
**so that** my application has consistent structure across all pages.

### Configuration

```yaml
layout:
  navigation: true
  header: true
  footer: true
  sidebar:
    position: left
    width: 280
    collapsible: true
  banner:
    enabled: true
    text: 'Welcome to our new site!'
```

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                      | Status |
| ------ | --------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Orchestrate global page layout                      | `APP-PAGES-LAYOUT-001`        | ✅     |
| AC-002 | Support minimal layout with navigation only         | `APP-PAGES-LAYOUT-002`        | ✅     |
| AC-003 | Provide header and footer structure                 | `APP-PAGES-LAYOUT-003`        | ✅     |
| AC-004 | Support sidebar-based layouts                       | `APP-PAGES-LAYOUT-004`        | ✅     |
| AC-005 | Display top banner above navigation                 | `APP-PAGES-LAYOUT-005`        | ✅     |
| AC-006 | Allow pages without global layout (blank page)      | `APP-PAGES-LAYOUT-006`        | ✅     |
| AC-007 | Enable cohesive visual design across layout         | `APP-PAGES-LAYOUT-007`        | ✅     |
| AC-008 | Override or extend default layout per page          | `APP-PAGES-LAYOUT-008`        | ✅     |
| AC-009 | User can complete full layout workflow (regression) | `APP-PAGES-LAYOUT-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/pages/layout/layout.spec.ts`

---

## US-PAGES-DEFINITION-008: Sidebar Navigation

**As a** developer,
**I want to** configure sidebar navigation with collapsible groups and nested items,
**so that** my application supports documentation and admin-style layouts.

### Configuration

```yaml
layout:
  sidebar:
    position: left # left | right
    width: 280
    collapsible: true
    defaultCollapsed: false
    sticky: true
    items:
      - type: link
        label: Dashboard
        href: /dashboard
      - type: group
        label: Settings
        items:
          - type: link
            label: Profile
            href: /settings/profile
      - type: separator
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                       | Status |
| ------ | ---------------------------------------------------- | ------------------------------ | ------ |
| AC-001 | Display sidebar navigation                           | `APP-PAGES-SIDEBAR-001`        | ✅     |
| AC-002 | Render sidebar on left side                          | `APP-PAGES-SIDEBAR-002`        | ✅     |
| AC-003 | Render sidebar on right side                         | `APP-PAGES-SIDEBAR-003`        | ✅     |
| AC-004 | Apply custom sidebar width                           | `APP-PAGES-SIDEBAR-004`        | ✅     |
| AC-005 | Allow users to collapse/expand sidebar               | `APP-PAGES-SIDEBAR-005`        | ✅     |
| AC-006 | Start in collapsed state                             | `APP-PAGES-SIDEBAR-006`        | ✅     |
| AC-007 | Stick during page scroll                             | `APP-PAGES-SIDEBAR-007`        | ✅     |
| AC-008 | Render clickable sidebar link                        | `APP-PAGES-SIDEBAR-008`        | ✅     |
| AC-009 | Render collapsible group with nested items           | `APP-PAGES-SIDEBAR-009`        | ✅     |
| AC-010 | Render visual separator between sections             | `APP-PAGES-SIDEBAR-010`        | ✅     |
| AC-011 | Support unlimited nesting for sidebar hierarchy      | `APP-PAGES-SIDEBAR-011`        | ✅     |
| AC-012 | Enable documentation and admin-style layouts         | `APP-PAGES-SIDEBAR-012`        | ✅     |
| AC-013 | User can complete full sidebar workflow (regression) | `APP-PAGES-SIDEBAR-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/layout/sidebar.ts`
- **E2E Spec**: `specs/app/pages/layout/sidebar.spec.ts`

---

## US-PAGES-DEFINITION-009: Page Footer

**As a** developer,
**I want to** configure a comprehensive footer with logo, links, social icons, and newsletter form,
**so that** my application has professional footer with all essential elements.

### Configuration

```yaml
layout:
  footer:
    enabled: true
    logo:
      src: /logo.svg
      alt: Company Logo
    description: 'Building amazing products since 2020'
    columns:
      - heading: Company
        links:
          - label: About
            href: /about
          - label: Careers
            href: /careers
    social:
      - platform: twitter
        url: https://twitter.com/company
      - platform: github
        url: https://github.com/company
    newsletter:
      heading: Subscribe
      placeholder: Enter your email
      buttonText: Subscribe
    copyright: '© 2025 Company. All rights reserved.'
    legal:
      - label: Privacy
        href: /privacy
      - label: Terms
        href: /terms
```

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                      | Status |
| ------ | --------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Display footer at bottom of page                    | `APP-PAGES-FOOTER-001`        | ✅     |
| AC-002 | Display footer logo                                 | `APP-PAGES-FOOTER-002`        | ✅     |
| AC-003 | Render company description                          | `APP-PAGES-FOOTER-003`        | ✅     |
| AC-004 | Render multi-column link layout                     | `APP-PAGES-FOOTER-004`        | ✅     |
| AC-005 | Render column heading and link list                 | `APP-PAGES-FOOTER-005`        | ✅     |
| AC-006 | Support external link targets                       | `APP-PAGES-FOOTER-006`        | ✅     |
| AC-007 | Render social media icons                           | `APP-PAGES-FOOTER-007`        | ✅     |
| AC-008 | Support 7 social platforms with auto icons          | `APP-PAGES-FOOTER-008`        | ✅     |
| AC-009 | Render email subscription form                      | `APP-PAGES-FOOTER-009`        | ✅     |
| AC-010 | Display copyright notice                            | `APP-PAGES-FOOTER-010`        | ✅     |
| AC-011 | Render legal link list                              | `APP-PAGES-FOOTER-011`        | ✅     |
| AC-012 | Not render footer when disabled                     | `APP-PAGES-FOOTER-012`        | ✅     |
| AC-013 | Render comprehensive footer layout                  | `APP-PAGES-FOOTER-013`        | ✅     |
| AC-014 | Override default platform icon                      | `APP-PAGES-FOOTER-014`        | ✅     |
| AC-015 | User can complete full footer workflow (regression) | `APP-PAGES-FOOTER-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/layout/footer.ts`
- **E2E Spec**: `specs/app/pages/layout/footer.spec.ts`

---

## US-PAGES-DEFINITION-010: Top Banner

**As a** developer,
**I want to** configure a dismissible announcement banner at the top of the page,
**so that** I can display important messages to users.

### Configuration

```yaml
layout:
  banner:
    enabled: true
    text: '🎉 New feature released!'
    link:
      href: /blog/new-feature
      target: _self
    background: 'linear-gradient(90deg, #4f46e5, #7c3aed)'
    textColor: '#ffffff'
    dismissible: true
    sticky: true
```

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                      | Status |
| ------ | --------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Display banner at top of page                       | `APP-PAGES-BANNER-001`        | ✅     |
| AC-002 | Render announcement text                            | `APP-PAGES-BANNER-002`        | ✅     |
| AC-003 | Add clickable link to banner                        | `APP-PAGES-BANNER-003`        | ✅     |
| AC-004 | Apply CSS gradient as background                    | `APP-PAGES-BANNER-004`        | ✅     |
| AC-005 | Apply solid background color                        | `APP-PAGES-BANNER-005`        | ✅     |
| AC-006 | Apply text color for contrast                       | `APP-PAGES-BANNER-006`        | ✅     |
| AC-007 | Allow users to close banner permanently             | `APP-PAGES-BANNER-007`        | ✅     |
| AC-008 | Remain at top during page scroll                    | `APP-PAGES-BANNER-008`        | ✅     |
| AC-009 | Not render banner when disabled                     | `APP-PAGES-BANNER-009`        | ✅     |
| AC-010 | Render emojis correctly                             | `APP-PAGES-BANNER-010`        | ✅     |
| AC-011 | User can complete full banner workflow (regression) | `APP-PAGES-BANNER-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/layout/banner.ts`
- **E2E Spec**: `specs/app/pages/layout/banner.spec.ts`

---

## Regression Tests

| Spec ID                         | Workflow                                   | Status |
| ------------------------------- | ------------------------------------------ | ------ |
| `APP-PAGES-REGRESSION`          | Developer creates multi-page application   | `[x]`  |
| `APP-PAGES-ID-REGRESSION`       | Page identifier validation works correctly | `[x]`  |
| `APP-PAGES-NAME-REGRESSION`     | Page name validation works correctly       | `[x]`  |
| `APP-PAGES-PATH-REGRESSION`     | Page routing works correctly               | `[x]`  |
| `APP-PAGES-SECTIONS-REGRESSION` | Page sections render correctly             | `[x]`  |
| `APP-PAGES-LAYOUT-REGRESSION`   | Layout orchestration works correctly       | ⏳     |
| `APP-PAGES-SIDEBAR-REGRESSION`  | Sidebar navigation works correctly         | ⏳     |
| `APP-PAGES-FOOTER-REGRESSION`   | Footer renders correctly                   | ⏳     |
| `APP-PAGES-BANNER-REGRESSION`   | Banner renders correctly                   | ⏳     |

---

## Coverage Summary

| User Story              | Title                     | Spec Count             | Status   |
| ----------------------- | ------------------------- | ---------------------- | -------- |
| US-PAGES-DEFINITION-001 | Define Pages Array        | 9                      | Complete |
| US-PAGES-DEFINITION-002 | Page Identifiers          | 6                      | Complete |
| US-PAGES-DEFINITION-003 | Page Names                | 8                      | Complete |
| US-PAGES-DEFINITION-004 | Page Paths (Routing)      | 19                     | Complete |
| US-PAGES-DEFINITION-005 | Page Sections             | 13                     | Complete |
| US-PAGES-DEFINITION-006 | Page Layout and Scripts   | 8                      | Complete |
| US-PAGES-DEFINITION-007 | Page Layout Orchestration | 8                      | Pending  |
| US-PAGES-DEFINITION-008 | Sidebar Navigation        | 12                     | Pending  |
| US-PAGES-DEFINITION-009 | Page Footer               | 14                     | Pending  |
| US-PAGES-DEFINITION-010 | Top Banner                | 10                     | Pending  |
| **Total**               |                           | **107 + 9 regression** |          |
