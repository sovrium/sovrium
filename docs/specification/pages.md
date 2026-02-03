# Pages Specification

> Page configuration with layouts, metadata, sections, and scripts

## Overview

Pages define the UI structure for Sovrium applications. They use a block-based layout system with reusable components for building landing pages, about pages, pricing pages, and other public-facing content.

**Vision Alignment**: Pages enable Sovrium's configuration-driven approach to building server-side rendered marketing and content pages through declarative YAML/JSON configuration.

## Schema Structure

**Location**: `src/domain/models/app/page/`

```
page/
├── index.ts                    # Main PageSchema
├── id.ts                       # Page identifier
├── name.ts                     # Page name
├── path.ts                     # URL path
├── sections.ts                 # Content sections
├── layout.ts                   # Layout composition
├── layout-merge.ts             # Layout inheritance
├── layout/                     # Layout components
│   ├── banner.ts               # Announcement bar
│   ├── navigation.ts           # Header/nav bar
│   │   ├── nav-links.ts        # Navigation links
│   │   └── cta-button.ts       # Call-to-action button
│   ├── footer.ts               # Page footer
│   └── sidebar.ts              # Side navigation
├── meta/                       # Page metadata
│   ├── index.ts                # MetaSchema
│   ├── analytics.ts            # Analytics configuration
│   ├── open-graph.ts           # Facebook/LinkedIn sharing
│   ├── twitter-card.ts         # Twitter/X sharing
│   ├── favicon.ts              # Simple favicon
│   ├── favicon-set.ts          # Multi-device favicons
│   ├── favicons-config.ts      # Favicon configuration
│   ├── preload.ts              # Resource preloading
│   ├── dns-prefetch.ts         # DNS prefetch hints
│   ├── custom-elements.ts      # Custom head elements
│   └── structured-data/        # Schema.org data
│       ├── index.ts
│       ├── article.ts
│       ├── breadcrumb.ts
│       ├── faq-page.ts
│       ├── product.ts
│       ├── organization.ts
│       ├── local-business.ts
│       ├── person.ts
│       ├── postal-address.ts
│       └── education-event.ts
├── scripts/                    # Client-side scripts
│   ├── scripts.ts              # ScriptsSchema
│   ├── features.ts             # Feature flags
│   ├── external-scripts.ts     # CDN scripts
│   └── inline-scripts.ts       # Custom JavaScript
└── common/                     # Shared utilities
    ├── responsive.ts           # Breakpoint overrides
    ├── url.ts                  # URL validation
    ├── variable-reference.ts   # $var substitution
    └── interactions/           # Interactive behaviors
        ├── interactions.ts
        ├── click-interaction.ts
        ├── hover-interaction.ts
        ├── scroll-interaction.ts
        └── entrance-animation.ts
```

---

## Page Properties

| Property   | Type                                          | Required | Description                     |
| ---------- | --------------------------------------------- | -------- | ------------------------------- |
| `id`       | `string`                                      | No       | Unique page identifier          |
| `name`     | `string`                                      | Yes      | Human-readable page name        |
| `path`     | `string`                                      | Yes      | URL path (e.g., `/`, `/about`)  |
| `meta`     | `MetaSchema`                                  | No       | SEO, social, analytics metadata |
| `layout`   | `LayoutSchema \| null`                        | No       | Layout configuration            |
| `sections` | `SectionItem[]`                               | Yes      | Page content sections           |
| `scripts`  | `ScriptsSchema`                               | No       | Client-side scripts             |
| `vars`     | `Record<string, string \| number \| boolean>` | No       | Page-level variables            |

---

## Layout Components

**Location**: `src/domain/models/app/page/layout/`

### Layout Hierarchy

```
┌─────────────────────────────────────┐
│ Banner (optional)                   │ ← Announcement bar
├─────────────────────────────────────┤
│ Navigation                          │ ← Header with logo + links
├─────────┬───────────────────────────┤
│ Sidebar │ Main Content              │ ← Optional left/right panel
│ (opt.)  │                           │
├─────────┴───────────────────────────┤
│ Footer (optional)                   │ ← Bottom section
└─────────────────────────────────────┘
```

### Layout Patterns

| Pattern           | Components                             | Use Case            |
| ----------------- | -------------------------------------- | ------------------- |
| **Landing Page**  | Navigation + Footer                    | Most websites (95%) |
| **Documentation** | Navigation + Sidebar + Footer          | Docs, guides        |
| **Dashboard**     | Navigation + Sidebar (collapsible)     | Admin panels        |
| **Campaign**      | Banner + Navigation + Footer           | Promotions          |
| **Enterprise**    | Banner + Navigation + Sidebar + Footer | Full-featured       |
| **Blank**         | None                                   | Full-screen apps    |

### Banner

**Location**: `src/domain/models/app/page/layout/banner.ts`

