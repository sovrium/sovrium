# Multi-Language Applications

> **Feature Area**: Internationalization (i18n)
> **Schema**: `src/domain/models/app/language/`, `src/domain/models/app/languages.ts`
> **E2E Specs**: `specs/app/languages/`

---

## Overview

Sovrium provides built-in internationalization support for multi-language applications. Languages can be configured with translations, default locale, fallback behavior, and locale detection strategies. Content can be localized using translation keys and the framework handles RTL layouts automatically.

---

## US-INTL-LANG-001: Basic Language Configuration

**As a** developer,
**I want to** configure multiple languages for my application,
**so that** users can access content in their preferred language.

### Configuration

```yaml
languages:
  default: en
  supported:
    - code: en
      locale: en-US
      label: English
      direction: ltr
    - code: fr
      locale: fr-FR
      label: Français
      direction: ltr
    - code: ar
      locale: ar-SA
      label: العربية
      direction: rtl
```

### Acceptance Criteria

| ID     | Criterion                                                      | E2E Spec            | Status |
| ------ | -------------------------------------------------------------- | ------------------- | ------ |
| AC-001 | App uses English as the only available language                | `APP-LANGUAGES-001` | ✅     |
| AC-002 | User can switch between all supported languages                | `APP-LANGUAGES-002` | ✅     |
| AC-003 | App displays English fallback text when translation missing    | `APP-LANGUAGES-003` | ✅     |
| AC-004 | App automatically detects browser's preferred language         | `APP-LANGUAGES-004` | ✅     |
| AC-005 | App uses default language without auto-detection when disabled | `APP-LANGUAGES-005` | ✅     |
| AC-006 | App remembers language choice in localStorage                  | `APP-LANGUAGES-006` | ✅     |
| AC-007 | App does not persist choice when persistence disabled          | `APP-LANGUAGES-007` | ✅     |
| AC-008 | App flips between LTR and RTL direction based on language      | `APP-LANGUAGES-008` | ✅     |
| AC-009 | App displays all languages with native labels and flags        | `APP-LANGUAGES-009` | ✅     |
| AC-010 | App provides seamless multi-language UX with auto-detection    | `APP-LANGUAGES-010` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/languages/languages.spec.ts`

---

## US-INTL-LANG-002: Language Validation

**As a** developer,
**I want to** receive validation errors for invalid language configuration,
**so that** I can fix issues before deployment.

### Acceptance Criteria

| ID     | Criterion                                                      | E2E Spec            | Status |
| ------ | -------------------------------------------------------------- | ------------------- | ------ |
| AC-001 | Validation fails when default language not in supported array  | `APP-LANGUAGES-011` | ✅     |
| AC-002 | Validation fails when fallback language not in supported array | `APP-LANGUAGES-012` | ✅     |
| AC-003 | App automatically uses default language as fallback            | `APP-LANGUAGES-013` | ✅     |
| AC-004 | App shows English text when French translation is missing      | `APP-LANGUAGES-014` | ✅     |
| AC-005 | App applies RTL-aware theme tokens for Arabic/Hebrew           | `APP-LANGUAGES-015` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/languages/languages.spec.ts`

---

## US-INTL-LANG-003: Translation System

**As a** developer,
**I want to** define translation keys and values,
**so that** content can be localized for each language.

### Configuration

```yaml
translations:
  en:
    common:
      welcome: Welcome
      signIn: Sign In
    home:
      title: Build Amazing Apps
  fr:
    common:
      welcome: Bienvenue
      signIn: Se connecter
    home:
      title: Créez des applications incroyables
```

### Acceptance Criteria

| ID     | Criterion                                                      | E2E Spec            | Status |
| ------ | -------------------------------------------------------------- | ------------------- | ------ |
| AC-001 | App updates page metadata and content while maintaining state  | `APP-LANGUAGES-016` | ✅     |
| AC-002 | App generates localized meta tags and structured data          | `APP-LANGUAGES-017` | ✅     |
| AC-003 | App resolves translation keys from centralized dictionary      | `APP-LANGUAGES-018` | ✅     |
| AC-004 | App falls back to default language translation                 | `APP-LANGUAGES-019` | ✅     |
| AC-005 | App organizes translations by feature for maintainability      | `APP-LANGUAGES-020` | ✅     |
| AC-006 | App resolves translation tokens in children arrays during SSR  | `APP-LANGUAGES-021` | ✅     |
| AC-007 | App resolves translation tokens in component props during SSR  | `APP-LANGUAGES-022` | ✅     |
| AC-008 | App resolves translation tokens in content property during SSR | `APP-LANGUAGES-023` | ✅     |
| AC-009 | App has no $t: symbols anywhere in rendered HTML output        | `APP-LANGUAGES-024` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/languages/languages.spec.ts`

---

## US-INTL-LANG-004: Language URL Routing

**As a** developer,
**I want to** configure URL-based language routing,
**so that** users can access localized content via language-prefixed URLs.

### Configuration

```yaml
settings:
  i18n:
    urlStrategy: prefix # /en/page, /fr/page
