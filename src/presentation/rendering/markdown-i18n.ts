/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslation } from '@/domain/utils/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'

export const resolveMarkdownTranslations = (
  source: string,
  currentLang: string | undefined,
  languages: Languages | undefined
): string => {
  if (languages === undefined) return source
  if (currentLang === undefined) return source
  return source.replace(
    /\$t:([a-zA-Z0-9_-](?:[a-zA-Z0-9_.-]*[a-zA-Z0-9_-])?)/g,
    (_match, key: string) => resolveTranslation(key, currentLang, languages)
  )
}