Top announcement bar for promotions, alerts, or cookie consent.

| Property      | Type              | Description            |
| ------------- | ----------------- | ---------------------- |
| `enabled`     | `boolean`         | Show/hide banner       |
| `text`        | `string`          | Banner message         |
| `link`        | `{ href, label }` | Optional link          |
| `sticky`      | `boolean`         | Stick to top on scroll |
| `dismissible` | `boolean`         | Allow users to close   |
| `gradient`    | `string`          | Background gradient    |

### Navigation

**Location**: `src/domain/models/app/page/layout/navigation.ts`

Header with logo, links, search, and user menu.

| Property | Type                       | Description            |
| -------- | -------------------------- | ---------------------- |
| `logo`   | `string`                   | Logo path              |
| `sticky` | `boolean`                  | Stick to top on scroll |
| `links`  | `{ desktop, mobile }`      | Navigation links       |
| `cta`    | `{ text, href, variant }`  | Call-to-action button  |
| `search` | `{ enabled, placeholder }` | Search functionality   |
| `user`   | `{ enabled }`              | User menu              |

### Footer

**Location**: `src/domain/models/app/page/layout/footer.ts`

Bottom section with links, social icons, and legal.

| Property     | Type      | Description        |
| ------------ | --------- | ------------------ |
| `enabled`    | `boolean` | Show/hide footer   |
| `logo`       | `string`  | Footer logo        |
| `copyright`  | `string`  | Copyright text     |
| `columns`    | `Array`   | Link columns       |
| `social`     | `Object`  | Social media links |
| `newsletter` | `Object`  | Newsletter signup  |
| `legal`      | `Array`   | Legal links        |

### Sidebar

**Location**: `src/domain/models/app/page/layout/sidebar.ts`

Left/right navigation panel.

| Property      | Type                | Description             |
| ------------- | ------------------- | ----------------------- |
| `enabled`     | `boolean`           | Show/hide sidebar       |
| `position`    | `'left' \| 'right'` | Sidebar position        |
| `sticky`      | `boolean`           | Stick to side on scroll |
| `collapsible` | `boolean`           | Allow collapse          |
| `items`       | `Array`             | Navigation items        |

---

## Metadata (Meta)

**Location**: `src/domain/models/app/page/meta/`

### Core Properties

| Property      | Type      | Required | Description                      |
| ------------- | --------- | -------- | -------------------------------- |
| `lang`        | `string`  | No       | Language code (ISO 639-1)        |
| `title`       | `string`  | Yes      | Page title (max 60 chars)        |
| `description` | `string`  | No       | Page description (max 160 chars) |
| `keywords`    | `string`  | No       | Comma-separated keywords         |
| `author`      | `string`  | No       | Author name                      |
| `canonical`   | `string`  | No       | Canonical URL                    |
| `robots`      | `string`  | No       | Robot directives                 |
| `noindex`     | `boolean` | No       | Prevent indexing                 |

### Favicons

| Property   | Type                           | Description           |
| ---------- | ------------------------------ | --------------------- |
| `favicon`  | `string`                       | Simple favicon path   |
| `favicons` | `FaviconSet \| FaviconsConfig` | Multi-device favicons |

### Social Sharing

#### Open Graph (Facebook/LinkedIn)

```yaml
meta:
  openGraph:
    title: 'Page Title'
    description: 'Page description'
    type: 'website'
    url: 'https://example.com'
    image: 'https://example.com/og-image.jpg'
    siteName: 'Site Name'
```

#### Twitter Card

```yaml
meta:
  twitter:
    card: 'summary_large_image'
    title: 'Page Title'
    description: 'Page description'
    image: 'https://example.com/twitter-image.jpg'
    site: '@username'
```

### Structured Data (Schema.org)

Supports multiple Schema.org types:

| Type             | File                 | Use Case            |
| ---------------- | -------------------- | ------------------- |
| `Article`        | `article.ts`         | Blog posts, news    |
| `Breadcrumb`     | `breadcrumb.ts`      | Navigation path     |
| `FAQPage`        | `faq-page.ts`        | FAQ sections        |
| `Product`        | `product.ts`         | E-commerce products |
| `Organization`   | `organization.ts`    | Company info        |
| `LocalBusiness`  | `local-business.ts`  | Physical locations  |
| `Person`         | `person.ts`          | Author profiles     |
| `EducationEvent` | `education-event.ts` | Courses, webinars   |
| `PostalAddress`  | `postal-address.ts`  | Address data        |

### Performance Hints

| Property      | Type            | Description                  |
| ------------- | --------------- | ---------------------------- |
| `preload`     | `PreloadSchema` | Critical resource preloading |
| `dnsPrefetch` | `string[]`      | DNS prefetch hints           |

### Analytics