```

### Acceptance Criteria

| ID     | Criterion                                                      | E2E Spec                   | Status |
| ------ | -------------------------------------------------------------- | -------------------------- | ------ |
| AC-001 | App serves / with default language (cacheable)                 | `APP-LANGUAGES-025`        | ✅     |
| AC-002 | App redirects from / to /:lang/ when detected language differs | `APP-LANGUAGES-026`        | ✅     |
| AC-003 | App renders homepage at /:lang/ with correct language          | `APP-LANGUAGES-027`        | ✅     |
| AC-004 | User navigates between language subdirectories when switching  | `APP-LANGUAGES-028`        | ✅     |
| AC-005 | App returns 404 for invalid language subdirectory              | `APP-LANGUAGES-029`        | ✅     |
| AC-006 | User can complete full languages workflow (regression)         | `APP-LANGUAGES-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/languages/languages.spec.ts`

---

## US-INTL-LANG-005: Language Configuration Properties

**As a** developer,
**I want to** configure individual language properties,
**so that** each language displays correctly with appropriate labels, flags, and text direction.

### Configuration

```yaml
languages:
  supported:
    - code: en
      locale: en-US
      label: English
      direction: ltr
      flag: /flags/en.svg
    - code: ar
      locale: ar-SA
      label: العربية
      direction: rtl
      flag: /flags/ar.svg
