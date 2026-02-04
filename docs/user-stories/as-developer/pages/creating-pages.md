# Creating Pages

> **Feature Area**: Pages - Core Configuration
> **Schema**: `src/domain/models/app/page/`
> **E2E Specs**: `specs/app/pages/`

---

## Overview

Pages in Sovrium are defined declaratively in the app schema. Each page has a unique ID, name, path (URL route), and sections containing content blocks. Pages support layouts, scripts, and configurable SEO metadata.

---

## US-PAGES-001: Define Pages Array

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

| ID     | Criterion                                    | E2E Spec        |
| ------ | -------------------------------------------- | --------------- |
| AC-001 | Pages array must contain at least one page   | `APP-PAGES-001` |
| AC-002 | Each page must have unique id within array   | `APP-PAGES-002` |
| AC-003 | Each page must have unique name within array | `APP-PAGES-003` |
| AC-004 | Each page must have unique path within array | `APP-PAGES-004` |
| AC-005 | Pages are rendered at their specified paths  | `APP-PAGES-005` |
| AC-006 | Empty pages array returns validation error   | `APP-PAGES-006` |
| AC-007 | Duplicate page IDs return validation error   | `APP-PAGES-007` |
| AC-008 | Duplicate page names return validation error | `APP-PAGES-008` |
| AC-009 | Duplicate page paths return validation error | `APP-PAGES-009` |

### Implementation References

- **Schema**: `src/domain/models/app/page/page.ts`
- **E2E Spec**: `specs/app/pages/pages.spec.ts`

---

## US-PAGES-002: Page Identifiers

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

| ID     | Criterion                                    | E2E Spec           |
| ------ | -------------------------------------------- | ------------------ |
| AC-001 | Page id must be positive integer             | `APP-PAGES-ID-001` |
| AC-002 | Page id must be unique across all pages      | `APP-PAGES-ID-002` |
| AC-003 | Page id 0 returns validation error           | `APP-PAGES-ID-003` |
| AC-004 | Negative page id returns validation error    | `APP-PAGES-ID-004` |
| AC-005 | Non-integer page id returns validation error | `APP-PAGES-ID-005` |
| AC-006 | Missing page id returns validation error     | `APP-PAGES-ID-006` |

### Implementation References

- **Schema**: `src/domain/models/app/page/page-id.ts`
- **E2E Spec**: `specs/app/pages/id.spec.ts`

---

## US-PAGES-003: Page Names

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

| ID     | Criterion                                         | E2E Spec             |
| ------ | ------------------------------------------------- | -------------------- |
| AC-001 | Page name must be non-empty string                | `APP-PAGES-NAME-001` |
| AC-002 | Page name must be unique across all pages         | `APP-PAGES-NAME-002` |
| AC-003 | Page name must be lowercase                       | `APP-PAGES-NAME-003` |
| AC-004 | Page name allows hyphens and underscores          | `APP-PAGES-NAME-004` |
| AC-005 | Page name with spaces returns validation error    | `APP-PAGES-NAME-005` |
| AC-006 | Page name with uppercase returns validation error | `APP-PAGES-NAME-006` |
| AC-007 | Empty page name returns validation error          | `APP-PAGES-NAME-007` |
| AC-008 | Missing page name returns validation error        | `APP-PAGES-NAME-008` |

### Implementation References

- **Schema**: `src/domain/models/app/page/page-name.ts`
- **E2E Spec**: `specs/app/pages/name.spec.ts`

---

## US-PAGES-004: Page Paths (Routing)

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

| ID     | Criterion                                          | E2E Spec             |
| ------ | -------------------------------------------------- | -------------------- |
| AC-001 | Page path must start with /                        | `APP-PAGES-PATH-001` |
| AC-002 | Page path must be unique across all pages          | `APP-PAGES-PATH-002` |
| AC-003 | Root path / is valid                               | `APP-PAGES-PATH-003` |
| AC-004 | Static paths like /about are valid                 | `APP-PAGES-PATH-004` |
| AC-005 | Dynamic parameters :param are supported            | `APP-PAGES-PATH-005` |
| AC-006 | Multiple path segments are supported               | `APP-PAGES-PATH-006` |
| AC-007 | Trailing slashes are normalized                    | `APP-PAGES-PATH-007` |
| AC-008 | Path without leading / returns validation error    | `APP-PAGES-PATH-008` |
| AC-009 | Empty path returns validation error                | `APP-PAGES-PATH-009` |
| AC-010 | Reserved path /404 renders as 404 error page       | `APP-PAGES-PATH-010` |
| AC-011 | Reserved path /500 renders as 500 error page       | `APP-PAGES-PATH-011` |
| AC-012 | Wildcard paths /\* are supported                   | `APP-PAGES-PATH-012` |
| AC-013 | Optional parameters :param? are supported          | `APP-PAGES-PATH-013` |
| AC-014 | Path parameters are accessible in page context     | `APP-PAGES-PATH-014` |
| AC-015 | Query parameters are accessible in page context    | `APP-PAGES-PATH-015` |
| AC-016 | Hash fragments are preserved in navigation         | `APP-PAGES-PATH-016` |
| AC-017 | Path encoding handles special characters           | `APP-PAGES-PATH-017` |
| AC-018 | Duplicate dynamic segments return validation error | `APP-PAGES-PATH-018` |
| AC-019 | Missing path returns validation error              | `APP-PAGES-PATH-019` |

