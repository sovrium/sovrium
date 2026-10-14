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
   * Not the precedence that decides what the page says: `resolvePreferredLanguage`
   * and `resolvePageLanguage` picked the locale server-side and the answer sits in
   * `<html lang>`; their ranking lives in those files and is not restated here.
   * Step 1 reads the server's answer whatever produced it. The cookie is never
   * READ here — `rememberLanguage` writes it, so a choice reaches the NEXT
   * request; `localStorage` is the key this boot path reads. Step 3 repaints a
   * remembered choice over a default-language document (`APP-LANGUAGES-055..057`
   * assert on response bytes for that gap), and step 2 fences it: an explicit
   * `/{lang}/` address outranks memory, as it does server-side, so `/en/about`
   * never repaints itself to French.
   *
   * 1. <html lang> IF it differs from default (the server resolved something)
   * 2. A `/{lang}/` address segment
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
  let currentLanguageEl, languageCodeEl, dropdown, switcherButton, menuTrigger

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
   * Opens or closes the language menu: its display and `aria-hidden`, and the
   * trigger's `aria-expanded`, which is how the menu's state is announced.
   */
  function setMenuOpen(open) {
    isOpen = open
    if (dropdown) {
      dropdown.style.display = open ? 'block' : 'none'
      dropdown.setAttribute('aria-hidden', open ? 'false' : 'true')
    }
    if (menuTrigger) {
      menuTrigger.setAttribute('aria-expanded', open ? 'true' : 'false')
    }
  }

  function toggleDropdown(event) {
    if (event) {
      event.stopPropagation()
    }
    setMenuOpen(!isOpen)
  }

  /**
   * The menu's keyboard, as a dropdown menu's: the arrow keys open it from the
   * trigger (on the picked language) and move through its rows, wrapping;
   * Escape closes it and returns to the trigger; Tab closes it. Enter and Space
   * pick the focused row, a native button.
   */
  function handleMenuKeydown(event) {
    const rows = dropdown ? Array.from(dropdown.querySelectorAll('[role="menuitemradio"]')) : []
    if (rows.length === 0) {
      return
    }
    if ((event.key === 'Escape' || event.key === 'Tab') && isOpen) {
      setMenuOpen(false)
      if (event.key === 'Escape') {
        event.preventDefault()
        menuTrigger?.focus()
      }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      const current = rows.indexOf(document.activeElement)
      const picked = rows.findIndex((row) => row.getAttribute('aria-checked') === 'true')
      const target = isOpen && current !== -1 ? current + step : Math.max(picked, 0)
      setMenuOpen(true)
      rows[(target + rows.length) % rows.length].focus()
    }
  }

  /**
   * Remember the choice where the SERVER can read it: a cookie IN ADDITION to
   * `localStorage`, which never crosses the wire and which the boot path still
   * reads. `SameSite=Lax`, no `HttpOnly` (a preference carries no authority; the
   * server checks it against `languages.supported`), `Secure` only under HTTPS,
   * since a secure cookie set on `http://localhost` is discarded outright.
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
   * Selects a new language: remembers it when `persistSelection` is on, then
   * lets the SERVER compose the next document — by address where the URL
   * carries a `/{lang}/` segment, by reloading the current one where it does
   * not. A repaint only reaches what this script can see; an island's labels,
   * a nav row or a form's submit text stay in the first language, and the
   * cookie makes recomposing cost one request. Without persistence there is
   * nothing to recompose from, so that case repaints in place.
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
    updateUI()
    setMenuOpen(false)
  }

  /** A radio row's indicator, holding the server-drawn check on the picked row only. */
  function radioIndicator(indicatorClass, picked) {
    const indicator = document.createElement('span')
    indicator.setAttribute('data-slot', 'dropdown-menu-radio-item-indicator')
    indicator.className = indicatorClass || ''
    const check = dropdown.querySelector('template[data-language-check]')
    if (picked && check) {
      indicator.appendChild(check.content.cloneNode(true))
    }
    return indicator
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
    // The row and indicator chrome are design-system recipes the SSR markup
    // stamps here, because this script cannot import them.
    const optionClass = dropdown.getAttribute('data-option-class')
    const indicatorClass = dropdown.getAttribute('data-indicator-class')

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
      button.setAttribute('role', 'menuitemradio')
      button.setAttribute('data-slot', 'dropdown-menu-radio-item')
      button.setAttribute('tabindex', '-1')
      const picked = lang.code === currentLanguage
      button.setAttribute('aria-checked', picked ? 'true' : 'false')
      if (optionClass) {
        button.className = optionClass
      }
      button.appendChild(radioIndicator(indicatorClass, picked))

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
   * Point the two-language toggle at the same page in the other language.
   * The server renders the other language's root, the only address it can
   * know; the browser holds the full path, query and hash.
   */
  function retargetToggle() {
    const link = document.querySelector('[data-language-toggle]')
    if (!link) {
      return
    }
    const code = link.getAttribute('hreflang')
    if (!code) {
      return
    }
    const segments = window.location.pathname.split('/').filter(Boolean)
    const rest = languageFromPath() ? segments.slice(1) : segments
    const newUrl = new URL(`/${code}/${rest.join('/')}`, window.location.origin)
    newUrl.search = window.location.search
    newUrl.hash = window.location.hash
    // Read off the parser's `href`, never reassembled from `search` and `hash`:
    // those two carry the address bar's own text, and a URL rebuilt from them
    // is DOM text written back into an attribute. `href` is the parsed,
    // re-serialised address, on this origin under the language code the server
    // stamped on the link.
    link.setAttribute('href', newUrl.href)
    link.addEventListener('click', function (event) {
      event.stopPropagation()
      if (languagesConfig.persistSelection ?? true) {
        rememberLanguage(code)
      }
    })
  }

  function init() {
    retargetToggle()

    // Cache DOM elements once
    currentLanguageEl = document.querySelector('[data-testid="current-language"]')
    languageCodeEl = document.querySelector('[data-testid="language-code"]')
    dropdown = document.querySelector('[data-language-dropdown]')
    switcherButton = document.querySelector('[data-testid="language-switcher"]')
    menuTrigger = document.querySelector('[data-testid="language-switcher-button"]')

    // Populate dropdown with language options
    populateDropdown()

    // Update UI to reflect detected/default language
    updateUI()

    if (switcherButton) {
      switcherButton.addEventListener('click', toggleDropdown)
      switcherButton.addEventListener('keydown', handleMenuKeydown)
    }

    // A press anywhere outside the switcher closes its menu.
    document.addEventListener('click', () => isOpen && setMenuOpen(false))
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    // DOM already loaded
    init()
  }
})()
