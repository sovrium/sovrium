/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolve a value from a locale-keyed table against the page's active language.
 *
 * Platform CHROME — the "Built with Sovrium" badge, the demo context notice, the
 * toast dismiss control — carries its own locale → copy map rather than going
 * through app-authored `$t:` translations. Each of those maps is a
 * `Readonly<Record<string, T>>` keyed by SHORT code (`en`, `fr`), and each was
 * read with a bare `TABLE[lang]`. This is the one lookup they share.
 *
 * ─── WHY THE PRIMARY-SUBTAG STEP EXISTS ────────────────────────────────────
 *
 * `resolvePageLanguage` can answer a REGIONAL tag. `page.meta.lang` is authored
 * `en-US`/`fr-FR`, and `resolvePreferredLanguage` deliberately answers
 * `supported[].locale` rather than the short code so the server and
 * `language-switcher.js` agree on `document.documentElement.lang`. A bare
 * `TABLE['fr-FR']` misses the `fr` key and falls through to English, so a page
 * that is French by every other measure rendered English chrome beside French
 * content. The `/fr/` URL prefix answers the short code, which is what kept the
 * gap narrow enough to go unnoticed.
 *
 * Matching the exact tag FIRST is what keeps a future `pt-BR` entry reachable
 * without it being shadowed by a `pt` one.
 *
 * Case folding applies to the SUBTAG step only. An exact-tag hit is left to the
 * table's own spelling, so a map that deliberately keys `pt-BR` still requires
 * that spelling; the relaxed step is where a wire value of unknown case (a
 * cookie, an authored `meta.lang`) has to be met halfway. BCP-47 is
 * case-insensitive by definition, so `FR-fr` and `fr-FR` name one language.
 *
 * Total by construction: every input — `undefined`, `''`, a lone separator, a
 * tag naming a language the table has no entry for — answers `fallback`. Chrome
 * that throws on an unexpected locale would take the whole document with it.
 *
 * @param table - Locale → value map, keyed by short code (and optionally by full tag)
 * @param lang - The page's active language, as `resolvePageLanguage` answered it
 * @param fallback - The value for an unmapped locale (English, for every caller today)
 * @returns The table entry for the language, else `fallback`
 *
 * @example
 * resolveForLanguage(BADGE_LABELS, 'fr', EN)     // => 'Construit avec Sovrium'
 * resolveForLanguage(BADGE_LABELS, 'fr-FR', EN)  // => 'Construit avec Sovrium'
 * resolveForLanguage(BADGE_LABELS, 'FR-fr', EN)  // => 'Construit avec Sovrium'
 * resolveForLanguage(BADGE_LABELS, 'fr-CA', EN)  // => 'Construit avec Sovrium'
 * resolveForLanguage(BADGE_LABELS, 'de', EN)     // => 'Built with Sovrium'
 * resolveForLanguage(BADGE_LABELS, undefined, EN)// => 'Built with Sovrium'
 */
export function resolveForLanguage<T>(
  table: Readonly<Record<string, T>>,
  lang: string | undefined,
  fallback: T
): T {
  if (lang === undefined || lang === '') {
    return fallback
  }

  const exact = table[lang]
  if (exact !== undefined) {
    return exact
  }

  const primarySubtag = (lang.split('-')[0] ?? '').toLowerCase()
  if (primarySubtag === '') {
    return fallback
  }

  return table[primarySubtag] ?? fallback
}
