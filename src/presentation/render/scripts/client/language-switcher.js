/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Client-side language switcher interactivity
 *
 * Immediately Invoked Function Expression (IIFE) that:
 * - Reads language configuration from data attribute
 * - Initializes language state
 * - Caches DOM elements for performance
 * - Handles dropdown toggle and language selection
 * - Updates UI when language changes
 *
 * CSP-compliant: No inline event handlers, runs from external file
 */
;(function () {
  'use strict'

  // Read language configuration from data attribute
  const configEl = document.querySelector('[data-language-switcher-config]')
  if (!configEl) {
    console.warn('Language switcher: missing data-language-switcher-config element')
    return
  }

  let languagesConfig
  try {
    languagesConfig = JSON.parse(configEl.dataset.languageSwitcherConfig || '{}')
  } catch (error) {
    console.error('Language switcher: failed to parse configuration', error)
    return
  }

  /**
   * Detect browser language from navigator.language
   * Supports exact match (e.g., 'fr-FR') and base language match (e.g., 'fr' from 'fr-FR')
   *
   * This function implements client-side language detection logic.
   * It runs in the browser as plain JS (no ES modules or bundling).
   */
  function detectBrowserLanguage(browserLang, supportedLanguages) {
    // Try exact match first (e.g., 'fr-FR' === 'fr-FR')
    const exactMatch = supportedLanguages.find((lang) => lang.code === browserLang)
    if (exactMatch) {
      return exactMatch.code
    }

    // Try base language match (e.g., 'fr' from 'fr-FR')
    const baseLang = browserLang.split('-')[0]
    const baseMatch = supportedLanguages.find((lang) => lang.code.split('-')[0] === baseLang)
    if (baseMatch) {
      return baseMatch.code
    }

    // No match found
    return undefined
  }

  /**
   * Check if language is supported and return the matching supported code
   *
   * @param {string} lang - Language code to check (e.g., 'fr-FR', 'en')
   * @param {Array} supportedLanguages - Array of supported language objects
   * @returns {string|undefined} - Matching supported language code or undefined if not supported
   */
  function findSupportedLanguage(lang, supportedLanguages) {
    // Try exact match first
    const exactMatch = supportedLanguages.find((l) => l.code === lang)
    if (exactMatch) {
      return exactMatch.code
    }

    // Try base language match (e.g., 'fr-FR' → 'fr')
    const baseLang = lang.split('-')[0]
    const baseMatch = supportedLanguages.find(
      (l) => l.code === baseLang || l.code.split('-')[0] === baseLang
    )
    if (baseMatch) {
      return baseMatch.code
    }

    return undefined
  }

  /**
   * The supported language this URL is ADDRESSED by, if any.
   *
   * `/fr/about` is addressed by `fr`; `/about` by nothing. Matched against the
   * short `code` because that is the only spelling `/{lang}/` routing accepts
   * server-side — `extractLanguageFromPath`
   * (`@/domain/models/app/languages/language-detection`) validates the first
   * segment against `supported[].code`, so a locale-spelled segment is not an
   * address at all.
   *
   * @returns {string | undefined} The short code, or undefined on an unprefixed path
   */
  function languageFromPath() {
    const segments = window.location.pathname.split('/').filter(Boolean)
    const firstSegment = segments[0]
    if (!firstSegment) {
      return undefined
    }
    const supportedCodes = languagesConfig.supported.map((lang) => lang.code)
    return supportedCodes.indexOf(firstSegment) === -1 ? undefined : firstSegment
  }

  /**
   * Re-derive a language for a document the SERVER has ALREADY composed.
   *
   * This is not the precedence that decides what the page says. By the time
   * this runs the request has been answered: `resolvePreferredLanguage`
   * (`@/domain/models/app/languages/language-detection`) and
   * `resolvePageLanguage` (`@/presentation/render/page/page-lang-resolver`)
   * picked the locale, the server rendered every server-resolved string and
   * the `<title>` in it, and the answer is sitting in `<html lang>`. Their
   * ranking is written down in those two files; do not restate it here,
   * because a second copy of a precedence list is how this comment came to
   * describe a contract the server had stopped honouring.
   *
   * Two consequences for the list below. Step 1 reads the SERVER's answer
   * whatever produced it — a `/{lang}/` prefix, the `sovrium_language`
   * cookie, `Accept-Language` — and not `page.meta.lang`, which is merely one
   * of the inputs that can have set it. And the cookie is never READ here:
   * this script only writes it (`rememberLanguage`), so a choice reaches the
   * NEXT request rather than this one. `localStorage` is the key this boot
   * path reads, and `rememberLanguage` writes both to keep them in step.
   *
   * Step 3 therefore outranks the served document whenever the server resolved
   * the DEFAULT language: a remembered choice repaints over it client-side. The
   * gap between what the server sent and what a reader sees is the subject of
   * `APP-LANGUAGES-055..057`
   * (`specs/internationalization/basic-language-configuration.spec.ts`),
   * which asserts on response BYTES for exactly that reason.
   *
   * Step 2 is the fence around that repaint. An address is something a visitor
   * typed, was linked to, or that a crawler followed, and the SERVER already
   * ranks it above a remembered preference. Without the same rule here the two
   * halves disagreed on exactly one case — a DEFAULT-language prefix, where
   * `<html lang>` matches the default so step 1 declines — and `/en/about`
   * repainted itself to French for anyone who had ever chosen French on this
   * site. A shared English link rendering French is the visible half; the
   * `lang` attribute being rewritten to `fr-FR` over English copy is the half
   * assistive tech and crawlers get.
   *
   * Priority order, as implemented:
   * 1. <html lang> IF it differs from default (the server resolved something)
   * 2. A `/{lang}/` address segment (explicit, and it outranks browser memory)
   * 3. localStorage (this browser's remembered choice)
   * 4. <html lang> IF it matches default
   * 5. Browser detection (navigator.language), when `detectBrowser` is on
   * 6. languages.default (final fallback)
   */
  function getInitialLanguage() {
    const pageLang = document.documentElement.getAttribute('lang')
    const defaultLang = languagesConfig.default

    // 1. Check whether the server resolved a non-default language
    // Normalize page lang to short code for comparison
    const normalizedPageLang = pageLang
      ? findSupportedLanguage(pageLang, languagesConfig.supported)
      : undefined

    // A non-default <html lang> means the server settled on something: a
    // `/{lang}/` prefix, the preference cookie, `meta.lang`, or Accept-Language.
    if (normalizedPageLang && normalizedPageLang !== defaultLang) {
      return normalizedPageLang
    }

    // 2. An explicit `/{lang}/` address outranks this browser's memory.
    const addressedLanguage = languageFromPath()
    if (addressedLanguage) {
      return addressedLanguage
    }

    // 3. Check if persistence is enabled (defaults to true)
    const persistSelection = languagesConfig.persistSelection ?? true

    if (persistSelection) {
      // Check localStorage for previously saved language
      const savedLanguage = localStorage.getItem('sovrium_language')
      if (savedLanguage) {
        // Verify saved language is in supported languages (with normalization support)
        const normalized = findSupportedLanguage(savedLanguage, languagesConfig.supported)
        if (normalized) {
          return normalized
        }
      }
    }

    // 4. Use HTML lang attribute if it matches default (nothing outranked it server-side)
    if (normalizedPageLang) {
      return normalizedPageLang
    }

    // 5. Check if browser detection is enabled (defaults to true)
    const detectBrowser = languagesConfig.detectBrowser ?? true

    if (detectBrowser) {
      // Use local detection function
      const detected = detectBrowserLanguage(navigator.language, languagesConfig.supported)
      if (detected) {
        return detected
      }
    }

    // 5. Fallback to default language (no match found or detection disabled)
    return languagesConfig.default
  }

  let currentLanguage = getInitialLanguage()
  let isOpen = false

  // Cache DOM elements to avoid repeated queries
  let currentLanguageEl, languageCodeEl, dropdown, switcherButton

  /**
   * Normalizes language code to match translation keys
   * Tries exact match first, then base language code (e.g., 'fr-FR' → 'fr')
   *
   * @param {string} lang - Language code (e.g., 'fr-FR', 'en-US', 'fr')
   * @param {Object} translations - Available translations object
   * @returns {string} - Matching translation key or original language code
   */
  function normalizeLanguageCode(lang, translations) {
    // Try exact match first
    if (translations[lang]) {
      return lang
    }

    // Try base language code (e.g., 'fr-FR' → 'fr')
    const baseLang = lang.split('-')[0]
    if (baseLang && translations[baseLang]) {
      return baseLang
    }

    // No match found - return original
    return lang
  }

  /**
   * Updates all elements with translation keys
   * Reads pre-resolved translations from data-translations attribute and updates text
   *
   * NOTE: Translation resolution logic has been moved to server-side to eliminate duplication.
   * Server pre-resolves all translations for all languages and injects them via data-translations.
   * Client only needs to lookup the appropriate translation, not re-implement fallback logic.
   */
  function updateTranslations() {
    const translatedElements = document.querySelectorAll('[data-translation-key]')
    translatedElements.forEach((element) => {
      const key = element.getAttribute('data-translation-key')
      const translationsJson = element.getAttribute('data-translations')

      if (key && translationsJson) {
        try {
          const translations = JSON.parse(translationsJson)

          // Normalize current language to match translation keys (e.g., 'fr-FR' → 'fr')
          const normalizedLang = normalizeLanguageCode(currentLanguage, translations)

          // Try current language first (normalized)
          let translation = translations[normalizedLang]

          // Try fallback language if missing
          if (!translation && languagesConfig.fallback) {
            const normalizedFallback = normalizeLanguageCode(languagesConfig.fallback, translations)
            translation = translations[normalizedFallback]
          }

          // Try default language if still missing
          if (!translation) {
            const normalizedDefault = normalizeLanguageCode(languagesConfig.default, translations)
            translation = translations[normalizedDefault]
          }

          // Use translation or key as final fallback
          element.textContent = translation || key
        } catch (error) {
          console.error('Failed to parse translations for key:', key, error)
          // Fallback to key if JSON parsing fails
          element.textContent = key
        }
      }
    })
  }

  /**
   * Updates page content with i18n translations
   * Finds all elements with data-i18n-content attribute and updates their text content
   */
  function updateContentI18n() {
    const i18nElements = document.querySelectorAll('[data-i18n-content]')
    i18nElements.forEach((element) => {
      const i18nJson = element.getAttribute('data-i18n-content')
      if (!i18nJson) {
        return
      }

      try {
        const i18nData = JSON.parse(i18nJson)

        // Normalize current language to match i18n data keys (e.g., 'fr-FR' → 'fr')
        const normalizedLang = normalizeLanguageCode(currentLanguage, i18nData)

        // Try current language first (normalized)
        let content = i18nData[normalizedLang]

        // Try fallback language if missing
        if (!content && languagesConfig.fallback) {
          const normalizedFallback = normalizeLanguageCode(languagesConfig.fallback, i18nData)
          content = i18nData[normalizedFallback]
        }

        // Try default language if still missing
        if (!content) {
          const normalizedDefault = normalizeLanguageCode(languagesConfig.default, i18nData)
          content = i18nData[normalizedDefault]
        }

        // Update element text content if translation found
        if (content) {
          element.textContent = content
        }
      } catch (error) {
        console.error('Failed to parse i18n content data:', error)
      }
    })
  }

  /**
   * Updates page metadata (title, HTML lang, description, keywords, og:site_name) for the current language
   * Reads metadata from data-page-meta attribute and applies localized values
   */
  function updatePageMetadata() {
    // Read page metadata configuration
    const pageMetaEl = document.querySelector('[data-page-meta]')
    if (!pageMetaEl) {
      return
    }

    let pageMeta
    try {
      pageMeta = JSON.parse(pageMetaEl.dataset.pageMeta || '{}')
    } catch (error) {
      console.error('Language switcher: failed to parse page metadata', error)
      return
    }

    // Update HTML lang attribute (use full locale, not short code)
    const currentLang = languagesConfig.supported.find((lang) => lang.code === currentLanguage)
    const locale = currentLang?.locale || currentLanguage
    document.documentElement.setAttribute('lang', locale)

    // Update page metadata if i18n translations are available
    if (pageMeta.i18n && pageMeta.i18n[currentLanguage]) {
      const localizedMeta = pageMeta.i18n[currentLanguage]

      // Update page title
      if (localizedMeta.title) {
        document.title = localizedMeta.title
      }

      // Update meta description
      if (localizedMeta.description) {
        const descriptionMeta = document.querySelector('meta[name="description"]')
        if (descriptionMeta) {
          descriptionMeta.setAttribute('content', localizedMeta.description)
        }
      }

      // Update meta keywords
      if (localizedMeta.keywords) {
        const keywordsMeta = document.querySelector('meta[name="keywords"]')
        if (keywordsMeta) {
          keywordsMeta.setAttribute('content', localizedMeta.keywords)
        }
      }

      // Update og:site_name
      if (localizedMeta['og:site_name']) {
        const ogSiteNameMeta = document.querySelector('meta[property="og:site_name"]')
        if (ogSiteNameMeta) {
          ogSiteNameMeta.setAttribute('content', localizedMeta['og:site_name'])
        }
      }
    }
  }

  /**
   * Updates the language switcher UI to reflect current language
   * Finds the label for currentLanguage and updates DOM element
   * Also updates the HTML dir attribute for RTL/LTR text direction
   */
  function updateUI() {
    const currentLang = languagesConfig.supported.find((lang) => lang.code === currentLanguage)
    const label = currentLang?.label || currentLanguage
    // Use full locale for language-code display (e.g., 'en-US', 'fr-FR')
    const locale = currentLang?.locale || currentLanguage

    // Only update if text content differs from current value to avoid duplication
    if (currentLanguageEl && currentLanguageEl.textContent !== label) {
      currentLanguageEl.textContent = label
    }

    if (languageCodeEl && languageCodeEl.textContent !== locale) {
      languageCodeEl.textContent = locale
    }

    // Update HTML dir attribute based on language direction
    const direction = currentLang?.direction || 'ltr'
    document.documentElement.setAttribute('dir', direction)

    // Update page metadata (title, HTML lang)
    updatePageMetadata()

    // Update content with i18n translations
    updateContentI18n()

    // Update all translated text when language changes
    updateTranslations()
  }

  /**
   * Toggles the language dropdown visibility
   * Updates isOpen state, display style, and aria-hidden attribute
   */
  function toggleDropdown(event) {
    if (event) {
      event.stopPropagation()
    }
    isOpen = !isOpen
    if (dropdown) {
      if (isOpen) {
        dropdown.style.display = 'block'
        dropdown.setAttribute('aria-hidden', 'false')
      } else {
        dropdown.style.display = 'none'
        dropdown.setAttribute('aria-hidden', 'true')
      }
    }
  }

  /**
   * Remember the choice where the SERVER can read it.
   *
   * `localStorage` is invisible to Sovrium: it never crosses the wire, so a page
   * composed server-side — the `<html lang>`, a `$t:` heading, an island's own
   * label field — went on being English while this script repainted whatever it
   * could reach on the client. The cookie is the half that travels, and it is
   * written IN ADDITION to `localStorage` rather than instead of it, because the
   * client boot path still reads that key.
   *
   * `SameSite=Lax` and no `HttpOnly`: this script is the writer, and a language
   * preference carries no authority — the server matches it against the app's
   * own `languages.supported` before believing a word of it
   * (`resolvePreferredLanguage`). `Secure` only under HTTPS, since a `secure`
   * cookie set on `http://localhost` is discarded outright and the preference
   * would silently never reach a development server.
   *
   * @param {string} code - ISO 639-1 short language code
   */
  function rememberLanguage(code) {
    localStorage.setItem('sovrium_language', code)
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    // One year: a language preference is the kind of choice a person expects to
    // outlive the session they made it in.
    document.cookie =
      'sovrium_language=' +
      encodeURIComponent(code) +
      '; Path=/; Max-Age=31536000; SameSite=Lax' +
      secure
  }

  /**
   * Selects a new language and updates the UI
   *
   * Saves to localStorage + the server-readable cookie if persistSelection is
   * enabled, then lets the SERVER compose the next document — by address where
   * the URL carries a `/{lang}/` segment, and by reloading the current one
   * where it does not.
   *
   * ─── WHY AN UNPREFIXED SELECTION RELOADS ───────────────────────────────────
   *
   * A repaint can only reach what this script can see: the `data-translations`
   * payload on a `$t:` element, the `<title>`, `<html lang>` and `dir`.
   * Everything else the SERVER resolved stays in the language the page was
   * first composed in — an island's serialized labels, a nav row, an
   * `aria-label`, a form's built-in submit text, a `meta.i18n` description —
   * and stays that way for good, on the one surface where the reader has just
   * said which language they want. Since the choice is written to a cookie the
   * server reads, recomposing costs one request and answers all of it.
   *
   * Without persistence there is nothing to recompose FROM: the server would
   * answer in the default language and the click would look like it did
   * nothing. So that case keeps repainting in place, which is the only way the
   * choice can show at all.
   *
   * @param {string} code - ISO 639-1 short language code (e.g., 'en', 'fr', 'es')
   */
  function selectLanguage(code) {
    currentLanguage = code

    // Save the choice if persistence is enabled (defaults to true)
    const persistSelection = languagesConfig.persistSelection ?? true
    if (persistSelection) {
      rememberLanguage(code)
    }

    // If current URL starts with a supported language code, navigate to new language subdirectory
    if (languageFromPath()) {
      // Replace language segment: /fr/about => /en/about
      const segments = window.location.pathname.split('/').filter(Boolean)
      const pathWithoutLang = '/' + segments.slice(1).join('/')
      const newPath = `/${code}${pathWithoutLang}`

      // Navigate to new language URL (preserves query params and hash)
      // Security: Use URL API to safely construct URL and prevent XSS
      const newUrl = new URL(newPath, window.location.origin)
      newUrl.search = window.location.search
      newUrl.hash = window.location.hash
      window.location.href = newUrl.href
      return
    }

    // No language subdirectory, but the choice is now readable by the server:
    // ask it for the whole document again rather than repainting a part of it.
    if (persistSelection) {
      window.location.reload()
      return
    }

    // Nothing was persisted, so a reload would come back in the default
    // language - update UI in place (backward compatibility)
    isOpen = false
    updateUI()
    if (dropdown) {
      dropdown.style.display = 'none'
      dropdown.setAttribute('aria-hidden', 'true')
    }
  }

  /**
   * Populates dropdown with language options
   */
  function populateDropdown() {
    if (!dropdown) {
      return
    }

    const supportedLanguagesJson = dropdown.getAttribute('data-supported-languages')
    const showFlags = dropdown.getAttribute('data-show-flags') === 'true'

    if (!supportedLanguagesJson) {
      return
    }

    let supportedLanguages
    try {
      supportedLanguages = JSON.parse(supportedLanguagesJson)
    } catch (error) {
      console.error('Failed to parse supported languages', error)
      return
    }

    // Create language option buttons
    supportedLanguages.forEach((lang) => {
      const button = document.createElement('button')
      // Use full locale for test ID to match HTML lang attribute
      button.setAttribute('data-testid', `language-option-${lang.locale}`)
      button.setAttribute('data-language-option', 'true')
      // Store short code for language selection
      button.setAttribute('data-language-code', lang.code)
      button.setAttribute('type', 'button')

      const span = document.createElement('span')
      span.setAttribute('data-testid', 'language-option')

      // Add flag if enabled and available
      if (showFlags && lang.flag) {
        if (lang.flag.startsWith('/')) {
          // Image flag
          const img = document.createElement('img')
          img.src = lang.flag
          img.alt = `${lang.label} flag`
          img.setAttribute('data-testid', 'language-flag-img')
          span.appendChild(img)
        } else {
          // Emoji flag
          span.textContent = `${lang.flag} ${lang.label}`
        }
      } else {
        span.textContent = lang.label
      }

      button.appendChild(span)
      dropdown.appendChild(button)

      // Attach click listener
      button.addEventListener('click', function (event) {
        event.stopPropagation()
        const code = this.getAttribute('data-language-code')
        if (code) {
          selectLanguage(code)
        }
      })
    })
  }

  /**
   * Initializes the language switcher on page load
   * Caches DOM elements and attaches event listeners
   */
  function init() {
    // Cache DOM elements once
    currentLanguageEl = document.querySelector('[data-testid="current-language"]')
    languageCodeEl = document.querySelector('[data-testid="language-code"]')
    dropdown = document.querySelector('[data-language-dropdown]')
    switcherButton = document.querySelector('[data-testid="language-switcher"]')

    // Populate dropdown with language options
    populateDropdown()

    // Update UI to reflect detected/default language
    updateUI()

    if (switcherButton) {
      switcherButton.addEventListener('click', toggleDropdown)
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    // DOM already loaded
    init()
  }
})()
