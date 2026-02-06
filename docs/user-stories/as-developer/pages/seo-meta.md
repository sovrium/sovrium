# SEO & Metadata

> **Feature Area**: Pages - SEO & Social Sharing
> **Schema**: `src/domain/models/app/page/meta/`
> **E2E Specs**: `specs/app/pages/meta/`

---

## Overview

Sovrium provides comprehensive SEO and metadata configuration for pages, including basic meta tags, Open Graph for social sharing, Twitter Cards, structured data (JSON-LD), favicons, and performance hints like preloading. All metadata can be configured per-page or globally.

---

## US-PAGES-META-001: Basic Page Metadata

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

| ID     | Criterion                                         | E2E Spec                    | Status |
| ------ | ------------------------------------------------- | --------------------------- | ------ |
| AC-001 | Title tag is rendered in HTML head                | `APP-PAGES-META-001`        | ✅     |
| AC-002 | Description meta tag is rendered                  | `APP-PAGES-META-002`        | ✅     |
| AC-003 | Keywords meta tag is rendered                     | `APP-PAGES-META-003`        | ✅     |
| AC-004 | Canonical URL is rendered as link tag             | `APP-PAGES-META-004`        | ✅     |
| AC-005 | Robots meta tag controls indexing                 | `APP-PAGES-META-005`        | ✅     |
| AC-006 | Author meta tag is rendered                       | `APP-PAGES-META-006`        | ✅     |
| AC-007 | Viewport meta tag is configurable                 | `APP-PAGES-META-007`        | ✅     |
| AC-008 | Title supports template variables                 | `APP-PAGES-META-008`        | ✅     |
| AC-009 | Description supports template variables           | `APP-PAGES-META-009`        | ✅     |
| AC-010 | Missing title falls back to app name              | `APP-PAGES-META-010`        | ✅     |
| AC-011 | Meta tags can be overridden per page              | `APP-PAGES-META-011`        | ✅     |
| AC-012 | Empty meta values are not rendered                | `APP-PAGES-META-012`        | ✅     |
| AC-013 | User can complete full meta workflow (regression) | `APP-PAGES-META-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/meta.ts`
- **E2E Spec**: `specs/app/pages/meta/meta.spec.ts`

---

## US-PAGES-META-002: Open Graph Metadata

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

| ID     | Criterion                                               | E2E Spec                  | Status |
| ------ | ------------------------------------------------------- | ------------------------- | ------ |
| AC-001 | og:title meta tag is rendered                           | `APP-PAGES-OG-001`        | ✅     |
| AC-002 | og:description meta tag is rendered                     | `APP-PAGES-OG-002`        | ✅     |
| AC-003 | og:type meta tag is rendered                            | `APP-PAGES-OG-003`        | ✅     |
| AC-004 | og:url meta tag is rendered                             | `APP-PAGES-OG-004`        | ✅     |
| AC-005 | og:image meta tag is rendered                           | `APP-PAGES-OG-005`        | ✅     |
| AC-006 | og:image:width meta tag is rendered                     | `APP-PAGES-OG-006`        | ✅     |
| AC-007 | og:image:height meta tag is rendered                    | `APP-PAGES-OG-007`        | ✅     |
| AC-008 | og:image:alt meta tag is rendered                       | `APP-PAGES-OG-008`        | ✅     |
| AC-009 | og:site_name meta tag is rendered                       | `APP-PAGES-OG-009`        | ✅     |
| AC-010 | og:locale meta tag is rendered                          | `APP-PAGES-OG-010`        | ✅     |
| AC-011 | Missing og:title falls back to page title               | `APP-PAGES-OG-011`        | ✅     |
| AC-012 | Missing og:description falls back to meta description   | `APP-PAGES-OG-012`        | ✅     |
| AC-013 | User can complete full Open Graph workflow (regression) | `APP-PAGES-OG-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/open-graph.ts`
- **E2E Spec**: `specs/app/pages/meta/social/open-graph.spec.ts`

---

## US-PAGES-META-003: Twitter Card Metadata

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

| ID     | Criterion                                                 | E2E Spec                       | Status |
| ------ | --------------------------------------------------------- | ------------------------------ | ------ |
| AC-001 | twitter:card meta tag is rendered                         | `APP-PAGES-TWITTER-001`        | ✅     |
| AC-002 | twitter:site meta tag is rendered                         | `APP-PAGES-TWITTER-002`        | ✅     |
| AC-003 | twitter:creator meta tag is rendered                      | `APP-PAGES-TWITTER-003`        | ✅     |
| AC-004 | twitter:title meta tag is rendered                        | `APP-PAGES-TWITTER-004`        | ✅     |
| AC-005 | twitter:description meta tag is rendered                  | `APP-PAGES-TWITTER-005`        | ✅     |
| AC-006 | twitter:image meta tag is rendered                        | `APP-PAGES-TWITTER-006`        | ✅     |
| AC-007 | twitter:image:alt meta tag is rendered                    | `APP-PAGES-TWITTER-007`        | ✅     |
| AC-008 | Default card type is summary_large_image                  | `APP-PAGES-TWITTER-008`        | ✅     |
| AC-009 | Missing title falls back to og:title                      | `APP-PAGES-TWITTER-009`        | ✅     |
| AC-010 | Missing description falls back to og:description          | `APP-PAGES-TWITTER-010`        | ✅     |
| AC-011 | Missing image falls back to og:image                      | `APP-PAGES-TWITTER-011`        | ✅     |
| AC-012 | Invalid card type returns validation error                | `APP-PAGES-TWITTER-012`        | ✅     |
| AC-013 | User can complete full Twitter Card workflow (regression) | `APP-PAGES-TWITTER-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/twitter-card.ts`
- **E2E Spec**: `specs/app/pages/meta/social/twitter-card.spec.ts`