```

### Acceptance Criteria

| ID     | Criterion                                                     | E2E Spec                          | Status |
| ------ | ------------------------------------------------------------- | --------------------------------- | ------ |
| AC-001 | Language config is valid with LTR direction by default        | `APP-LANGUAGES-CONFIG-001`        | ✅     |
| AC-002 | Language config supports right-to-left text rendering         | `APP-LANGUAGES-CONFIG-002`        | ✅     |
| AC-003 | Language config is valid with 2-letter code                   | `APP-LANGUAGES-CONFIG-003`        | ✅     |
| AC-004 | Language config is valid with country-specific format (en-US) | `APP-LANGUAGES-CONFIG-004`        | ✅     |
| AC-005 | Language config displays the flag in language switcher        | `APP-LANGUAGES-CONFIG-005`        | ✅     |
| AC-006 | Language config loads the flag image from the path            | `APP-LANGUAGES-CONFIG-006`        | ✅     |
| AC-007 | Language config displays correctly in all character sets      | `APP-LANGUAGES-CONFIG-007`        | ✅     |
| AC-008 | Language config uses default LTR direction and no flag        | `APP-LANGUAGES-CONFIG-008`        | ✅     |
| AC-009 | User can complete full language-config workflow (regression)  | `APP-LANGUAGES-CONFIG-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/app/languages/language-config.spec.ts`

---

## US-INTL-LANG-006: Layout Component i18n

**As a** developer,
**I want to** use `$t:` translation tokens in layout configuration (navigation, footer),
**so that** layout text (navbar labels, CTA buttons, footer content) is localized alongside page content.

### Problem

The sections pipeline resolves `$t:key` translation tokens via `translation-handler.ts` and `translation-resolver.ts`. However, layout components (Navigation, Footer) receive their configuration directly from `PageLayout.tsx` **without** translation resolution. This means `$t:` tokens in layout configuration render as literal strings (e.g., `$t:nav.home` appears verbatim in the UI instead of "Home" or "Accueil").

### Affected Schema Fields

**Navigation** (`src/domain/models/app/page/layout/navigation.ts`):

| Field                            | Schema                             | Example `$t:` Usage             |
| -------------------------------- | ---------------------------------- | ------------------------------- |
| `logoAlt`                        | `NavigationSchema.logoAlt`         | `$t:nav.logoAlt`                |
| `links[].label`                  | `NavLinkSchema.label`              | `$t:nav.home`, `$t:nav.pricing` |
| `links[].badge`                  | `NavLinkSchema.badge`              | `$t:nav.badge.new`              |
| `links[].children[].label`       | `NavLinkSchema.children[].label`   | `$t:nav.products.a`             |
| `cta.text`                       | `CtaButtonSchema.text`             | `$t:nav.cta.getStarted`         |
| `search.placeholder`             | `SearchConfigSchema.placeholder`   | `$t:nav.search.placeholder`     |
| `languageSwitcher.label`         | `LanguageSwitcherSchema.label`     | `$t:lang.switch`                |
| `languageSwitcher.items[].label` | `LanguageSwitcherItemSchema.label` | `$t:lang.en`, `$t:lang.fr`      |

**Footer** (`src/domain/models/app/page/layout/footer.ts`):

| Field                     | Schema                         | Example `$t:` Usage           |
| ------------------------- | ------------------------------ | ----------------------------- |
| `description`             | `FooterSchema.description`     | `$t:footer.description`       |
| `copyright`               | `FooterSchema.copyright`       | `$t:footer.copyright`         |
| `columns[].title`         | `FooterColumnSchema.title`     | `$t:footer.col.company`       |
| `columns[].links[].label` | `FooterLinkSchema.label`       | `$t:footer.link.about`        |
| `social.title`            | `SocialSectionSchema.title`    | `$t:footer.social.title`      |
| `newsletter.title`        | `NewsletterSchema.title`       | `$t:footer.newsletter.title`  |
| `newsletter.description`  | `NewsletterSchema.description` | `$t:footer.newsletter.desc`   |
| `newsletter.placeholder`  | `NewsletterSchema.placeholder` | `$t:footer.newsletter.email`  |
| `newsletter.buttonText`   | `NewsletterSchema.buttonText`  | `$t:footer.newsletter.submit` |
| `legal[].label`           | `FooterLinkSchema.label`       | `$t:footer.legal.privacy`     |

### Configuration

```yaml
languages:
  default: en
  supported:
    - code: en
      locale: en-US
      label: English
      direction: ltr
    - code: fr
      locale: fr-FR
      label: Français
      direction: ltr
  translations:
    en:
      nav:
        home: Home
        features: Features
        pricing: Pricing
        cta: Get Started
        search: Search docs...
      footer:
        description: Build amazing applications with Sovrium.
        copyright: 2025 Sovrium. All rights reserved.
        col:
          company: Company
          resources: Resources
        link:
          about: About Us
          blog: Blog
          docs: Documentation
        newsletter:
          title: Stay Updated
          desc: Get the latest news and updates.
          email: Enter your email
          submit: Subscribe
    fr:
      nav:
        home: Accueil
        features: Fonctionnalites
        pricing: Tarifs
        cta: Commencer
        search: Rechercher...
      footer:
        description: Creez des applications avec Sovrium.
        copyright: 2025 Sovrium. Tous droits reserves.
        col:
          company: Entreprise
          resources: Ressources
        link:
          about: A propos
          blog: Blog
          docs: Documentation
        newsletter:
          title: Restez informe
          desc: Recevez les dernieres nouvelles.
          email: Votre adresse email
          submit: S'abonner

pages:
  - name: home
    path: /
    layout:
      navigation:
        logo: ./public/logo.svg
        logoAlt: Sovrium Logo
        links:
          desktop:
            - label: $t:nav.home
              href: /
            - label: $t:nav.features
              href: /features
            - label: $t:nav.pricing
              href: /pricing
        cta:
          text: $t:nav.cta
          href: /signup
          variant: primary
        search:
          enabled: true
          placeholder: $t:nav.search
      footer:
        enabled: true
        description: $t:footer.description
        copyright: $t:footer.copyright
        columns:
          - title: $t:footer.col.company
            links:
              - label: $t:footer.link.about
                href: /about
          - title: $t:footer.col.resources
            links:
              - label: $t:footer.link.docs
                href: /docs
        newsletter:
          enabled: true
          title: $t:footer.newsletter.title
          description: $t:footer.newsletter.desc
          placeholder: $t:footer.newsletter.email
          buttonText: $t:footer.newsletter.submit
    sections: []
