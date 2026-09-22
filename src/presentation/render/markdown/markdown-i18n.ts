/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslation } from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'

/**
 * Inline `$t:key` substitution for markdown body text
 *.
 *
 * Runs as a regex pre-pass over the RAW markdown source BEFORE
 * `renderMarkdownToHtml` so tokens nested inside emphasis (`**$t:key**`),
 * list items (`- $t:key`), or any other block construct survive block
 * parsing — markdown-it never sees the token, only the resolved text.
 *
 * Lookup logic is delegated to the existing
 * `resolveTranslation` (`src/domain/models/app/languages/translation-resolver.ts`) which
 * already implements the `default → fallback → key` chain. This module
 * intentionally re-uses that contract rather than reimplementing fallback
 * logic so a future change in i18n semantics (e.g. region tags) reaches
 * both the markdown pre-pass and the existing `$t:` resolvers.
 *
 * Security posture (S2 — sanitisation defense in depth):
 * Translation values come from `app.languages.translations`, an operator-
 * controlled schema input — NOT runtime user input. They flow into raw
 * markdown text, which is then parsed by markdown-it (configured with
 * `html: false`, dropping any inline `<script>` tags as plain text) and
 * sanitised by the canonical `sanitizeRichTextHTML` before reaching the
 * DOM. A malicious translation value containing `<script>` would be
 * neutralised twice: once by markdown-it's HTML-disabled parser, again by
 * the sanitiser. We therefore do NOT sanitise here — sanitisation lives
 * at exactly one layer per S2.
 *
 * Recursion guard: a single regex `.replace` pass is non-recursive by
 * construction — a translation value of `$t:other` resolves to the literal
 * string `$t:other`, NOT to a second lookup. This prevents infinite-loop
 * DoS via cyclic translations (`a → $t:b`, `b → $t:a`).
 *
 * @param source       Raw markdown text (pre-block-parse).
 * @param currentLang  Active language code (e.g. `'en'`, `'fr'`). Usually
 *                     derived from the `/:lang/...` URL prefix; falls
 *                     back to `app.languages.default` when no prefix.
 * @param languages    `app.languages` block, or `undefined` when the app
 *                     declares no i18n at all (no-op pass-through).
 * @returns            Source with every `$t:key` occurrence replaced by
 *                     the resolved translation. Tokens with no matching
 *                     key are left verbatim (resolver returns the key).
 */
export const resolveMarkdownTranslations = (
  source: string,
  currentLang: string | undefined,
  languages: Languages | undefined
): string => {
  if (languages === undefined) return source
  if (currentLang === undefined) return source
  // `$t:` followed by a dotted/hyphenated identifier — matches the same
  // shape `resolveTranslationPattern` accepts elsewhere in the codebase.
  // Bounded character class avoids greedy matches over surrounding markdown
  // punctuation (e.g. `$t:docs.cta now.` must capture `docs.cta`, not
  // `docs.cta now.`).
  // The key body allows `_ - .` as inner characters but the key must start
  // with `[a-zA-Z0-9_-]` and must NOT end with a `.` so trailing sentence
  // punctuation (`$t:docs.note.`) does not get swallowed into the key.
  // This mirrors common dotted-namespace conventions (`docs.cta`,
  // `common.save`).
  return source.replace(
    /\$t:([a-zA-Z0-9_-](?:[a-zA-Z0-9_.-]*[a-zA-Z0-9_-])?)/g,
    (_match, key: string) => resolveTranslation(key, currentLang, languages)
  )
}