---

## US-PAGES-META-004: Structured Data (JSON-LD)

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

| ID     | Criterion                                                    | E2E Spec                              | Status |
| ------ | ------------------------------------------------------------ | ------------------------------------- | ------ |
| AC-001 | JSON-LD script tag is rendered in head                       | `APP-PAGES-STRUCTUREDDATA-001`        | ✅     |
| AC-002 | Organization schema is valid JSON-LD                         | `APP-PAGES-STRUCTUREDDATA-002`        | ✅     |
| AC-003 | WebSite schema is valid JSON-LD                              | `APP-PAGES-STRUCTUREDDATA-003`        | ✅     |
| AC-004 | Multiple structured data objects are supported               | `APP-PAGES-STRUCTUREDDATA-004`        | ✅     |
| AC-005 | Structured data supports custom properties                   | `APP-PAGES-STRUCTUREDDATA-005`        | ✅     |
| AC-006 | Invalid schema type returns validation error                 | `APP-PAGES-STRUCTUREDDATA-006`        | ✅     |
| AC-007 | @context is automatically added                              | `APP-PAGES-STRUCTUREDDATA-007`        | ✅     |
| AC-008 | @type is set from type property                              | `APP-PAGES-STRUCTUREDDATA-008`        | ✅     |
| AC-009 | Nested schemas are properly structured                       | `APP-PAGES-STRUCTUREDDATA-009`        | ✅     |
| AC-010 | Structured data supports template variables                  | `APP-PAGES-STRUCTUREDDATA-010`        | ✅     |
| AC-011 | User can complete full structured data workflow (regression) | `APP-PAGES-STRUCTUREDDATA-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/structured-data.ts`
- **E2E Spec**: `specs/app/pages/meta/structured-data/structured-data.spec.ts`

---

## US-PAGES-META-005: Favicons

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

| ID     | Criterion                                             | E2E Spec                       | Status |
| ------ | ----------------------------------------------------- | ------------------------------ | ------ |
| AC-001 | Standard favicon.ico link is rendered                 | `APP-PAGES-FAVICON-001`        | ✅     |
| AC-002 | 16x16 PNG favicon link is rendered                    | `APP-PAGES-FAVICON-002`        | ✅     |
| AC-003 | 32x32 PNG favicon link is rendered                    | `APP-PAGES-FAVICON-003`        | ✅     |
| AC-004 | Apple touch icon link is rendered                     | `APP-PAGES-FAVICON-004`        | ✅     |
| AC-005 | Web manifest link is rendered                         | `APP-PAGES-FAVICON-005`        | ✅     |
| AC-006 | Safari mask icon with color is rendered               | `APP-PAGES-FAVICON-006`        | ✅     |
| AC-007 | MS application tile meta tags are rendered            | `APP-PAGES-FAVICON-007`        | ✅     |
| AC-008 | Missing favicon paths are skipped gracefully          | `APP-PAGES-FAVICON-008`        | ✅     |
| AC-009 | User can complete full favicons workflow (regression) | `APP-PAGES-FAVICON-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/favicons.ts`
- **E2E Spec**: `specs/app/pages/meta/favicons.spec.ts`

---

## US-PAGES-META-006: Performance Hints

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

| ID     | Criterion                                                      | E2E Spec                       | Status |
| ------ | -------------------------------------------------------------- | ------------------------------ | ------ |
| AC-001 | Preload links are rendered with correct attributes             | `APP-PAGES-PRELOAD-001`        | ✅     |
| AC-002 | Preload as attribute specifies resource type                   | `APP-PAGES-PRELOAD-002`        | ✅     |
| AC-003 | Preload type attribute is optional                             | `APP-PAGES-PRELOAD-003`        | ✅     |
| AC-004 | Preload crossorigin attribute is configurable                  | `APP-PAGES-PRELOAD-004`        | ✅     |
| AC-005 | Prefetch links are rendered                                    | `APP-PAGES-PRELOAD-005`        | ✅     |
| AC-006 | DNS prefetch links are rendered                                | `APP-PAGES-PRELOAD-006`        | ✅     |
| AC-007 | Preconnect links are rendered                                  | `APP-PAGES-PRELOAD-007`        | ✅     |
| AC-008 | Invalid preload as value returns validation error              | `APP-PAGES-PRELOAD-008`        | ✅     |
| AC-009 | Font preloads require crossorigin                              | `APP-PAGES-PRELOAD-009`        | ✅     |
| AC-010 | Performance hints can be global or per-page                    | `APP-PAGES-PRELOAD-010`        | ✅     |
| AC-011 | User can complete full performance hints workflow (regression) | `APP-PAGES-PRELOAD-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/performance.ts`
- **E2E Spec**: `specs/app/pages/meta/performance.spec.ts`

---

## US-PAGES-META-007: Analytics Integration

**As a** developer,
**I want to** integrate multiple analytics providers,
**so that** I can track user behavior and measure performance across different platforms.

### Configuration

