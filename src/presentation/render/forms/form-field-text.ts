/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The text a form field is drawn with, resolved through the app's languages,
 * and the per-render inputs every field resolver reads.
 */

import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { resolveActiveLang } from './form-document-lang'
import type { FormOptionSets } from '@/domain/models/app/forms/form-option-source-service'
import type { Languages } from '@/domain/models/app/languages'

/**
 * Resolve a `$t:key` literal (or pass-through plain string) using the app's
 * `languages`; unchanged without one. `activeLang` (typically `?lang=`)
 * selects the catalog language, else `languages.default`.
 */
export function resolveText(
  value: string | undefined,
  languages: Languages | undefined,
  fallback: string,
  activeLang?: string
): string {
  if (value === undefined) return fallback
  if (languages === undefined) return value
  const lang = resolveActiveLang(languages, activeLang)
  return resolveTranslationPattern(value, lang, languages)
}

/** The per-render inputs every field resolver reads. */
export interface FieldResolutionContext {
  readonly activeLang: string | undefined
  readonly optionSets: FormOptionSets
}
