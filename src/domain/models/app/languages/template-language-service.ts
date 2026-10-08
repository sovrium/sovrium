/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Languages } from './language'

/**
 * THE LANGUAGE A DOCUMENT TEMPLATE RENDERS IN.
 *
 * A step's `locale` names a declared language by its code (`fr`) or its locale
 * (`fr-FR`); a value naming none — a templated locale read from a record — and
 * a step with no locale both render in the default language. `{{t 'key'}}`
 * reads the key in that language, then in `languages.fallback`, then in the
 * default language; the language's `locale` is what amounts, numbers and dates
 * are formatted in.
 */
export interface TemplateLanguage {
  /** The declared short code the render uses (`fr`). */
  readonly code: string
  /** The BCP 47 locale the formatting helpers use (`fr-FR`). */
  readonly locale: string
  /** The translation of `key` along the fallback chain, or `undefined` when no language has it. */
  readonly translate: (key: string) => string | undefined
}

/** The language a template renders in, or `undefined` for an app that declares none. */
export const resolveTemplateLanguage = (
  languages: Languages | undefined,
  requested: string | undefined
): TemplateLanguage | undefined => {
  if (languages === undefined) return undefined
  const named =
    requested === undefined || requested === ''
      ? undefined
      : languages.supported.find(
          (language) => language.code === requested || language.locale === requested
        )
  const language =
    named ?? languages.supported.find((candidate) => candidate.code === languages.default)
  const code = language?.code ?? languages.default
  const chain = [...new Set([code, languages.fallback, languages.default])].filter(
    (entry): entry is string => entry !== undefined
  )
  const translations = languages.translations ?? {}
  return {
    code,
    locale: language?.locale ?? code,
    translate: (key) =>
      chain.map((entry) => translations[entry]?.[key]).find((value) => value !== undefined),
  }
}

/** Whether a literal `locale` names a declared language (a template is checked at run time). */
export const isDeclaredTemplateLocale = (
  languages: Languages | undefined,
  locale: string
): boolean =>
  languages?.supported.some(
    (language) => language.code === locale || language.locale === locale
  ) === true