```yaml
meta:
  analytics:
    providers:
      - name: 'google'
        enabled: true
        config:
          trackingId: 'G-XXXXXXXXXX'
```

---

## Sections

**Location**: `src/domain/models/app/page/sections.ts`

### Section Patterns

Sections support three patterns:

1. **Direct Component**: Inline definition
2. **Simple Block Reference**: Reference by name
3. **Block Reference with Variables**: Reference with substitution

```yaml
sections:
  # Direct component
  - type: 'section'
    props:
      id: 'hero'
      className: 'min-h-screen bg-gradient'
    children:
      - type: 'h1'
        content: 'Welcome'

  # Simple block reference
  - block: 'shared-block'

  # Block reference with variables
  - $ref: 'section-header'
    $vars:
      title: 'Our Features'
      subtitle: 'Everything you need'
```

### Component Types

| Category        | Types                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Layout**      | `section`, `container`, `flex`, `grid`, `div`, `modal`, `sidebar`, `hero`, `header`, `footer`, `main`, `article`, `aside`, `nav` |
| **Content**     | `text`, `heading`, `paragraph`, `h1`-`h6`, `icon`, `image`, `avatar`, `thumbnail`, `span`, `p`, `code`, `pre`                    |
| **Interactive** | `button`, `link`, `a`, `accordion`, `dropdown`                                                                                   |
| **Grouping**    | `card`, `card-header`, `card-body`, `card-footer`, `badge`, `timeline`, `list`, `list-item`                                      |
| **Media**       | `video`, `audio`, `iframe`                                                                                                       |
| **Forms**       | `form`, `input`                                                                                                                  |
| **Feedback**    | `toast`, `spinner`, `alert`                                                                                                      |

### Interactions

Components support interactive behaviors:

| Type       | File                    | Description          |
| ---------- | ----------------------- | -------------------- |
| `click`    | `click-interaction.ts`  | Click handlers       |
| `hover`    | `hover-interaction.ts`  | Hover effects        |
| `scroll`   | `scroll-interaction.ts` | Scroll-triggered     |
| `entrance` | `entrance-animation.ts` | Page load animations |

### Responsive Design

Override props per breakpoint:

```yaml
sections:
  - type: 'section'
    props:
      className: 'py-8'
    responsive:
      md:
        props:
          className: 'py-16'
      lg:
        props:
          className: 'py-24'
```

---

## Scripts

**Location**: `src/domain/models/app/page/scripts/`

| Property   | Type     | Description                     |
| ---------- | -------- | ------------------------------- |
| `features` | `Object` | Feature flags (analytics, chat) |
| `external` | `Array`  | External CDN scripts            |
| `inline`   | `Array`  | Custom inline JavaScript        |

```yaml
scripts:
  features:
    analytics: true
    chatWidget: true
  external:
    - src: 'https://cdn.example.com/library.js'
      async: true
  inline:
    - content: "console.log('Hello')"
      position: 'head'
```

---

## E2E Test Coverage

### Core Page Tests

| Spec File                          | Tests | Status  | Description            |
| ---------------------------------- | ----- | ------- | ---------------------- |
| `specs/app/pages/pages.spec.ts`    | ~10   | 🟢 100% | Page schema validation |
| `specs/app/pages/id.spec.ts`       | ~5    | 🟢 100% | Page ID validation     |
| `specs/app/pages/name.spec.ts`     | ~5    | 🟢 100% | Page name validation   |
| `specs/app/pages/path.spec.ts`     | ~5    | 🟢 100% | URL path validation    |
| `specs/app/pages/sections.spec.ts` | ~10   | 🟢 100% | Sections array         |

### Layout Tests (7 files)

| Spec File                              | Tests | Status  |
| -------------------------------------- | ----- | ------- |
| `layout/layout.spec.ts`                | ~5    | 🟢 100% |
| `layout/banner.spec.ts`                | ~5    | 🟢 100% |
| `layout/navigation/navigation.spec.ts` | ~10   | 🟢 100% |
| `layout/navigation/nav-links.spec.ts`  | ~5    | 🟢 100% |
| `layout/navigation/cta-button.spec.ts` | ~5    | 🟢 100% |
| `layout/footer.spec.ts`                | ~5    | 🟢 100% |
| `layout/sidebar.spec.ts`               | ~5    | 🟢 100% |

### Meta Tests (18 files)

| Category             | Files | Tests | Status  |
| -------------------- | ----- | ----- | ------- |
| Core meta            | 1     | ~5    | 🟢 100% |
| Favicons             | 2     | ~10   | 🟢 100% |
| Social (OG, Twitter) | 2     | ~10   | 🟢 100% |
| Structured data      | 10    | ~50   | 🟢 100% |
| Performance          | 2     | ~10   | 🟢 100% |
| Analytics            | 1     | ~5    | 🟢 100% |
| Custom elements      | 1     | ~5    | 🟢 100% |

