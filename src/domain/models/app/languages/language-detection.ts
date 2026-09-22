/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { detectLanguageFromHeader } from '@/domain/kernel/url/accept-language-parser'
import type { App } from '@/domain/models/app'
import type { Languages } from '@/domain/models/app/languages/language'

/**
 * Get array of supported language codes from app configuration
 *
 * @param app - Application configuration
 * @returns Array of short language codes or empty array if languages not configured
 *
 * @example
 * getSupportedLanguageCodes(app) // => ['en', 'fr', 'es']
 */
export function getSupportedLanguageCodes(app: App): ReadonlyArray<string> {
  return app.languages?.supported.map((l) => l.code) || []
}

/**
 * Extract and validate language code from URL path
 *
 * @param path - URL path (e.g., '/fr/', '/en/about')
 * @param supportedLanguages - Array of supported short language codes
 * @returns Short language code if valid, undefined otherwise
 *
 * @example
 * extractLanguageFromPath('/fr/', ['en', 'fr']) // => 'fr'
 * extractLanguageFromPath('/fr/about', ['en', 'fr']) // => 'fr'
 * extractLanguageFromPath('/invalid/', ['en', 'fr']) // => undefined
 * extractLanguageFromPath('/', ['en', 'fr']) // => undefined
 */
export function extractLanguageFromPath(
  path: string,
  supportedLanguages: ReadonlyArray<string>
): string | undefined {
  // Extract first path segment (e.g., '/fr-FR/about' => 'fr-FR')
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) {
    return undefined
  }

  const potentialLang = segments[0]
  if (!potentialLang) {
    return undefined
  }

  // Validate against supported languages
  return supportedLanguages.includes(potentialLang) ? potentialLang : undefined
}

/**
 * Detect language from Accept-Language header if browser detection is enabled
 *
 * @param app - Application configuration
 * @param header - Accept-Language HTTP header value
 * @returns Detected short language code or undefined
 *
 * @example
 * detectLanguageIfEnabled(app, 'fr-FR,fr;q=0.9,en;q=0.8') // => 'fr'
 * detectLanguageIfEnabled(appWithDetectionDisabled, 'fr-FR') // => undefined
 */
export function detectLanguageIfEnabled(app: App, header: string | undefined): string | undefined {
  if (app.languages?.detectBrowser === false) {
    return undefined
  }
  return detectLanguageFromHeader(header, getSupportedLanguageCodes(app))
}

/**
 * Validate and extract language code from URL subdirectory path
 *
 * @param app - Application configuration
 * @param path - URL path (e.g., '/fr/', '/en/about')
 * @returns Short language code if valid subdirectory, undefined otherwise
 *
 * @example
 * validateLanguageSubdirectory(app, '/fr/') // => 'fr'
 * validateLanguageSubdirectory(app, '/products/pricing') // => undefined
 */
export function validateLanguageSubdirectory(app: App, path: string): string | undefined {
  return extractLanguageFromPath(path, getSupportedLanguageCodes(app))
}

/**
 * The cookie the language switcher writes so the SERVER can compose the next
 * document in the language the operator chose.
 *
 * Deliberately the same name as the `localStorage` key the switcher has always
 * used: the two hold the same value for the same reason, and one vocabulary is
 * what keeps a reader from wondering whether they can disagree. The client
 * writes both; only this one crosses the wire.
 */
export const LANGUAGE_PREFERENCE_COOKIE = 'sovrium_language'

