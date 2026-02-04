# SEO & Metadata

> **Feature Area**: Pages - SEO & Social Sharing
> **Schema**: `src/domain/models/app/page/meta/`
> **E2E Specs**: `specs/app/pages/meta/`

---

## Overview

Sovrium provides comprehensive SEO and metadata configuration for pages, including basic meta tags, Open Graph for social sharing, Twitter Cards, structured data (JSON-LD), favicons, and performance hints like preloading. All metadata can be configured per-page or globally.

---

## US-META-001: Basic Page Metadata

**As a** developer,
**I want to** configure basic SEO metadata for pages,
**so that** search engines can properly index my content.

### Configuration

```yaml
pages:
  - id: 1
    name: home
    path: /
    meta:
      title: 'My App - Build Amazing Things'
      description: 'A powerful platform for building web applications'
      keywords:
        - web development
        - low-code
        - application builder
      canonical: https://myapp.com/
      robots: index, follow
      author: My Company
      viewport: 'width=device-width, initial-scale=1'
```

### Acceptance Criteria

| ID     | Criterion                               | E2E Spec             |
| ------ | --------------------------------------- | -------------------- |
| AC-001 | Title tag is rendered in HTML head      | `APP-PAGES-META-001` |
| AC-002 | Description meta tag is rendered        | `APP-PAGES-META-002` |
| AC-003 | Keywords meta tag is rendered           | `APP-PAGES-META-003` |
| AC-004 | Canonical URL is rendered as link tag   | `APP-PAGES-META-004` |
| AC-005 | Robots meta tag controls indexing       | `APP-PAGES-META-005` |
| AC-006 | Author meta tag is rendered             | `APP-PAGES-META-006` |
| AC-007 | Viewport meta tag is configurable       | `APP-PAGES-META-007` |
| AC-008 | Title supports template variables       | `APP-PAGES-META-008` |
| AC-009 | Description supports template variables | `APP-PAGES-META-009` |
| AC-010 | Missing title falls back to app name    | `APP-PAGES-META-010` |
| AC-011 | Meta tags can be overridden per page    | `APP-PAGES-META-011` |
| AC-012 | Empty meta values are not rendered      | `APP-PAGES-META-012` |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/meta.ts`
- **E2E Spec**: `specs/app/pages/meta/meta.spec.ts`

---

## US-META-002: Open Graph Metadata

**As a** developer,
**I want to** configure Open Graph tags for pages,
**so that** my content displays properly when shared on social media.

### Configuration

```yaml
pages:
  - id: 1
    name: home
    path: /
    meta:
      openGraph:
        title: 'My App - Build Amazing Things'
        description: 'A powerful platform for building web applications'
        type: website # website | article | product | profile
        url: https://myapp.com/
        image:
          url: https://myapp.com/og-image.png
          width: 1200
          height: 630
          alt: My App Preview
        siteName: My App
        locale: en_US
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec           |
| ------ | ----------------------------------------------------- | ------------------ |
| AC-001 | og:title meta tag is rendered                         | `APP-PAGES-OG-001` |
| AC-002 | og:description meta tag is rendered                   | `APP-PAGES-OG-002` |
| AC-003 | og:type meta tag is rendered                          | `APP-PAGES-OG-003` |
| AC-004 | og:url meta tag is rendered                           | `APP-PAGES-OG-004` |
| AC-005 | og:image meta tag is rendered                         | `APP-PAGES-OG-005` |
| AC-006 | og:image:width meta tag is rendered                   | `APP-PAGES-OG-006` |
| AC-007 | og:image:height meta tag is rendered                  | `APP-PAGES-OG-007` |
| AC-008 | og:image:alt meta tag is rendered                     | `APP-PAGES-OG-008` |
| AC-009 | og:site_name meta tag is rendered                     | `APP-PAGES-OG-009` |
| AC-010 | og:locale meta tag is rendered                        | `APP-PAGES-OG-010` |
| AC-011 | Missing og:title falls back to page title             | `APP-PAGES-OG-011` |
| AC-012 | Missing og:description falls back to meta description | `APP-PAGES-OG-012` |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/open-graph.ts`
- **E2E Spec**: `specs/app/pages/meta/social/open-graph.spec.ts`

---

## US-META-003: Twitter Card Metadata

**As a** developer,
**I want to** configure Twitter Card tags for pages,
**so that** my content displays properly when shared on Twitter/X.

### Configuration

```yaml
pages:
  - id: 1
    name: home
    path: /
    meta:
      twitterCard:
        card: summary_large_image # summary | summary_large_image | app | player
        site: '@myapp'
        creator: '@author'
        title: 'My App - Build Amazing Things'
        description: 'A powerful platform for building web applications'
        image: https://myapp.com/twitter-card.png
        imageAlt: My App Preview
