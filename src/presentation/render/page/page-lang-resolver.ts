/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { findDeclaredLanguage } from '@/domain/models/app/languages/language-detection'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'

/**
 * Page language configuration
 */
export type PageLangConfig = {
  readonly lang: string
  readonly direction: 'ltr' | 'rtl'
  readonly directionStyles: string
}

/**
 * WHICH input decides the language — the precedence, and nothing else.
 *
 * Split from {@link resolvePageLanguage} so the two questions this file answers
 * stay separable: which input wins, and how the winner is spelled. Keeping both
 * chains in one body also put that function over its complexity budget.
 */
function winningLanguage(
  page: Page,
  languages: Languages | undefined,
  detectedLanguage: string | undefined,
  urlLanguage: string | undefined
): string {
  return urlLanguage ?? page.meta?.lang ?? detectedLanguage ?? languages?.default ?? 'en-US'
}

/** HOW the winner is spelled: the app's own declaration, else as authored. */
function spellAsDeclared(languages: Languages | undefined, winner: string): string {
  return findDeclaredLanguage(languages, winner) ?? winner
}

/**
 * Resolves the active language for a page.
 *
 * Priority: `urlLanguage` > `page.meta.lang` > `detectedLanguage` > `languages.default` > `'en-US'`.
 *
 * The `/:lang/` URL prefix sits ABOVE `page.meta.lang` ([internal ref]..039).
 * A locale a visitor asked for by URL is an explicit request and must win: with
 * `meta.lang` on top, a page that declared one became locale-frozen and `/fr/`
 * served English under `lang="en"` while the sitemap advertised it as
 * `hreflang="fr-FR"`. The override runs in BOTH directions — `/en/` over a page
 * pinned `fr` renders English.
 *
 * `page.meta.lang` stays above browser detection: it remains the right answer
 * for a page reached WITHOUT a language prefix, so it is demoted, not removed.
 *
 * ─── `urlLanguage` IS A RANK, NOT A SOURCE ─────────────────────────────────
 *
 * Two inputs arrive through it, and the name records only the first because it
 * arrived first: the `/{lang}/` URL prefix, and — on a request carrying no
 * prefix — the operator's PERSISTED preference (`resolvePreferredLanguage`,
 * `[internal ref]..057`). They never collide: the route layer consults the
 * cookie only where there is no prefix to consult instead, which is what makes
 * an address a visitor typed or was linked to outrank whatever this particular
 * browser remembers.
 *
 * What they share is the rank, and the rank is the load-bearing part. Every
 * console preset page pins `meta.lang`, so a preference entering BELOW that pin
 * would be inert on exactly the surface it was added for.
 *
 * ─── ONE SPELLING, WHICHEVER INPUT WON ─────────────────────────────────────
 *
 * The winner names a language; it does not name how to SPELL it. The four
 * inputs above speak different dialects of the same fact — a `/{lang}/` prefix
 * carries the short `code` it was addressed by, an authored `meta.lang` is
 * written `en-US`, a resolved preference already answers `supported[].locale` —
 * so echoing whichever one won put a different `lang` attribute on the wire
 * depending on how the reader arrived. A `/fr/` page said `lang="fr"` and its
 * own client script rewrote that to `fr-FR` on hydration; the sitemap
 * advertised the same document as `hreflang="fr-FR"`, and a crawler reading
 * both had no way to know the two named one language.
 *
 * So the winner is resolved back through the app's own declaration:
 * `supported[].locale ?? code`. The `?? code` half is not a fallback detail but
 * the rule's other side — a `lang` attribute must name a language the app
 * actually declared, never a region invented for it, so a language declaring no
 * `locale` answers its short code unchanged.
 *
 * An UNDECLARED value passes through as authored. That is the case where this
 * app has no opinion to impose: a monolingual app has no `languages` block at
 * all and its pages' `meta.lang` is the only spelling anyone wrote down.
 *
 * @param page - Page configuration
 * @param languages - Languages configuration
 * @param detectedLanguage - Request-resolved language (URL prefix, else Accept-Language)
 * @param urlLanguage - The locale that outranks `meta.lang`: the `/:lang/` URL
 *   prefix, else the persisted preference
 * @returns Language configuration with direction and styles
 */
export function resolvePageLanguage(
  page: Page,
  languages: Languages | undefined,
  detectedLanguage: string | undefined,
  urlLanguage?: string
): PageLangConfig {
  const lang = spellAsDeclared(
    languages,
    winningLanguage(page, languages, detectedLanguage, urlLanguage)
  )

  // Determine text direction from language configuration
  // Match by code (en) or locale (en-US)
  const langConfig = languages?.supported.find((l) => l.code === lang || l.locale === lang)
  const direction = langConfig?.direction || 'ltr'

  // Generate CSS for body direction to ensure RTL/LTR is applied as CSS property
  const directionStyles = `
    html[lang="${lang}"] { direction: ${direction}; }
    html[lang="${lang}"] body { direction: ${direction}; }
  `

  return { lang, direction, directionStyles }
}