/**
 * Resolve the locale a persisted language preference means FOR THIS APP.
 *
 * The cookie is a value a browser sends, so it is never echoed: it is matched
 * against the app's own `languages.supported` and answered with that entry's
 * declared locale. A preference naming a language THIS app does not declare
 * resolves to `undefined`, which leaves the request exactly as it was — the
 * page's own `meta.lang`, then detection, then the default.
 *
 * That clamp is the whole reason this is a function rather than a cookie read.
 * One browser carries ONE preference across every app served from a host, and
 * the embedded operator console is a second app on the operator's own origin
 *: an unchecked echo would serve the console `lang="es-ES"` over the
 * English strings it actually has, which is the failure `[internal ref]`
 * pins for the operator's translation table and `[internal ref]` generalises
 * to the preference.
 *
 * The LOCALE rather than the short code, because that is what the rest of the
 * document already says: an authored `meta.lang` is written `en-US`, and
 * `language-switcher.js` sets `document.documentElement.lang` from
 * `supported[].locale`. Answering the short code here would make the server and
 * its own client script disagree on every switched page. (The `/{lang}/` URL
 * prefix keeps answering the short code it was addressed by — see
 * `[internal ref]`, which reads that `lang` off the wire.)
 *
 * `persistSelection: false` is honoured on the READ side as well as the write
 * side. Cookies are host-scoped rather than port-scoped, so an app that asked
 * not to remember anything can still be handed a neighbour's preference; the
 * check is what makes "do not remember" mean it.
 *
 * @param languages - The rendered app's own languages configuration
 * @param rawPreference - The raw cookie value, as received
 * @returns The declared locale for the preference, or `undefined`
 *
 * @example
 * resolvePreferredLanguage(languages, 'fr')    // => 'fr-FR'
 * resolvePreferredLanguage(languages, 'fr-FR') // => 'fr-FR'
 * resolvePreferredLanguage(languages, 'es')    // => undefined (not declared)
 */
export function resolvePreferredLanguage(
  languages: Languages | undefined,
  rawPreference: string | undefined
): string | undefined {
  if (languages?.persistSelection === false) return undefined
  return findDeclaredLanguage(languages, rawPreference)
}

/**
 * Resolve the locale a raw language value means for this app — DECLAREDNESS
 * only, with no view on whether the app wants preferences remembered.
 *
 * The matching half of {@link resolvePreferredLanguage}, split out because the
 * two questions genuinely differ at the WRITE door. `persistSelection: false`
 * says "do not let a remembered preference decide what I serve", which is a
 * statement about READING; whether a value is one the app declares at all is a
 * statement about the value. Asking the read-side question at the write door
 * would make an app that turned remembering off answer 400 to a language it
 * declares — refusing a legal value for an unrelated reason, and reporting it
 * as though the value were wrong.
 *
 * Accepts either spelling, because both are things an app declares about the
 * same language: the short `code` (`fr`) and the full `locale` (`fr-FR`).
 * Always ANSWERS with the locale, so every consumer downstream sees the one
 * spelling the rest of the document already uses.
 *
 * @param languages - The app's own languages configuration
 * @param raw - A language value from anywhere outside the app (cookie, account)
 * @returns The declared locale, or `undefined` when the app declares no such language
 *
 * @example
 * findDeclaredLanguage(languages, 'fr')    // => 'fr-FR'
 * findDeclaredLanguage(languages, 'fr-FR') // => 'fr-FR'
 * findDeclaredLanguage(languages, 'de')    // => undefined (not declared)
 */
export function findDeclaredLanguage(
  languages: Languages | undefined,
  raw: string | undefined
): string | undefined {
  if (!languages || !raw) return undefined
  const declared = languages.supported.find(
    (language) => language.code === raw || language.locale === raw
  )
  return declared ? (declared.locale ?? declared.code) : undefined
}

/**
 * The ADDRESS spelling of a declared language — its short `code`.
 *
 * The third of the trio, and the one the URL owns. {@link findDeclaredLanguage}
 * answers the spelling a DOCUMENT declares itself in (`supported[].locale`);
 * this one answers the spelling a document is REACHED by, and they are not
 * interchangeable. `/{lang}/` routing validates its first path segment against
 * `supported[].code` — see {@link extractLanguageFromPath} — so building a
 * redirect target out of a locale produces `/fr-FR/`, an address no route
 * matches and every such redirect a 404.
 *
 * Accepts either spelling for the same reason its sibling does: a preference
 * arriving from a cookie or an account may name the language either way, and
 * both are things the app declared about one language.
 *
 * @param languages - The app's own languages configuration
 * @param raw - A language value from anywhere outside the app
 * @returns The declared short code, or `undefined` when the app declares no such language
 *
 * @example
 * findDeclaredLanguageCode(languages, 'fr-FR') // => 'fr'
 * findDeclaredLanguageCode(languages, 'fr')    // => 'fr'
 * findDeclaredLanguageCode(languages, 'de')    // => undefined (not declared)
 */
export function findDeclaredLanguageCode(
  languages: Languages | undefined,
  raw: string | undefined
): string | undefined {
  if (!languages || !raw) return undefined
  return languages.supported.find((language) => language.code === raw || language.locale === raw)
    ?.code
}