```

### Acceptance Criteria

| ID     | Criterion                                        | E2E Spec                |
| ------ | ------------------------------------------------ | ----------------------- |
| AC-001 | twitter:card meta tag is rendered                | `APP-PAGES-TWITTER-001` |
| AC-002 | twitter:site meta tag is rendered                | `APP-PAGES-TWITTER-002` |
| AC-003 | twitter:creator meta tag is rendered             | `APP-PAGES-TWITTER-003` |
| AC-004 | twitter:title meta tag is rendered               | `APP-PAGES-TWITTER-004` |
| AC-005 | twitter:description meta tag is rendered         | `APP-PAGES-TWITTER-005` |
| AC-006 | twitter:image meta tag is rendered               | `APP-PAGES-TWITTER-006` |
| AC-007 | twitter:image:alt meta tag is rendered           | `APP-PAGES-TWITTER-007` |
| AC-008 | Default card type is summary_large_image         | `APP-PAGES-TWITTER-008` |
| AC-009 | Missing title falls back to og:title             | `APP-PAGES-TWITTER-009` |
| AC-010 | Missing description falls back to og:description | `APP-PAGES-TWITTER-010` |
| AC-011 | Missing image falls back to og:image             | `APP-PAGES-TWITTER-011` |
| AC-012 | Invalid card type returns validation error       | `APP-PAGES-TWITTER-012` |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/twitter-card.ts`
- **E2E Spec**: `specs/app/pages/meta/social/twitter-card.spec.ts`

---

## US-META-004: Structured Data (JSON-LD)

**As a** developer,
**I want to** add structured data to pages,
**so that** search engines can better understand my content.

### Configuration

```yaml
pages:
  - id: 1
    name: home
    path: /
    meta:
      structuredData:
        - type: Organization
          name: My Company
          url: https://myapp.com
          logo: https://myapp.com/logo.png
          sameAs:
            - https://twitter.com/myapp
            - https://github.com/myapp
        - type: WebSite
          name: My App
          url: https://myapp.com
          potentialAction:
            type: SearchAction
            target: https://myapp.com/search?q={search_term}
```

### Acceptance Criteria

| ID     | Criterion                                      | E2E Spec                       |
| ------ | ---------------------------------------------- | ------------------------------ |
| AC-001 | JSON-LD script tag is rendered in head         | `APP-PAGES-STRUCTUREDDATA-001` |
| AC-002 | Organization schema is valid JSON-LD           | `APP-PAGES-STRUCTUREDDATA-002` |
| AC-003 | WebSite schema is valid JSON-LD                | `APP-PAGES-STRUCTUREDDATA-003` |
| AC-004 | Multiple structured data objects are supported | `APP-PAGES-STRUCTUREDDATA-004` |
| AC-005 | Structured data supports custom properties     | `APP-PAGES-STRUCTUREDDATA-005` |
| AC-006 | Invalid schema type returns validation error   | `APP-PAGES-STRUCTUREDDATA-006` |
| AC-007 | @context is automatically added                | `APP-PAGES-STRUCTUREDDATA-007` |
| AC-008 | @type is set from type property                | `APP-PAGES-STRUCTUREDDATA-008` |
| AC-009 | Nested schemas are properly structured         | `APP-PAGES-STRUCTUREDDATA-009` |
| AC-010 | Structured data supports template variables    | `APP-PAGES-STRUCTUREDDATA-010` |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/structured-data.ts`
- **E2E Spec**: `specs/app/pages/meta/structured-data/structured-data.spec.ts`

---

## US-META-005: Favicons

**As a** developer,
**I want to** configure favicons for my application,
**so that** my brand is displayed in browser tabs and bookmarks.

### Configuration

```yaml
meta:
  favicons:
    icon: /favicon.ico
    icon16: /favicon-16x16.png
    icon32: /favicon-32x32.png
    apple: /apple-touch-icon.png
    manifest: /site.webmanifest
    maskIcon:
      href: /safari-pinned-tab.svg
      color: '#5bbad5'
    msApplication:
      tileColor: '#2b5797'
      tileImage: /mstile-144x144.png
