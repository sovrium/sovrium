# Building Static Sites

> **Feature Area**: CLI - Static Site Generation
> **Schema**: `src/domain/models/cli/`
> **E2E Specs**: `specs/cli/build/`

---

## Overview

Sovrium provides a CLI command `sovrium build` to generate static HTML, CSS, and assets from a configuration file. The build process generates optimized files suitable for deployment to static hosting platforms like GitHub Pages, Netlify, or any CDN.

---

## US-CLI-BUILD-001: Static Site Generation

**As a** developer,
**I want to** build a static version of my Sovrium application,
**so that** I can deploy it to any static hosting platform.

### CLI Usage

```bash
# Build static site from config
sovrium build app.yaml

# Build to custom output directory
sovrium build app.yaml --output dist

# Build with base path for subdirectory deployment
sovrium build app.yaml --base /my-app
```

### Configuration

```yaml
# app.yaml
name: My Static Site
pages:
  - id: 1
    name: home
    path: /
    title: Home
  - id: 2
    name: about
    path: /about
    title: About Us
  - id: 3
    name: blog
    path: /blog/posts
    title: Blog Posts

theme:
  colors:
    primary: '#3b82f6'
```

### Acceptance Criteria

| ID     | Criterion                           | E2E Spec                   |
| ------ | ----------------------------------- | -------------------------- |
| AC-001 | Generates HTML files for all pages  | `CLI-BUILD-GENERATION-001` |
| AC-002 | Generates valid HTML with DOCTYPE   | `CLI-BUILD-GENERATION-002` |
| AC-003 | Compiles CSS with theme tokens      | `CLI-BUILD-GENERATION-003` |
| AC-004 | Creates proper directory structure  | `CLI-BUILD-GENERATION-004` |
| AC-005 | Handles nested page paths correctly | `CLI-BUILD-GENERATION-005` |
| AC-006 | Generates well-formatted HTML       | `CLI-BUILD-GENERATION-006` |

### Implementation References

- **Schema**: `src/domain/models/cli/build.ts`
- **E2E Spec**: `specs/cli/build/generation.spec.ts`

---

## US-CLI-BUILD-002: Asset Management

**As a** developer,
**I want to** include static assets in my build,
**so that** images, fonts, and other files are available in the deployed site.

### Configuration

```
project/
├── app.yaml
├── public/
│   ├── images/
│   │   ├── logo.png
│   │   └── hero.jpg
│   ├── fonts/
│   │   └── custom.woff2
│   └── favicon.ico
```

### Acceptance Criteria

| ID     | Criterion                                | E2E Spec               |
| ------ | ---------------------------------------- | ---------------------- |
| AC-001 | Copies files from public/ directory      | `CLI-BUILD-ASSETS-001` |
| AC-002 | Preserves directory structure            | `CLI-BUILD-ASSETS-002` |
| AC-003 | Handles binary files correctly           | `CLI-BUILD-ASSETS-003` |
| AC-004 | Updates asset references in HTML and CSS | `CLI-BUILD-ASSETS-004` |

### Implementation References

- **Schema**: `src/domain/models/cli/build.ts`
- **E2E Spec**: `specs/cli/build/assets.spec.ts`

---

## US-CLI-BUILD-003: Deployment Files

**As a** developer,
**I want to** generate deployment-specific files,
**so that** my site works correctly on various hosting platforms.

### Configuration

```yaml
# app.yaml
name: My Site
deployment:
  platform: github-pages
  basePath: /my-repo
  customDomain: example.com
```

### Generated Files

```
dist/
├── .nojekyll          # Tells GitHub Pages not to use Jekyll
├── CNAME              # Custom domain (if configured)
├── sitemap.xml        # SEO sitemap
├── robots.txt         # Search engine directives
└── index.html         # Main page
```

### Acceptance Criteria

| ID     | Criterion                                  | E2E Spec               |
| ------ | ------------------------------------------ | ---------------------- |
| AC-001 | Generates .nojekyll for GitHub Pages       | `CLI-BUILD-DEPLOY-001` |
| AC-002 | Generates sitemap.xml                      | `CLI-BUILD-DEPLOY-002` |
| AC-003 | Generates robots.txt                       | `CLI-BUILD-DEPLOY-003` |
| AC-004 | Handles base path configuration            | `CLI-BUILD-DEPLOY-004` |
| AC-005 | Generates CNAME for custom domains         | `CLI-BUILD-DEPLOY-005` |
| AC-006 | Does NOT generate CNAME for github.io URLs | `CLI-BUILD-DEPLOY-006` |

### Implementation References

- **Schema**: `src/domain/models/cli/build.ts`
- **E2E Spec**: `specs/cli/build/deployment.spec.ts`

---

## US-CLI-BUILD-004: Multi-Language Build

**As a** developer,
**I want to** build a multi-language static site,
**so that** users can access content in their preferred language.

### Configuration

```yaml
# app.yaml
name: Multi-Language Site
languages:
  - code: en
    name: English
    default: true
  - code: fr
    name: Français
  - code: es
    name: Español

pages:
  - id: 1
    name: home
    path: /
    translations:
      en: Welcome
      fr: Bienvenue
      es: Bienvenido
```

### Generated Structure

```
dist/
├── en/
│   └── index.html     # English version
├── fr/
│   └── index.html     # French version
├── es/
│   └── index.html     # Spanish version
└── index.html         # Default language redirect
```

### Acceptance Criteria

| ID     | Criterion                             | E2E Spec             |
| ------ | ------------------------------------- | -------------------- |
| AC-001 | Generates language directories        | `CLI-BUILD-I18N-001` |
| AC-002 | Creates language-specific HTML files  | `CLI-BUILD-I18N-002` |
| AC-003 | Generates hreflang links in HTML head | `CLI-BUILD-I18N-003` |
| AC-004 | Creates language switcher links       | `CLI-BUILD-I18N-004` |

### Implementation References

- **Schema**: `src/domain/models/cli/build.ts`
- **E2E Spec**: `specs/cli/build/i18n.spec.ts`

---

## Regression Tests

| Spec ID                           | Workflow                              | Status |
| --------------------------------- | ------------------------------------- | ------ |
| `CLI-BUILD-GENERATION-REGRESSION` | Developer generates static site       | `[x]`  |
| `CLI-BUILD-ASSETS-REGRESSION`     | Developer manages static assets       | `[x]`  |
| `CLI-BUILD-DEPLOY-REGRESSION`     | Developer deploys to hosting platform | `[x]`  |
| `CLI-BUILD-I18N-REGRESSION`       | Developer builds multi-language site  | `[x]`  |

---

## Coverage Summary

| User Story       | Title                | Spec Count            | Status   |
| ---------------- | -------------------- | --------------------- | -------- |
| US-CLI-BUILD-001 | Static Generation    | 6                     | Complete |
| US-CLI-BUILD-002 | Asset Management     | 4                     | Complete |
| US-CLI-BUILD-003 | Deployment Files     | 6                     | Complete |
| US-CLI-BUILD-004 | Multi-Language Build | 4                     | Complete |
| **Total**        |                      | **20 + 4 regression** |          |