### Scripts Tests (4 files)

| Spec File                          | Tests | Status  |
| ---------------------------------- | ----- | ------- |
| `scripts/scripts.spec.ts`          | ~5    | 🟢 100% |
| `scripts/features.spec.ts`         | ~5    | 🟢 100% |
| `scripts/external-scripts.spec.ts` | ~5    | 🟢 100% |
| `scripts/inline-scripts.spec.ts`   | ~5    | 🟢 100% |

### Common Tests (8 files)

| Spec File                                        | Tests | Status  |
| ------------------------------------------------ | ----- | ------- |
| `common/responsive.spec.ts`                      | ~5    | 🟢 100% |
| `common/variable-reference.spec.ts`              | ~5    | 🟢 100% |
| `common/interactions/interactions.spec.ts`       | ~5    | 🟢 100% |
| `common/interactions/click-interaction.spec.ts`  | ~5    | 🟢 100% |
| `common/interactions/hover-interaction.spec.ts`  | ~5    | 🟢 100% |
| `common/interactions/scroll-interaction.spec.ts` | ~5    | 🟢 100% |
| `common/interactions/entrance-animation.spec.ts` | ~5    | 🟢 100% |
| `common/props.spec.ts`                           | ~5    | 🟢 100% |
| `common/definitions.spec.ts`                     | ~5    | 🟢 100% |

**Total**: 44 spec files, ~200 tests

---

## Implementation Status

**Overall**: 🟢 100%

| Category          | Status | Notes                               |
| ----------------- | ------ | ----------------------------------- |
| Page schema       | ✅     | Complete with all properties        |
| Layout components | ✅     | Banner, navigation, footer, sidebar |
| Meta (SEO)        | ✅     | Full SEO support                    |
| Social sharing    | ✅     | Open Graph, Twitter Card            |
| Structured data   | ✅     | 9 Schema.org types                  |
| Scripts           | ✅     | Features, external, inline          |
| Interactions      | ✅     | Click, hover, scroll, entrance      |
| Responsive        | ✅     | Breakpoint overrides                |

---

## Use Cases

### Example 1: Minimal Landing Page

```yaml
pages:
  - name: 'home'
    path: '/'
    meta:
      title: 'Welcome to Our Platform'
      description: 'Build amazing applications'
    sections:
      - type: 'section'
        props:
          className: 'min-h-screen flex items-center'
        children:
          - type: 'h1'
            content: 'Welcome'
```

### Example 2: Marketing Page with Layout

```yaml
pages:
  - name: 'home'
    path: '/'
    meta:
      lang: 'en-US'
      title: 'Welcome'
      description: 'Build amazing applications'
      openGraph:
        title: 'Welcome to Our Platform'
        type: 'website'
        image: 'https://example.com/og.jpg'
    layout:
      navigation:
        logo: './logo.svg'
        links:
          desktop:
            - label: 'Features'
              href: '/features'
            - label: 'Pricing'
              href: '/pricing'
        cta:
          text: 'Get Started'
          href: '/signup'
      footer:
        enabled: true
        copyright: '© 2024 Company Inc.'
    sections:
      - $ref: 'hero'
        $vars:
          title: 'Build Something Amazing'
          cta: 'Start Free Trial'
      - $ref: 'features'
      - $ref: 'pricing'
```

### Example 3: Documentation Page

```yaml
pages:
  - name: 'docs-intro'
    path: '/docs/introduction'
    meta:
      title: 'Introduction - Documentation'
      description: 'Getting started guide'
      schema:
        breadcrumb:
          - name: 'Home'
            item: '/'
          - name: 'Documentation'
            item: '/docs'
          - name: 'Introduction'
    layout:
      navigation:
        logo: './logo.svg'
        sticky: true
        search:
          enabled: true
          placeholder: 'Search docs...'
      sidebar:
        enabled: true
        position: 'left'
        items:
          - type: 'link'
            label: 'Introduction'
            href: '/docs/introduction'
          - type: 'group'
            label: 'Getting Started'
            children:
              - type: 'link'
                label: 'Installation'
                href: '/docs/installation'
      footer:
        enabled: true
    sections:
      - type: 'article'
        children:
          - type: 'h1'
            content: 'Introduction'
          - type: 'p'
            content: 'Welcome to the documentation.'
```

---

## Related Features

- [Blocks](./blocks.md) - Reusable component definitions
- [Theme](./theme.md) - Design tokens used in pages
- [Languages](./languages.md) - i18n configuration for translations

## Related Documentation

- [Tailwind CSS](../infrastructure/ui/tailwind.md) - CSS framework integration
- [CSS Compiler](../infrastructure/css/css-compiler.md) - How themes compile to CSS
- [React](../infrastructure/ui/react.md) - UI rendering
