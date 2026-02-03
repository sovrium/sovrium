# Languages Specification

> Internationalization (i18n) configuration for multi-language applications

## Overview

The Languages configuration provides comprehensive multi-language support for Sovrium applications. It includes language metadata, URL routing, text direction (RTL/LTR), and a centralized translation system using the `$t:key` syntax.

**Vision Alignment**: Languages enable Sovrium's global-ready applications through configuration, allowing teams to support multiple languages without code changes.

## Schema Structure

**Location**: `src/domain/models/app/`

```
src/domain/models/app/
├── languages.ts                  # LanguagesSchema (main config)
└── language/
    └── language-config.ts        # LanguageConfigSchema (per-language)
```

---

## LanguagesSchema

**Location**: `src/domain/models/app/languages.ts`

Root configuration for multi-language support.

| Property           | Type               | Required | Description                          |
| ------------------ | ------------------ | -------- | ------------------------------------ |
| `default`          | `LanguageCode`     | Yes      | Default language code (e.g., `en`)   |
| `supported`        | `LanguageConfig[]` | Yes      | Array of supported languages (min 1) |
| `fallback`         | `LanguageCode`     | No       | Fallback when translation missing    |
| `detectBrowser`    | `boolean`          | No       | Auto-detect browser language         |
| `persistSelection` | `boolean`          | No       | Remember user's choice in storage    |
| `translations`     | `Translations`     | No       | Centralized translation dictionaries |

### Validation Rules

1. **Default language** must exist in `supported` array
2. **Fallback language** (if specified) must exist in `supported` array
3. **Translation keys** must only reference `supported` language codes

---

## LanguageConfigSchema

**Location**: `src/domain/models/app/language/language-config.ts`

Configuration for a single supported language.

| Property    | Type               | Required | Description                      |
| ----------- | ------------------ | -------- | -------------------------------- |
| `code`      | `LanguageCode`     | Yes      | Short code for URLs (e.g., `en`) |
| `locale`    | `LanguageLocale`   | No       | Full locale (e.g., `en-US`)      |
| `label`     | `string`           | Yes      | Human-readable name              |
| `direction` | `'ltr'` \| `'rtl'` | No       | Text direction (default: `ltr`)  |
| `flag`      | `string`           | No       | Flag emoji or icon path          |

### LanguageCode Format

| Pattern      | Description         | Examples               |
| ------------ | ------------------- | ---------------------- |
| `^[a-z]{2}$` | ISO 639-1 (2 chars) | `en`, `fr`, `es`, `ar` |

### LanguageLocale Format

| Pattern               | Description            | Examples                  |
| --------------------- | ---------------------- | ------------------------- |
| `^[a-z]{2}-[A-Z]{2}$` | ISO 639-1 + ISO 3166-1 | `en-US`, `fr-FR`, `ar-SA` |

### Text Direction

| Value | Description   | Languages                   |
| ----- | ------------- | --------------------------- |
| `ltr` | Left-to-right | English, French, Spanish... |
| `rtl` | Right-to-left | Arabic, Hebrew, Persian...  |

### Flag Options

| Type    | Example          | Description                     |
| ------- | ---------------- | ------------------------------- |
| Unicode | `🇺🇸`, `🇫🇷`, `🇪🇸` | Flag emojis (instant, no load)  |
| Path    | `/flags/us.svg`  | Custom icons (consistent style) |

---

## TranslationsSchema

**Location**: `src/domain/models/app/languages.ts`

Centralized translation dictionaries for all supported languages.

### Structure

```yaml
translations:
  en: # Language code
    common.save: Save # Translation key: value
    common.cancel: Cancel
    nav.home: Home
  fr:
    common.save: Enregistrer
    common.cancel: Annuler
    nav.home: Accueil
```

### TranslationKey Format

| Pattern             | Description                 | Examples                                |
| ------------------- | --------------------------- | --------------------------------------- |
| `^[a-zA-Z0-9._-]+$` | Alphanumeric + dots/hyphens | `common.save`, `nav.home`, `errors.404` |

### Translation Key Conventions

Use **namespaced keys** organized by feature:

| Namespace  | Purpose               | Examples                               |
| ---------- | --------------------- | -------------------------------------- |
| `common.*` | Shared across app     | `common.save`, `common.cancel`         |
| `nav.*`    | Navigation elements   | `nav.home`, `nav.about`, `nav.contact` |
| `auth.*`   | Authentication        | `auth.login`, `auth.logout`            |
| `errors.*` | Error messages        | `errors.404`, `errors.generic`         |
| `{page}.*` | Page-specific content | `homepage.hero.title`, `pricing.cta`   |

---

## Using Translations (`$t:key` Syntax)

Reference translations using `$t:key` syntax in any string property:

### In Page Content

```yaml
pages:
  - name: Home
    path: /
    sections:
      - type: heading
        content: $t:homepage.hero.title
      - type: text
        content: $t:homepage.hero.subtitle
      - type: button
        content: $t:common.get_started
```

### In Component Props

```yaml
sections:
  - type: button
    props:
      aria-label: $t:common.submit_form
    content: $t:common.submit
```

### In Meta Tags