```yaml
meta:
  analytics:
    - provider: google
      enabled: true
      config:
        trackingId: 'G-XXXXXXXXXX'
        anonymizeIp: true
    - provider: plausible
      enabled: true
      config:
        domain: 'myapp.com'
    - provider: mixpanel
      config:
        token: 'abc123'
```

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                         | Status |
| ------ | ------------------------------------------------------ | -------------------------------- | ------ |
| AC-001 | Supports multiple analytics providers                  | `APP-PAGES-ANALYTICS-001`        | ✅     |
| AC-002 | Supports 6 analytics providers                         | `APP-PAGES-ANALYTICS-002`        | ✅     |
| AC-003 | Allows enabling/disabling provider                     | `APP-PAGES-ANALYTICS-003`        | ✅     |
| AC-004 | Loads provider scripts                                 | `APP-PAGES-ANALYTICS-004`        | ✅     |
| AC-005 | Loads script asynchronously                            | `APP-PAGES-ANALYTICS-005`        | ✅     |
| AC-006 | Executes provider initialization code                  | `APP-PAGES-ANALYTICS-006`        | ✅     |
| AC-007 | Optimizes DNS resolution for provider                  | `APP-PAGES-ANALYTICS-007`        | ✅     |
| AC-008 | Passes configuration to provider                       | `APP-PAGES-ANALYTICS-008`        | ✅     |
| AC-009 | Configures Google Analytics                            | `APP-PAGES-ANALYTICS-009`        | ✅     |
| AC-010 | Configures privacy-friendly Plausible analytics        | `APP-PAGES-ANALYTICS-010`        | ✅     |
| AC-011 | Supports multi-provider analytics                      | `APP-PAGES-ANALYTICS-011`        | ✅     |
| AC-012 | Configures event tracking and feature flags            | `APP-PAGES-ANALYTICS-012`        | ✅     |
| AC-013 | User can complete full analytics workflow (regression) | `APP-PAGES-ANALYTICS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/analytics.ts`
- **E2E Spec**: `specs/app/pages/meta/analytics.spec.ts`

---

## US-PAGES-META-008: Custom Head Elements

**As a** developer,
**I want to** add custom elements to the document head,
**so that** I can include meta tags, links, scripts, and styles not covered by standard options.

### Configuration

```yaml
meta:
  custom:
    - type: meta
      attributes:
        name: 'theme-color'
        content: '#3b82f6'
    - type: link
      attributes:
        rel: 'preconnect'
        href: 'https://api.example.com'
    - type: script
      attributes:
        src: 'https://example.com/widget.js'
        defer: true
    - type: style
      content: ':root { --primary: #3b82f6; }'
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                      | Status |
| ------ | ----------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Adds custom meta tag to head                          | `APP-PAGES-CUSTOM-001`        | ✅     |
| AC-002 | Adds custom link element to head                      | `APP-PAGES-CUSTOM-002`        | ✅     |
| AC-003 | Adds custom script to head                            | `APP-PAGES-CUSTOM-003`        | ✅     |
| AC-004 | Adds inline style to head                             | `APP-PAGES-CUSTOM-004`        | ✅     |
| AC-005 | Applies attributes to element                         | `APP-PAGES-CUSTOM-005`        | ✅     |
| AC-006 | Sets element inner content                            | `APP-PAGES-CUSTOM-006`        | ✅     |
| AC-007 | Customizes browser chrome color                       | `APP-PAGES-CUSTOM-007`        | ✅     |
| AC-008 | Configures mobile viewport                            | `APP-PAGES-CUSTOM-008`        | ✅     |
| AC-009 | User can complete full custom elements workflow (reg) | `APP-PAGES-CUSTOM-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/custom-elements.ts`
- **E2E Spec**: `specs/app/pages/meta/custom-elements.spec.ts`

---

## US-PAGES-META-009: DNS Prefetch

**As a** developer,
**I want to** configure DNS prefetch hints,
**so that** DNS resolution for external domains happens early and improves perceived load speed.

### Configuration

```yaml
meta:
  dnsPrefetch:
    - '//fonts.googleapis.com'
    - '//fonts.gstatic.com'
    - '//www.google-analytics.com'
    - '//cdn.example.com'
    - '//api.example.com'
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                   | Status |
| ------ | -------------------------------------------------- | -------------------------- | ------ |
| AC-001 | Prefetches DNS for listed domains                  | `APP-PAGES-DNS-001`        | ✅     |
| AC-002 | Optimizes Google Fonts loading                     | `APP-PAGES-DNS-002`        | ✅     |
| AC-003 | Optimizes analytics script loading                 | `APP-PAGES-DNS-003`        | ✅     |
| AC-004 | Optimizes CDN resource loading                     | `APP-PAGES-DNS-004`        | ✅     |
| AC-005 | Optimizes API request latency                      | `APP-PAGES-DNS-005`        | ✅     |
| AC-006 | Validates protocol in URL pattern                  | `APP-PAGES-DNS-006`        | ✅     |
| AC-007 | Prevents duplicate domain entries                  | `APP-PAGES-DNS-007`        | ✅     |
| AC-008 | Optimizes multiple external connections            | `APP-PAGES-DNS-008`        | ✅     |
| AC-009 | Reduces connection latency                         | `APP-PAGES-DNS-009`        | ✅     |
| AC-010 | Improves perceived page load speed                 | `APP-PAGES-DNS-010`        | ✅     |
| AC-011 | User can complete full DNS prefetch workflow (reg) | `APP-PAGES-DNS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/performance/dns-prefetch.ts`
- **E2E Spec**: `specs/app/pages/meta/performance/dns-prefetch.spec.ts`

---

## US-PAGES-META-010: Favicon Set

**As a** developer,
**I want to** configure a complete set of favicons for different devices,
**so that** my branding appears correctly across browsers, mobile devices, and PWAs.

### Configuration

```yaml
meta:
  faviconSet:
    - type: icon
      href: /favicon.ico
    - type: icon
      href: /favicon-32x32.png
      sizes: '32x32'
      mimeType: image/png
    - type: apple-touch-icon
      href: /apple-touch-icon.png
      sizes: '180x180'
    - type: mask-icon
      href: /safari-pinned-tab.svg
      color: '#5bbad5'
```

### Acceptance Criteria

