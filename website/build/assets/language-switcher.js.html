/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
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
   * Detect initial language based on configuration
   * Priority order:
   * 1. Page language from <html lang> IF it differs from default (explicit page.meta.lang - highest priority)
   * 2. localStorage (user's explicit manual choice - persists across reloads)
   * 3. Page language from <html lang> IF it matches default (server-detected or default)
   * 4. Browser detection (user's browser preference, only if no HTML lang set)
   * 5. Default language (final fallback)
   */
  function getInitialLanguage() {
    const pageLang = document.documentElement.getAttribute('lang')
    const defaultLang = languagesConfig.default

    // 1. Check if page has explicit non-default language (page.meta.lang set explicitly)
    // Normalize page lang to short code for comparison
    const normalizedPageLang = pageLang
      ? findSupportedLanguage(pageLang, languagesConfig.supported)
      : undefined

    // If HTML lang differs from default, it means the page explicitly set a language
    if (normalizedPageLang && normalizedPageLang !== defaultLang) {
      return normalizedPageLang
    }

    // 2. Check if persistence is enabled (defaults to true)
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

    // 3. Use HTML lang attribute if it matches default (server's default or Accept-Language detection)
    if (normalizedPageLang) {
      return normalizedPageLang
    }

    // 4. Check if browser detection is enabled (defaults to true)
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
   * Also updates window.APP_THEME.direction for theme integration
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

    // Update window.APP_THEME.direction for theme integration
    if (window.APP_THEME) {
      window.APP_THEME.direction = direction
    }

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
   * Selects a new language and updates the UI
   * Saves to localStorage if persistSelection is enabled
   * Handles navigation for language subdirectory URLs (/:lang/*)
   * @param {string} code - ISO 639-1 short language code (e.g., 'en', 'fr', 'es')
   */
  function selectLanguage(code) {
    currentLanguage = code

    // Save to localStorage if persistence is enabled (defaults to true)
    const persistSelection = languagesConfig.persistSelection ?? true
    if (persistSelection) {
      localStorage.setItem('sovrium_language', code)
    }

    // Check if current URL uses language subdirectory pattern (/:lang/*)
    const currentPath = window.location.pathname
    const supportedCodes = languagesConfig.supported.map((lang) => lang.code)

    // Extract first path segment
    const segments = currentPath.split('/').filter(Boolean)
    const firstSegment = segments[0]

    // If current URL starts with a supported language code, navigate to new language subdirectory
    if (firstSegment && supportedCodes.includes(firstSegment)) {
      // Replace language segment: /fr/about => /en/about
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

    // No language subdirectory - update UI in place (backward compatibility)
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
