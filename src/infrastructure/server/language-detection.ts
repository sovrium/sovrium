/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { detectLanguageFromHeader } from '@/infrastructure/utils/accept-language-parser'
import type { App } from '@/domain/models/app'

export function getSupportedLanguageCodes(app: App): ReadonlyArray<string> {
  return app.languages?.supported.map((l) => l.code) || []
}

export function extractLanguageFromPath(
  path: string,
  supportedLanguages: ReadonlyArray<string>
): string | undefined {
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) {
    return undefined
  }

  const potentialLang = segments[0]
  if (!potentialLang) {
    return undefined
  }

  return supportedLanguages.includes(potentialLang) ? potentialLang : undefined
}

export function detectLanguageIfEnabled(app: App, header: string | undefined): string | undefined {
  if (app.languages?.detectBrowser === false) {
    return undefined
  }
  return detectLanguageFromHeader(header, getSupportedLanguageCodes(app))
}

export function validateLanguageSubdirectory(app: App, path: string): string | undefined {
  return extractLanguageFromPath(path, getSupportedLanguageCodes(app))
}
