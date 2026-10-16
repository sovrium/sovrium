/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The language a hosted form is written in: the one its `$t:` keys resolve
 * against, and the one its engine strings (submit, legend, refusals) follow.
 * A form on a page that declares its language by `meta.lang` alone, with no
 * `languages` block, writes in that language rather than in English.
 */

import type { Languages } from '@/domain/models/app/languages'

/**
 * Resolve the active language for `$t:` resolution.
 *
 * The requested language (e.g. `?lang=fr`) wins when it is one of the
 * app's `supported` codes. Otherwise the renderer immediately collapses to
 * `fallback ?? default` so an unsupported `?lang=de`
 * resolves against the catalog rather than emitting raw `$t:` literals.
 * The downstream `resolveTranslationPattern` still applies its own
 * active → fallback → literal chain for missing keys.
 */
export function resolveActiveLang(languages: Languages, requestedLang: string | undefined): string {
  if (requestedLang === undefined || requestedLang === '') {
    return languages.default
  }
  const supported = languages.supported ?? []
  const isSupported = supported.some(
    (entry) => entry.code === requestedLang || entry.locale === requestedLang
  )
  if (isSupported) return requestedLang
  return languages.fallback ?? languages.default
}

/** A language tag as a page declares one (`fr`, `fr-FR`), never arbitrary text. */
const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i

/**
 * Resolve the document `lang`: with no `languages` block, the host page's own
 * language tag (its `meta.lang`) else `'en'`; with one, the `$t:` active
 * language (requested when supported, else fallback ?? default).
 */
export function resolveDocumentLang(languages: Languages | undefined, activeLang?: string): string {
  if (!languages) {
    return activeLang !== undefined && LANGUAGE_TAG.test(activeLang) ? activeLang : 'en'
  }
  return resolveActiveLang(languages, activeLang)
}