| ID     | Criterion                                         | E2E Spec                          | Status |
| ------ | ------------------------------------------------- | --------------------------------- | ------ |
| AC-001 | Defines browser icon                              | `APP-PAGES-FAVICONSET-001`        | ✅     |
| AC-002 | Defines Apple touch icon                          | `APP-PAGES-FAVICONSET-002`        | ✅     |
| AC-003 | Defines Safari mask icon with color               | `APP-PAGES-FAVICONSET-003`        | ✅     |
| AC-004 | Specifies icon dimensions for different contexts  | `APP-PAGES-FAVICONSET-004`        | ✅     |
| AC-005 | Specifies MIME type                               | `APP-PAGES-FAVICONSET-005`        | ✅     |
| AC-006 | Defines Safari pinned tab color                   | `APP-PAGES-FAVICONSET-006`        | ✅     |
| AC-007 | Provides comprehensive multi-device icon support  | `APP-PAGES-FAVICONSET-007`        | ✅     |
| AC-008 | User can complete full favicon set workflow (reg) | `APP-PAGES-FAVICONSET-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/favicons/favicon-set.ts`
- **E2E Spec**: `specs/app/pages/meta/favicons/favicon-set.spec.ts`

---

## US-PAGES-META-011: Product Structured Data

**As a** developer,
**I want to** add Product structured data to pages,
**so that** my products appear in Google Shopping results with rich information.

### Configuration

```yaml
meta:
  structuredData:
    - type: Product
      name: 'Premium Widget'
      description: 'High-quality widget for all your needs'
      image:
        - 'https://example.com/widget.jpg'
      brand:
        type: Brand
        name: 'WidgetCo'
      sku: 'WIDGET-001'
      gtin: '012345678901'
      offers:
        type: Offer
        price: 29.99
        priceCurrency: USD
        availability: InStock
      aggregateRating:
        type: AggregateRating
        ratingValue: 4.5
        reviewCount: 89
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                       | Status |
| ------ | ---------------------------------------------------- | ------------------------------ | ------ |
| AC-001 | Validates minimal Product structured data            | `APP-PAGES-PRODUCT-001`        | ✅     |
| AC-002 | Provides product identity                            | `APP-PAGES-PRODUCT-002`        | ✅     |
| AC-003 | Supports single or multiple product images           | `APP-PAGES-PRODUCT-003`        | ✅     |
| AC-004 | Identifies product manufacturer                      | `APP-PAGES-PRODUCT-004`        | ✅     |
| AC-005 | Provides stock keeping unit                          | `APP-PAGES-PRODUCT-005`        | ✅     |
| AC-006 | Provides standardized product identifier             | `APP-PAGES-PRODUCT-006`        | ✅     |
| AC-007 | Provides pricing information                         | `APP-PAGES-PRODUCT-007`        | ✅     |
| AC-008 | Specifies product price with currency                | `APP-PAGES-PRODUCT-008`        | ✅     |
| AC-009 | Shows product availability in search results         | `APP-PAGES-PRODUCT-009`        | ✅     |
| AC-010 | Displays star ratings in search results              | `APP-PAGES-PRODUCT-010`        | ✅     |
| AC-011 | Enables Google Shopping rich results                 | `APP-PAGES-PRODUCT-011`        | ✅     |
| AC-012 | Displays price, availability, and ratings in SERPs   | `APP-PAGES-PRODUCT-012`        | ✅     |
| AC-013 | User can complete full product workflow (regression) | `APP-PAGES-PRODUCT-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/structured-data/product.ts`
- **E2E Spec**: `specs/app/pages/meta/structured-data/product.spec.ts`

---

## US-PAGES-META-012: Breadcrumb Structured Data

**As a** developer,
**I want to** add BreadcrumbList structured data to pages,
**so that** search engines display navigation trails in search results.

### Configuration

```yaml
meta:
  structuredData:
    - type: BreadcrumbList
      itemListElement:
        - type: ListItem
          position: 1
          name: Home
          item: https://example.com/
        - type: ListItem
          position: 2
          name: Products
          item: https://example.com/products
        - type: ListItem
          position: 3
          name: Widgets
          item: https://example.com/products/widgets
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                          | Status |
| ------ | -------------------------------------------------- | --------------------------------- | ------ |
| AC-001 | Validates minimal BreadcrumbList structured data   | `APP-PAGES-BREADCRUMB-001`        | ✅     |
| AC-002 | Defines navigation path                            | `APP-PAGES-BREADCRUMB-002`        | ✅     |
| AC-003 | Defines breadcrumb item structure                  | `APP-PAGES-BREADCRUMB-003`        | ✅     |
| AC-004 | Orders breadcrumb trail                            | `APP-PAGES-BREADCRUMB-004`        | ✅     |
| AC-005 | Provides human-readable breadcrumb label           | `APP-PAGES-BREADCRUMB-005`        | ✅     |
| AC-006 | Provides clickable breadcrumb link                 | `APP-PAGES-BREADCRUMB-006`        | ✅     |
| AC-007 | Represents multi-level navigation path             | `APP-PAGES-BREADCRUMB-007`        | ✅     |
| AC-008 | Helps search engines understand site architecture  | `APP-PAGES-BREADCRUMB-008`        | ✅     |
| AC-009 | Displays breadcrumb trail in Google search results | `APP-PAGES-BREADCRUMB-009`        | ✅     |
| AC-010 | Improves navigation and reduces bounce rate        | `APP-PAGES-BREADCRUMB-010`        | ✅     |
| AC-011 | User can complete full breadcrumb workflow (reg)   | `APP-PAGES-BREADCRUMB-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/structured-data/breadcrumb.ts`
- **E2E Spec**: `specs/app/pages/meta/structured-data/breadcrumb.spec.ts`