```

### Acceptance Criteria

| ID     | Criterion                                                             | E2E Spec                     | Status |
| ------ | --------------------------------------------------------------------- | ---------------------------- | ------ |
| AC-001 | Navigation link labels resolve `$t:` tokens to current language       | `APP-LAYOUT-I18N-001`        | [ ]    |
| AC-002 | Navigation CTA button text resolves `$t:` token                       | `APP-LAYOUT-I18N-002`        | [ ]    |
| AC-003 | Navigation search placeholder resolves `$t:` token                    | `APP-LAYOUT-I18N-003`        | [ ]    |
| AC-004 | Language switcher label and item labels resolve `$t:` tokens          | `APP-LAYOUT-I18N-004`        | [ ]    |
| AC-005 | Footer description resolves `$t:` token                               | `APP-LAYOUT-I18N-005`        | [ ]    |
| AC-006 | Footer column titles resolve `$t:` tokens                             | `APP-LAYOUT-I18N-006`        | [ ]    |
| AC-007 | Footer link labels resolve `$t:` tokens                               | `APP-LAYOUT-I18N-007`        | [ ]    |
| AC-008 | Footer copyright resolves `$t:` token                                 | `APP-LAYOUT-I18N-008`        | [ ]    |
| AC-009 | Footer newsletter text fields resolve `$t:` tokens                    | `APP-LAYOUT-I18N-009`        | [ ]    |
| AC-010 | Layout updates text when user switches language                       | `APP-LAYOUT-I18N-010`        | [ ]    |
| AC-011 | Layout falls back to default language when translation key is missing | `APP-LAYOUT-I18N-011`        | [ ]    |
| AC-012 | No `$t:` symbols remain in rendered layout HTML                       | `APP-LAYOUT-I18N-012`        | [ ]    |
| AC-013 | User can complete full layout i18n workflow (regression)              | `APP-LAYOUT-I18N-REGRESSION` | [ ]    |

### Implementation Notes

- **Root cause**: `PageLayout.tsx` passes layout config to `Navigation`/`Footer` without calling `substitutePropsTranslationTokens()`. `DynamicPage.tsx` passes `languages`/`currentLang` to `PageMain`/`SectionRenderer` but not to `PageLayout`.
- **Schema compatibility**: All affected fields already use `Schema.String`, which accepts `$t:key` strings. No schema modifications needed.
- **JSDoc already shows `$t:` examples**: `LanguageSwitcherSchema` documentation shows `label: '$t:lang.switch'` pattern, confirming design intent.
- **Static build works**: `specs/cli/build/i18n.spec.ts` (CLI-BUILD-I18N-004) confirms `$t:` tokens in navigation labels resolve correctly during static site generation. The gap is only in the SSR/dynamic server rendering path.
- **Implementation approach**: `PageLayout.tsx` (or its parent) needs to receive `languages` and `currentLang` props and run translation resolution on layout config before passing to `Navigation`/`Footer`.

### Implementation References

- **E2E Spec**: `specs/app/pages/layout/layout-i18n.spec.ts`
- **Translation pipeline**: `src/presentation/components/sections/translations/translation-handler.ts`
- **Translation resolver**: `src/domain/utils/translation-resolver.ts`

---

## Regression Tests

| Spec ID                           | Workflow                                         | Status |
| --------------------------------- | ------------------------------------------------ | ------ |
| `APP-LANGUAGES-REGRESSION`        | Developer sets up multi-language application     | ✅     |
| `APP-LANGUAGES-CONFIG-REGRESSION` | User configures language properties              | ✅     |
| `APP-LAYOUT-I18N-REGRESSION`      | Developer localizes layout components with `$t:` | [ ]    |

---

## Coverage Summary

| User Story       | Title                             | Spec Count | Status      |
| ---------------- | --------------------------------- | ---------- | ----------- |
| US-INTL-LANG-001 | Basic Language Configuration      | 10         | Complete    |
| US-INTL-LANG-002 | Language Validation               | 5          | Complete    |
| US-INTL-LANG-003 | Translation System                | 9          | Complete    |
| US-INTL-LANG-004 | Language URL Routing              | 6          | Complete    |
| US-INTL-LANG-005 | Language Configuration Properties | 9          | Complete    |
| US-INTL-LANG-006 | Layout Component i18n             | 12         | Not Started |
| **Total**        |                                   | **51**     |             |
