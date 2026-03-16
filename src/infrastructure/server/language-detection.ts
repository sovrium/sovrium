/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { detectLanguageFromHeader } from '@/infrastructure/utils/accept-language-parser'
import type { App } from '@/domain/models/app'

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