---

## US-PAGES-META-013: FAQ Page Structured Data

**As a** developer,
**I want to** add FAQPage structured data to pages,
**so that** FAQ questions appear as expandable answers in search results.

### Configuration

```yaml
meta:
  structuredData:
    - type: FAQPage
      mainEntity:
        - type: Question
          name: 'What is Sovrium?'
          acceptedAnswer:
            type: Answer
            text: 'Sovrium is a configuration-driven application platform.'
        - type: Question
          name: 'How do I get started?'
          acceptedAnswer:
            type: Answer
            text: 'Install via npm: npm install sovrium'
```

### Acceptance Criteria

| ID     | Criterion                                           | E2E Spec                       | Status |
| ------ | --------------------------------------------------- | ------------------------------ | ------ |
| AC-001 | Validates minimal FAQPage structured data           | `APP-PAGES-FAQPAGE-001`        | ✅     |
| AC-002 | Contains list of Q&A pairs                          | `APP-PAGES-FAQPAGE-002`        | ✅     |
| AC-003 | Defines question structure                          | `APP-PAGES-FAQPAGE-003`        | ✅     |
| AC-004 | Provides question text                              | `APP-PAGES-FAQPAGE-004`        | ✅     |
| AC-005 | Provides answer structure                           | `APP-PAGES-FAQPAGE-005`        | ✅     |
| AC-006 | Provides answer content                             | `APP-PAGES-FAQPAGE-006`        | ✅     |
| AC-007 | Supports comprehensive FAQ section                  | `APP-PAGES-FAQPAGE-007`        | ✅     |
| AC-008 | Displays expandable Q&A in Google search results    | `APP-PAGES-FAQPAGE-008`        | ✅     |
| AC-009 | Reduces support load by surfacing answers in search | `APP-PAGES-FAQPAGE-009`        | ✅     |
| AC-010 | Increases click-through rate from search results    | `APP-PAGES-FAQPAGE-010`        | ✅     |
| AC-011 | User can complete full FAQ page workflow (reg)      | `APP-PAGES-FAQPAGE-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/structured-data/faq-page.ts`
- **E2E Spec**: `specs/app/pages/meta/structured-data/faq-page.spec.ts`

---

## US-PAGES-META-014: Person Structured Data

**As a** developer,
**I want to** add Person structured data to pages,
**so that** author information appears in Google Knowledge Graph.

### Configuration

```yaml
meta:
  structuredData:
    - type: Person
      name: 'Jane Doe'
      givenName: 'Jane'
      familyName: 'Doe'
      email: 'jane@example.com'
      url: 'https://janedoe.com'
      image: 'https://example.com/jane.jpg'
      jobTitle: 'Software Engineer'
      worksFor:
        type: Organization
        name: 'TechCorp'
      sameAs:
        - 'https://twitter.com/janedoe'
        - 'https://linkedin.com/in/janedoe'
```

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec                      | Status |
| ------ | -------------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Validates minimal Person structured data                 | `APP-PAGES-PERSON-001`        | ✅     |
| AC-002 | Provides person's full name                              | `APP-PAGES-PERSON-002`        | ✅     |
| AC-003 | Provides structured first and last names                 | `APP-PAGES-PERSON-003`        | ✅     |
| AC-004 | Provides person contact information                      | `APP-PAGES-PERSON-004`        | ✅     |
| AC-005 | Links to person's web presence                           | `APP-PAGES-PERSON-005`        | ✅     |
| AC-006 | Provides visual representation                           | `APP-PAGES-PERSON-006`        | ✅     |
| AC-007 | Indicates person's professional role                     | `APP-PAGES-PERSON-007`        | ✅     |
| AC-008 | Links person to their employer                           | `APP-PAGES-PERSON-008`        | ✅     |
| AC-009 | Links person to their social profiles                    | `APP-PAGES-PERSON-009`        | ✅     |
| AC-010 | Includes PostalAddress structured data                   | `APP-PAGES-PERSON-010`        | ✅     |
| AC-011 | Attributes content to specific author                    | `APP-PAGES-PERSON-011`        | ✅     |
| AC-012 | Enables Google Knowledge Graph panel for notable persons | `APP-PAGES-PERSON-012`        | ✅     |
| AC-013 | User can complete full person workflow (regression)      | `APP-PAGES-PERSON-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/structured-data/person.ts`
- **E2E Spec**: `specs/app/pages/meta/structured-data/person.spec.ts`

---

## US-PAGES-META-015: Organization Structured Data

**As a** developer,
**I want to** add Organization structured data to pages,
**so that** company information appears in Google Knowledge Graph.

### Configuration

```yaml
meta:
  structuredData:
    - type: Organization
      '@context': 'https://schema.org'
      name: 'TechCorp Inc.'
      url: 'https://techcorp.com'
      logo: 'https://techcorp.com/logo.png'
      image:
        - 'https://techcorp.com/office.jpg'
      email: 'contact@techcorp.com'
      telephone: '+1-555-123-4567'
      address:
        type: PostalAddress
        streetAddress: '123 Tech Street'
        addressLocality: 'San Francisco'
        addressRegion: 'CA'
        postalCode: '94102'
        addressCountry: 'US'
      sameAs:
        - 'https://twitter.com/techcorp'
        - 'https://linkedin.com/company/techcorp'
      foundingDate: '2010-01-15'
      numberOfEmployees: 500
```

### Acceptance Criteria