### Implementation References

- **Schema**: `src/domain/models/app/page/page-path.ts`
- **E2E Spec**: `specs/app/pages/path.spec.ts`

---

## US-PAGES-005: Page Sections

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

| ID     | Criterion                                     | E2E Spec                 |
| ------ | --------------------------------------------- | ------------------------ |
| AC-001 | Sections array can be empty                   | `APP-PAGES-SECTIONS-001` |
| AC-002 | Each section must have a type                 | `APP-PAGES-SECTIONS-002` |
| AC-003 | Sections render in array order                | `APP-PAGES-SECTIONS-003` |
| AC-004 | Section type maps to registered component     | `APP-PAGES-SECTIONS-004` |
| AC-005 | Unknown section type returns validation error | `APP-PAGES-SECTIONS-005` |
| AC-006 | Section properties are passed to component    | `APP-PAGES-SECTIONS-006` |
| AC-007 | Sections support conditional rendering        | `APP-PAGES-SECTIONS-007` |
| AC-008 | Sections support dynamic data binding         | `APP-PAGES-SECTIONS-008` |
| AC-009 | Nested sections are supported                 | `APP-PAGES-SECTIONS-009` |
| AC-010 | Section id is auto-generated if not provided  | `APP-PAGES-SECTIONS-010` |
| AC-011 | Section className is applied to container     | `APP-PAGES-SECTIONS-011` |
| AC-012 | Section visibility can be toggled             | `APP-PAGES-SECTIONS-012` |
| AC-013 | Missing sections defaults to empty array      | `APP-PAGES-SECTIONS-013` |

### Implementation References

- **Schema**: `src/domain/models/app/page/page-sections.ts`
- **E2E Spec**: `specs/app/pages/sections.spec.ts`

---

## US-PAGES-006: Page Layout and Scripts

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

| ID     | Criterion                                         | E2E Spec        |
| ------ | ------------------------------------------------- | --------------- |
| AC-001 | Layout reference applies shared wrapper           | `APP-PAGES-010` |
| AC-002 | Invalid layout reference returns validation error | `APP-PAGES-011` |
| AC-003 | Scripts are injected into page HTML               | `APP-PAGES-012` |
| AC-004 | Script async attribute is respected               | `APP-PAGES-013` |
| AC-005 | Script defer attribute is respected               | `APP-PAGES-014` |
| AC-006 | Scripts load in specified order                   | `APP-PAGES-015` |
| AC-007 | External script URLs are validated                | `APP-PAGES-016` |
| AC-008 | Inline scripts are supported                      | `APP-PAGES-017` |

### Implementation References

- **Schema**: `src/domain/models/app/page/page.ts`
- **E2E Spec**: `specs/app/pages/pages.spec.ts`

---

## Regression Tests

| Spec ID                         | Workflow                                   | Status |
| ------------------------------- | ------------------------------------------ | ------ |
| `APP-PAGES-REGRESSION`          | Developer creates multi-page application   | `[x]`  |
| `APP-PAGES-ID-REGRESSION`       | Page identifier validation works correctly | `[x]`  |
| `APP-PAGES-NAME-REGRESSION`     | Page name validation works correctly       | `[x]`  |
| `APP-PAGES-PATH-REGRESSION`     | Page routing works correctly               | `[x]`  |
| `APP-PAGES-SECTIONS-REGRESSION` | Page sections render correctly             | `[x]`  |

---

## Coverage Summary

| User Story   | Title                   | Spec Count            | Status   |
| ------------ | ----------------------- | --------------------- | -------- |
| US-PAGES-001 | Define Pages Array      | 9                     | Complete |
| US-PAGES-002 | Page Identifiers        | 6                     | Complete |
| US-PAGES-003 | Page Names              | 8                     | Complete |
| US-PAGES-004 | Page Paths (Routing)    | 19                    | Complete |
| US-PAGES-005 | Page Sections           | 13                    | Complete |
| US-PAGES-006 | Page Layout and Scripts | 8                     | Complete |
| **Total**    |                         | **63 + 5 regression** |          |