```yaml
pages:
  - name: About
    path: /about
    meta:
      seo:
        title: $t:about.meta.title
        description: $t:about.meta.description
```

---

## E2E Test Coverage

| Spec File                                     | Tests | Status  | Description            |
| --------------------------------------------- | ----- | ------- | ---------------------- |
| `specs/app/languages/languages.spec.ts`       | ~10   | 🟢 100% | Root config validation |
| `specs/app/languages/language-config.spec.ts` | ~8    | 🟢 100% | Per-language config    |

**Total**: 2 spec files, ~18 tests

---

## Implementation Status

**Overall**: 🟢 100%

| Component          | Status | Notes                         |
| ------------------ | ------ | ----------------------------- |
| LanguagesSchema    | ✅     | Full config with validation   |
| LanguageConfig     | ✅     | Per-language metadata         |
| TranslationsSchema | ✅     | Centralized dictionaries      |
| `$t:key` Syntax    | ✅     | Works in any string property  |
| RTL Support        | ✅     | Direction attribute supported |
| Browser Detection  | ✅     | Optional auto-detection       |
| Persistence        | ✅     | localStorage support          |

---

## Use Cases

### Example 1: Minimal Configuration (Single Language)

```yaml
languages:
  default: en
  supported:
    - code: en
      label: English
```

### Example 2: Multi-Language with RTL Support

```yaml
languages:
  default: en
  supported:
    - code: en
      locale: en-US
      label: English
      direction: ltr
      flag: 🇺🇸
    - code: fr
      locale: fr-FR
      label: Français
      direction: ltr
      flag: 🇫🇷
    - code: ar
      locale: ar-SA
      label: العربية
      direction: rtl
      flag: 🇸🇦
  fallback: en
  detectBrowser: true
  persistSelection: true
```

### Example 3: Full Configuration with Translations

```yaml
languages:
  default: en
  supported:
    - code: en
      locale: en-US
      label: English
      flag: 🇺🇸
    - code: fr
      locale: fr-FR
      label: Français
      flag: 🇫🇷
    - code: es
      locale: es-ES
      label: Español
      flag: 🇪🇸
  fallback: en
  detectBrowser: true
  persistSelection: true
  translations:
    en:
      common.save: Save
      common.cancel: Cancel
      common.loading: Loading...
      nav.home: Home
      nav.about: About
      nav.contact: Contact
      homepage.hero.title: Welcome to Sovrium
      homepage.hero.subtitle: Build apps faster with configuration
      homepage.cta: Get Started
    fr:
      common.save: Enregistrer
      common.cancel: Annuler
      common.loading: Chargement...
      nav.home: Accueil
      nav.about: À propos
      nav.contact: Contact
      homepage.hero.title: Bienvenue sur Sovrium
      homepage.hero.subtitle: Créez des applications plus rapidement
      homepage.cta: Commencer
    es:
      common.save: Guardar
      common.cancel: Cancelar
      common.loading: Cargando...
      nav.home: Inicio
      nav.about: Acerca de
      nav.contact: Contacto
      homepage.hero.title: Bienvenido a Sovrium
      homepage.hero.subtitle: Crea aplicaciones más rápido
      homepage.cta: Empezar

pages:
  - name: Home
    path: /
    meta:
      seo:
        title: $t:homepage.hero.title
    sections:
      - type: section
        children:
          - type: heading
            props:
              level: 1
            content: $t:homepage.hero.title
          - type: text
            content: $t:homepage.hero.subtitle
          - type: button
            props:
              variant: primary
            content: $t:homepage.cta
```

### Example 4: Language Switcher Block

```yaml
blocks:
  - name: language-switcher
    type: flex
    props:
      gap: 2
    children:
      - type: button
        props:
          variant: ghost
          size: sm
          data-lang: $lang_code
        content: $lang_label

# Usage in navigation
pages:
  - name: Home
    path: /
    layout:
      navigation:
        children:
          - $ref: language-switcher
            vars:
              lang_code: en
              lang_label: EN
          - $ref: language-switcher
            vars:
              lang_code: fr
              lang_label: FR
```

---

## URL Routing Pattern

Language-aware URL routing uses the short code:

| URL Pattern      | Language | Example                      |
| ---------------- | -------- | ---------------------------- |
| `/`              | Default  | English (when `default: en`) |
| `/fr/`           | French   | Redirects French users       |
| `/es/about`      | Spanish  | Spanish "About" page         |
| `/{code}/{path}` | Any      | Dynamic routing pattern      |

### HTML Lang Attribute

The `locale` property sets the HTML lang attribute:

```html
<!-- en-US locale -->
<html
  lang="en-US"
  dir="ltr"
>
  <!-- ar-SA locale with RTL -->
  <html
    lang="ar-SA"
    dir="rtl"
  ></html>
</html>
```

---

## Related Features

- [Pages](./pages.md) - Pages that use `$t:key` syntax
- [Blocks](./blocks.md) - Blocks with translated content
- [Theme](./theme.md) - Design tokens (RTL-aware spacing)

## Related Documentation

- [i18n Centralized Translations](../architecture/patterns/i18n-centralized-translations.md) - Architecture pattern
- [CSS Compiler](../infrastructure/css/css-compiler.md) - RTL stylesheet generation