| ID     | Criterion                                              | E2E Spec                            | Status |
| ------ | ------------------------------------------------------ | ----------------------------------- | ------ |
| AC-001 | Validates minimal Organization structured data         | `APP-PAGES-ORGANIZATION-001`        | ✅     |
| AC-002 | Specifies Schema.org vocabulary                        | `APP-PAGES-ORGANIZATION-002`        | ✅     |
| AC-003 | Identifies entity as Organization                      | `APP-PAGES-ORGANIZATION-003`        | ✅     |
| AC-004 | Provides organization name                             | `APP-PAGES-ORGANIZATION-004`        | ✅     |
| AC-005 | Provides organization website URL                      | `APP-PAGES-ORGANIZATION-005`        | ✅     |
| AC-006 | Provides logo for search results                       | `APP-PAGES-ORGANIZATION-006`        | ✅     |
| AC-007 | Supports single or multiple organization images        | `APP-PAGES-ORGANIZATION-007`        | ✅     |
| AC-008 | Provides contact information                           | `APP-PAGES-ORGANIZATION-008`        | ✅     |
| AC-009 | Includes PostalAddress structured data                 | `APP-PAGES-ORGANIZATION-009`        | ✅     |
| AC-010 | Links organization to social profiles                  | `APP-PAGES-ORGANIZATION-010`        | ✅     |
| AC-011 | Provides organization history                          | `APP-PAGES-ORGANIZATION-011`        | ✅     |
| AC-012 | Indicates organization size                            | `APP-PAGES-ORGANIZATION-012`        | ✅     |
| AC-013 | Links organization to hosted events                    | `APP-PAGES-ORGANIZATION-013`        | ✅     |
| AC-014 | Enables Google Knowledge Graph panel in search results | `APP-PAGES-ORGANIZATION-014`        | ✅     |
| AC-015 | User can complete full organization workflow (reg)     | `APP-PAGES-ORGANIZATION-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/structured-data/organization.ts`
- **E2E Spec**: `specs/app/pages/meta/structured-data/organization.spec.ts`

---

## US-PAGES-META-016: LocalBusiness Structured Data

**As a** developer,
**I want to** add LocalBusiness structured data to pages,
**so that** my business appears in Google Maps and local search results.

### Configuration

```yaml
meta:
  structuredData:
    - type: LocalBusiness
      name: 'Coffee House'
      description: 'Artisanal coffee and pastries'
      image:
        - 'https://example.com/coffeehouse.jpg'
      logo: 'https://example.com/logo.png'
      telephone: '+1-555-COFFEE'
      priceRange: '$$'
      address:
        type: PostalAddress
        streetAddress: '456 Main Street'
        addressLocality: 'Portland'
        addressRegion: 'OR'
        postalCode: '97201'
        addressCountry: 'US'
      geo:
        type: GeoCoordinates
        latitude: 45.5231
        longitude: -122.6765
      openingHoursSpecification:
        - type: OpeningHoursSpecification
          dayOfWeek:
            - Monday
            - Tuesday
            - Wednesday
          opens: '07:00'
          closes: '18:00'
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec                             | Status |
| ------ | -------------------------------------------------- | ------------------------------------ | ------ |
| AC-001 | Validates minimal LocalBusiness structured data    | `APP-PAGES-LOCALBUSINESS-001`        | ✅     |
| AC-002 | Provides business identity                         | `APP-PAGES-LOCALBUSINESS-002`        | ✅     |
| AC-003 | Provides business branding                         | `APP-PAGES-LOCALBUSINESS-003`        | ✅     |
| AC-004 | Supports single or multiple business images        | `APP-PAGES-LOCALBUSINESS-004`        | ✅     |
| AC-005 | Provides business contact information              | `APP-PAGES-LOCALBUSINESS-005`        | ✅     |
| AC-006 | Indicates business price level                     | `APP-PAGES-LOCALBUSINESS-006`        | ✅     |
| AC-007 | Includes physical address for maps                 | `APP-PAGES-LOCALBUSINESS-007`        | ✅     |
| AC-008 | Provides precise map location                      | `APP-PAGES-LOCALBUSINESS-008`        | ✅     |
| AC-009 | Links business to social profiles                  | `APP-PAGES-LOCALBUSINESS-009`        | ✅     |
| AC-010 | Provides business hours for each day               | `APP-PAGES-LOCALBUSINESS-010`        | ✅     |
| AC-011 | Specifies which days hours apply to                | `APP-PAGES-LOCALBUSINESS-011`        | ✅     |
| AC-012 | Specifies daily operating hours                    | `APP-PAGES-LOCALBUSINESS-012`        | ✅     |
| AC-013 | Enables Google Business Profile rich results       | `APP-PAGES-LOCALBUSINESS-013`        | ✅     |
| AC-014 | Enables map pin and directions in search results   | `APP-PAGES-LOCALBUSINESS-014`        | ✅     |
| AC-015 | User can complete full local business workflow (r) | `APP-PAGES-LOCALBUSINESS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/structured-data/local-business.ts`
- **E2E Spec**: `specs/app/pages/meta/structured-data/local-business.spec.ts`

---

## US-PAGES-META-017: Article Structured Data

**As a** developer,
**I want to** add Article structured data to pages,
**so that** my content appears in Google News and article rich results.

### Configuration

```yaml
meta:
  structuredData:
    - type: Article # or NewsArticle, BlogPosting
      headline: 'How to Build Modern Web Apps'
      description: 'A comprehensive guide to building web applications'
      image:
        - 'https://example.com/article-image.jpg'
      author:
        type: Person
        name: 'Jane Developer'
        url: 'https://example.com/authors/jane'
      publisher:
        type: Organization
        name: 'TechBlog'
        logo: 'https://example.com/logo.png'
      datePublished: '2025-01-15T10:00:00Z'
      dateModified: '2025-01-20T14:30:00Z'
      mainEntityOfPage: 'https://example.com/article'
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                       | Status |
| ------ | ----------------------------------------------------- | ------------------------------ | ------ |
| AC-001 | Validates minimal Article structured data             | `APP-PAGES-ARTICLE-001`        | ✅     |
| AC-002 | Categorizes content type                              | `APP-PAGES-ARTICLE-002`        | ✅     |
| AC-003 | Provides article title for rich results               | `APP-PAGES-ARTICLE-003`        | ✅     |
| AC-004 | Provides article summary                              | `APP-PAGES-ARTICLE-004`        | ✅     |
| AC-005 | Supports single or multiple article images            | `APP-PAGES-ARTICLE-005`        | ✅     |
| AC-006 | Provides simple author name                           | `APP-PAGES-ARTICLE-006`        | ✅     |
| AC-007 | Provides structured author information                | `APP-PAGES-ARTICLE-007`        | ✅     |
| AC-008 | Attributes content to organization                    | `APP-PAGES-ARTICLE-008`        | ✅     |
| AC-009 | Provides publication date                             | `APP-PAGES-ARTICLE-009`        | ✅     |
| AC-010 | Indicates last update date                            | `APP-PAGES-ARTICLE-010`        | ✅     |
| AC-011 | Identifies publishing organization                    | `APP-PAGES-ARTICLE-011`        | ✅     |
| AC-012 | Specifies article's primary page URL                  | `APP-PAGES-ARTICLE-012`        | ✅     |
| AC-013 | Enables Google News and article rich results          | `APP-PAGES-ARTICLE-013`        | ✅     |
| AC-014 | Properly attributes content to authors and publishers | `APP-PAGES-ARTICLE-014`        | ✅     |
| AC-015 | User can complete full article workflow (regression)  | `APP-PAGES-ARTICLE-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/structured-data/article.ts`
- **E2E Spec**: `specs/app/pages/meta/structured-data/article.spec.ts`

