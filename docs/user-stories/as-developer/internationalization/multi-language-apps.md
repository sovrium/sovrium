# Multi-Language Applications

> **Feature Area**: Internationalization (i18n)
> **Schema**: `src/domain/models/app/languages/`
> **E2E Specs**: `specs/app/languages/`

---

## Overview

Sovrium provides built-in internationalization support for multi-language applications. Languages can be configured with translations, default locale, fallback behavior, and locale detection strategies. Content can be localized using translation keys and the framework handles RTL layouts automatically.

---

## US-I18N-001: Configure Languages

**As a** developer,
**I want to** configure multiple languages for my application,
**so that** users can access content in their preferred language.

### Configuration

```yaml
languages:
  - code: en
    name: English
    default: true
    direction: ltr
  - code: fr
    name: Français
    direction: ltr
  - code: ar
    name: العربية
    direction: rtl
  - code: es
    name: Español
    direction: ltr
  - code: zh
    name: 中文
    direction: ltr

settings:
  i18n:
    fallbackLocale: en
    detection:
      order:
        - querystring
        - cookie
        - header
      lookupQuerystring: lang
      lookupCookie: locale
```

### Acceptance Criteria

| ID     | Criterion                                 | E2E Spec            |
| ------ | ----------------------------------------- | ------------------- |
| AC-001 | Languages array defines available locales | `APP-LANGUAGES-001` |
| AC-002 | Default language is required              | `APP-LANGUAGES-002` |
| AC-003 | Only one language can be default          | `APP-LANGUAGES-003` |
| AC-004 | Language code must be unique              | `APP-LANGUAGES-004` |
| AC-005 | Language code follows ISO 639-1           | `APP-LANGUAGES-005` |
| AC-006 | Language name is displayed in UI          | `APP-LANGUAGES-006` |
| AC-007 | RTL direction is applied correctly        | `APP-LANGUAGES-007` |
| AC-008 | LTR direction is default                  | `APP-LANGUAGES-008` |
| AC-009 | Empty languages array returns error       | `APP-LANGUAGES-009` |
| AC-010 | Fallback locale is used when missing      | `APP-LANGUAGES-010` |
| AC-011 | Querystring detection works               | `APP-LANGUAGES-011` |
| AC-012 | Cookie detection works                    | `APP-LANGUAGES-012` |
| AC-013 | Header detection works (Accept-Language)  | `APP-LANGUAGES-013` |
| AC-014 | Detection order is respected              | `APP-LANGUAGES-014` |
| AC-015 | Invalid language code returns error       | `APP-LANGUAGES-015` |

### Implementation References

- **Schema**: `src/domain/models/app/languages/languages.ts`
- **E2E Spec**: `specs/app/languages/languages.spec.ts`

---

## US-I18N-002: Translation Keys

**As a** developer,
**I want to** define translation keys and values,
**so that** content can be localized for each language.

### Configuration

```yaml
languages:
  - code: en
    name: English
    default: true
    translations:
      common:
        welcome: Welcome
        signIn: Sign In
        signOut: Sign Out
        loading: Loading...
      home:
        title: Build Amazing Apps
        subtitle: The platform for modern applications
      errors:
        notFound: Page not found
        serverError: Something went wrong
  - code: fr
    name: Français
    translations:
      common:
        welcome: Bienvenue
        signIn: Se connecter
        signOut: Se déconnecter
        loading: Chargement...
      home:
        title: Créez des applications incroyables
        subtitle: La plateforme pour les applications modernes
      errors:
        notFound: Page non trouvée
        serverError: Une erreur s'est produite
```

### Acceptance Criteria

| ID     | Criterion                                  | E2E Spec            |
| ------ | ------------------------------------------ | ------------------- |
| AC-001 | Translation key returns translated value   | `APP-LANGUAGES-016` |
| AC-002 | Nested translation keys are supported      | `APP-LANGUAGES-017` |
| AC-003 | Missing key returns key itself             | `APP-LANGUAGES-018` |
| AC-004 | Missing key falls back to default language | `APP-LANGUAGES-019` |
| AC-005 | Interpolation with variables works         | `APP-LANGUAGES-020` |
| AC-006 | Pluralization is supported                 | `APP-LANGUAGES-021` |
| AC-007 | Date formatting respects locale            | `APP-LANGUAGES-022` |
| AC-008 | Number formatting respects locale          | `APP-LANGUAGES-023` |
| AC-009 | Currency formatting respects locale        | `APP-LANGUAGES-024` |
| AC-010 | Translation function is available in pages | `APP-LANGUAGES-025` |
| AC-011 | HTML in translations is escaped by default | `APP-LANGUAGES-026` |
| AC-012 | Raw HTML can be rendered with flag         | `APP-LANGUAGES-027` |
| AC-013 | Translation keys support dot notation      | `APP-LANGUAGES-028` |
| AC-014 | Missing translations are logged in dev     | `APP-LANGUAGES-029` |

### Implementation References

- **Schema**: `src/domain/models/app/languages/translations.ts`
- **E2E Spec**: `specs/app/languages/translations.spec.ts`

---

## US-I18N-003: Language Switching

**As a** developer,
**I want to** allow users to switch languages,
**so that** they can view content in their preferred language.

### Configuration

```yaml
settings:
  i18n:
    persistLocale: true # Remember user's choice
    storage: cookie # cookie | localStorage
    urlStrategy: prefix # prefix (/en/page) | subdomain (en.site.com) | querystring (?lang=en)
```

### Acceptance Criteria

| ID     | Criterion                                    | E2E Spec                   |
| ------ | -------------------------------------------- | -------------------------- |
| AC-001 | Language can be changed at runtime           | `APP-LANGUAGES-CONFIG-001` |
| AC-002 | Language choice is persisted in cookie       | `APP-LANGUAGES-CONFIG-002` |
| AC-003 | Language choice is persisted in localStorage | `APP-LANGUAGES-CONFIG-003` |
| AC-004 | URL prefix strategy works                    | `APP-LANGUAGES-CONFIG-004` |
| AC-005 | Subdomain strategy works                     | `APP-LANGUAGES-CONFIG-005` |
| AC-006 | Querystring strategy works                   | `APP-LANGUAGES-CONFIG-006` |
| AC-007 | Page content updates on language change      | `APP-LANGUAGES-CONFIG-007` |
| AC-008 | SEO meta tags update on language change      | `APP-LANGUAGES-CONFIG-008` |

### Implementation References

- **Schema**: `src/domain/models/app/languages/config.ts`
- **E2E Spec**: `specs/app/languages/config.spec.ts`

---

## Regression Tests

| Spec ID                           | Workflow                                     | Status |
| --------------------------------- | -------------------------------------------- | ------ |
| `APP-LANGUAGES-REGRESSION`        | Developer sets up multi-language application | `[x]`  |
| `APP-LANGUAGES-CONFIG-REGRESSION` | User switches languages and content updates  | `[x]`  |

---

## Coverage Summary

| User Story  | Title               | Spec Count            | Status   |
| ----------- | ------------------- | --------------------- | -------- |
| US-I18N-001 | Configure Languages | 15                    | Complete |
| US-I18N-002 | Translation Keys    | 14                    | Complete |
| US-I18N-003 | Language Switching  | 8                     | Complete |
| **Total**   |                     | **37 + 2 regression** |          |