```

### Acceptance Criteria

| ID     | Criterion                                    | E2E Spec                |
| ------ | -------------------------------------------- | ----------------------- |
| AC-001 | Standard favicon.ico link is rendered        | `APP-PAGES-FAVICON-001` |
| AC-002 | 16x16 PNG favicon link is rendered           | `APP-PAGES-FAVICON-002` |
| AC-003 | 32x32 PNG favicon link is rendered           | `APP-PAGES-FAVICON-003` |
| AC-004 | Apple touch icon link is rendered            | `APP-PAGES-FAVICON-004` |
| AC-005 | Web manifest link is rendered                | `APP-PAGES-FAVICON-005` |
| AC-006 | Safari mask icon with color is rendered      | `APP-PAGES-FAVICON-006` |
| AC-007 | MS application tile meta tags are rendered   | `APP-PAGES-FAVICON-007` |
| AC-008 | Missing favicon paths are skipped gracefully | `APP-PAGES-FAVICON-008` |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/favicons.ts`
- **E2E Spec**: `specs/app/pages/meta/favicons.spec.ts`

---

## US-META-006: Performance Hints

**As a** developer,
**I want to** configure preload and prefetch hints,
**so that** critical resources load faster.

### Configuration

```yaml
pages:
  - id: 1
    name: home
    path: /
    meta:
      preload:
        - href: /fonts/inter.woff2
          as: font
          type: font/woff2
          crossorigin: anonymous
        - href: /images/hero.webp
          as: image
      prefetch:
        - href: /api/data
          as: fetch
      dnsPrefetch:
        - //cdn.example.com
        - //api.example.com
      preconnect:
        - href: //cdn.example.com
          crossorigin: true
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                |
| ------ | -------------------------------------------------- | ----------------------- |
| AC-001 | Preload links are rendered with correct attributes | `APP-PAGES-PRELOAD-001` |
| AC-002 | Preload as attribute specifies resource type       | `APP-PAGES-PRELOAD-002` |
| AC-003 | Preload type attribute is optional                 | `APP-PAGES-PRELOAD-003` |
| AC-004 | Preload crossorigin attribute is configurable      | `APP-PAGES-PRELOAD-004` |
| AC-005 | Prefetch links are rendered                        | `APP-PAGES-PRELOAD-005` |
| AC-006 | DNS prefetch links are rendered                    | `APP-PAGES-PRELOAD-006` |
| AC-007 | Preconnect links are rendered                      | `APP-PAGES-PRELOAD-007` |
| AC-008 | Invalid preload as value returns validation error  | `APP-PAGES-PRELOAD-008` |
| AC-009 | Font preloads require crossorigin                  | `APP-PAGES-PRELOAD-009` |
| AC-010 | Performance hints can be global or per-page        | `APP-PAGES-PRELOAD-010` |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/performance.ts`
- **E2E Spec**: `specs/app/pages/meta/performance.spec.ts`

---

## Regression Tests

| Spec ID                               | Workflow                                        | Status |
| ------------------------------------- | ----------------------------------------------- | ------ |
| `APP-PAGES-META-REGRESSION`           | Developer configures comprehensive SEO metadata | `[x]`  |
| `APP-PAGES-OG-REGRESSION`             | Open Graph tags render correctly for sharing    | `[x]`  |
| `APP-PAGES-TWITTER-REGRESSION`        | Twitter Cards render correctly for sharing      | `[x]`  |
| `APP-PAGES-STRUCTUREDDATA-REGRESSION` | Structured data validates and renders           | `[x]`  |
| `APP-PAGES-FAVICON-REGRESSION`        | Favicons display in browser correctly           | `[x]`  |
| `APP-PAGES-PRELOAD-REGRESSION`        | Performance hints improve load times            | `[x]`  |

---

## Coverage Summary

| User Story  | Title                     | Spec Count            | Status   |
| ----------- | ------------------------- | --------------------- | -------- |
| US-META-001 | Basic Page Metadata       | 12                    | Complete |
| US-META-002 | Open Graph Metadata       | 12                    | Complete |
| US-META-003 | Twitter Card Metadata     | 12                    | Complete |
| US-META-004 | Structured Data (JSON-LD) | 10                    | Complete |
| US-META-005 | Favicons                  | 8                     | Complete |
| US-META-006 | Performance Hints         | 10                    | Complete |
| **Total**   |                           | **64 + 6 regression** |          |