---

## US-PAGES-META-018: PostalAddress Structured Data

**As a** developer,
**I want to** add PostalAddress structured data,
**so that** physical addresses are properly formatted for maps and local search.

### Configuration

```yaml
meta:
  structuredData:
    - type: Organization
      name: 'My Company'
      address:
        type: PostalAddress
        streetAddress: '123 Main Street, Suite 100'
        addressLocality: 'San Francisco'
        addressRegion: 'CA'
        postalCode: '94102'
        addressCountry: 'US'
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                             | Status |
| ------ | ---------------------------------------------------- | ------------------------------------ | ------ |
| AC-001 | Validates minimal PostalAddress structured data      | `APP-PAGES-POSTALADDRESS-001`        | ✅     |
| AC-002 | Provides street address                              | `APP-PAGES-POSTALADDRESS-002`        | ✅     |
| AC-003 | Provides city or locality name                       | `APP-PAGES-POSTALADDRESS-003`        | ✅     |
| AC-004 | Provides state or region name                        | `APP-PAGES-POSTALADDRESS-004`        | ✅     |
| AC-005 | Provides postal or ZIP code                          | `APP-PAGES-POSTALADDRESS-005`        | ✅     |
| AC-006 | Provides country code                                | `APP-PAGES-POSTALADDRESS-006`        | ✅     |
| AC-007 | Provides full mailing address                        | `APP-PAGES-POSTALADDRESS-007`        | ✅     |
| AC-008 | Provides organization's physical address             | `APP-PAGES-POSTALADDRESS-008`        | ✅     |
| AC-009 | Enables local business map display in search results | `APP-PAGES-POSTALADDRESS-009`        | ✅     |
| AC-010 | Improves local search ranking and map visibility     | `APP-PAGES-POSTALADDRESS-010`        | ✅     |
| AC-011 | User can complete full postal address workflow (reg) | `APP-PAGES-POSTALADDRESS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/structured-data/postal-address.ts`
- **E2E Spec**: `specs/app/pages/meta/structured-data/postal-address.spec.ts`

---

## US-PAGES-META-019: EducationEvent Structured Data

**As a** developer,
**I want to** add EducationEvent structured data,
**so that** my courses and educational events appear in Google search features.

### Configuration

```yaml
meta:
  structuredData:
    - type: EducationEvent
      name: 'Web Development Bootcamp'
      description: 'Intensive 12-week program'
      startDate: '2025-03-01T09:00:00Z'
      endDate: '2025-05-24T17:00:00Z'
      eventAttendanceMode: MixedEventAttendanceMode
      eventStatus: EventScheduled
      location:
        type: Place
        name: 'Tech Campus'
        address:
          type: PostalAddress
          streetAddress: '100 Tech Drive'
          addressLocality: 'Seattle'
          addressRegion: 'WA'
          postalCode: '98101'
          addressCountry: 'US'
      organizer:
        type: Organization
        name: 'Code Academy'
      offers:
        type: Offer
        price: 4999
        priceCurrency: USD
        availability: InStock
        validFrom: '2025-01-01T00:00:00Z'
      maximumAttendeeCapacity: 30
```

### Acceptance Criteria

| ID     | Criterion                                                  | E2E Spec                              | Status |
| ------ | ---------------------------------------------------------- | ------------------------------------- | ------ |
| AC-001 | Validates minimal EducationEvent structured data           | `APP-PAGES-EDUCATIONEVENT-001`        | ✅     |
| AC-002 | Provides event identity                                    | `APP-PAGES-EDUCATIONEVENT-002`        | ✅     |
| AC-003 | Specifies when event begins                                | `APP-PAGES-EDUCATIONEVENT-003`        | ✅     |
| AC-004 | Specifies when event ends                                  | `APP-PAGES-EDUCATIONEVENT-004`        | ✅     |
| AC-005 | Specifies whether event is in-person, online, or hybrid    | `APP-PAGES-EDUCATIONEVENT-005`        | ✅     |
| AC-006 | Communicates event status                                  | `APP-PAGES-EDUCATIONEVENT-006`        | ✅     |
| AC-007 | Provides event venue information                           | `APP-PAGES-EDUCATIONEVENT-007`        | ✅     |
| AC-008 | Identifies event organizer                                 | `APP-PAGES-EDUCATIONEVENT-008`        | ✅     |
| AC-009 | Provides ticket pricing and availability                   | `APP-PAGES-EDUCATIONEVENT-009`        | ✅     |
| AC-010 | Specifies event ticket price                               | `APP-PAGES-EDUCATIONEVENT-010`        | ✅     |
| AC-011 | Indicates ticket availability status                       | `APP-PAGES-EDUCATIONEVENT-011`        | ✅     |
| AC-012 | Specifies event capacity limits                            | `APP-PAGES-EDUCATIONEVENT-012`        | ✅     |
| AC-013 | Enables Google Events rich results                         | `APP-PAGES-EDUCATIONEVENT-013`        | ✅     |
| AC-014 | Displays event in Google Search, Maps, and event discovery | `APP-PAGES-EDUCATIONEVENT-014`        | ✅     |
| AC-015 | User can complete full education event workflow (reg)      | `APP-PAGES-EDUCATIONEVENT-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/page/meta/structured-data/education-event.ts`
- **E2E Spec**: `specs/app/pages/meta/structured-data/education-event.spec.ts`

---

## Regression Tests

| Spec ID                               | Workflow                                        | Status |
| ------------------------------------- | ----------------------------------------------- | ------ |
| `APP-PAGES-META-REGRESSION`           | Developer configures comprehensive SEO metadata | ✅     |
| `APP-PAGES-OG-REGRESSION`             | Open Graph tags render correctly for sharing    | ✅     |
| `APP-PAGES-TWITTER-REGRESSION`        | Twitter Cards render correctly for sharing      | ✅     |
| `APP-PAGES-STRUCTUREDDATA-REGRESSION` | Structured data validates and renders           | ✅     |
| `APP-PAGES-FAVICON-REGRESSION`        | Favicons display in browser correctly           | ✅     |
| `APP-PAGES-PRELOAD-REGRESSION`        | Performance hints improve load times            | ✅     |
| `APP-PAGES-ANALYTICS-REGRESSION`      | Analytics providers load and track correctly    | ⏳     |
| `APP-PAGES-CUSTOM-REGRESSION`         | Custom head elements render correctly           | ⏳     |
| `APP-PAGES-DNS-REGRESSION`            | DNS prefetch hints optimize loading             | ⏳     |
| `APP-PAGES-FAVICONSET-REGRESSION`     | Favicon set renders for all devices             | ⏳     |
| `APP-PAGES-PRODUCT-REGRESSION`        | Product structured data enables rich results    | ⏳     |
| `APP-PAGES-BREADCRUMB-REGRESSION`     | Breadcrumb structured data renders correctly    | ⏳     |
| `APP-PAGES-FAQPAGE-REGRESSION`        | FAQ page structured data enables rich snippets  | ⏳     |
| `APP-PAGES-PERSON-REGRESSION`         | Person structured data enables Knowledge Graph  | ⏳     |
| `APP-PAGES-ORGANIZATION-REGRESSION`   | Organization structured data renders correctly  | ⏳     |
| `APP-PAGES-LOCALBUSINESS-REGRESSION`  | LocalBusiness enables maps and local search     | ⏳     |
| `APP-PAGES-ARTICLE-REGRESSION`        | Article structured data enables news results    | ⏳     |
| `APP-PAGES-POSTALADDRESS-REGRESSION`  | PostalAddress structures address correctly      | ⏳     |
| `APP-PAGES-EDUCATIONEVENT-REGRESSION` | EducationEvent enables event discovery          | ⏳     |

---

## Coverage Summary

| User Story        | Title                          | Spec Count | Status      |
| ----------------- | ------------------------------ | ---------- | ----------- |
| US-PAGES-META-001 | Basic Page Metadata            | 12         | Complete    |
| US-PAGES-META-002 | Open Graph Metadata            | 12         | Complete    |
| US-PAGES-META-003 | Twitter Card Metadata          | 12         | Complete    |
| US-PAGES-META-004 | Structured Data (JSON-LD)      | 10         | Complete    |
| US-PAGES-META-005 | Favicons                       | 8          | Complete    |
| US-PAGES-META-006 | Performance Hints              | 10         | Complete    |
| US-PAGES-META-007 | Analytics Integration          | 13         | Not Started |
| US-PAGES-META-008 | Custom Head Elements           | 9          | Not Started |
| US-PAGES-META-009 | DNS Prefetch                   | 11         | Not Started |
| US-PAGES-META-010 | Favicon Set                    | 8          | Not Started |
| US-PAGES-META-011 | Product Structured Data        | 13         | Not Started |
| US-PAGES-META-012 | Breadcrumb Structured Data     | 11         | Not Started |
| US-PAGES-META-013 | FAQ Page Structured Data       | 11         | Not Started |
| US-PAGES-META-014 | Person Structured Data         | 13         | Not Started |
| US-PAGES-META-015 | Organization Structured Data   | 15         | Not Started |
| US-PAGES-META-016 | LocalBusiness Structured Data  | 15         | Not Started |
| US-PAGES-META-017 | Article Structured Data        | 15         | Not Started |
| US-PAGES-META-018 | PostalAddress Structured Data  | 11         | Not Started |
| US-PAGES-META-019 | EducationEvent Structured Data | 15         | Not Started |
| **Total**         |                                | **224**    |             |
