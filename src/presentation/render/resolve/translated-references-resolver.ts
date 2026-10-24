/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapStringsDeep } from '@/domain/kernel/config-parsing/map-strings-deep'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'

/** A reference a page pass fills: the page's record, the app's facts, a route segment. */
const BODY_REFERENCE = /\$(?:record|app|param)\./

/** The head fills `$app.*` and `$param.*` itself, per language; only the record is the page's. */
const HEAD_REFERENCE = /\$record\./

/** `card` with its `description` passed through `translate`, when it has one. */
const withTranslatedDescription = <T extends { readonly description?: string | undefined }>(
  card: T,
  translate: (text: string) => string
): T =>
  typeof card.description === 'string'
    ? { ...card, description: translate(card.description) }
    : card

/**
 * Translate, ahead of the reference passes, every `$t:` value whose translation
 * carries a reference those passes fill — so a byline written as
 * `'post.byline': 'Written by $record.author'` names each post's author in
 * every language, rather than printing the reference.
 *
 * Translation normally happens at render, after the passes have run; a
 * reference that only appears once the key is translated would then stay
 * verbatim. So the order is reversed for exactly those values: translate first
 * (in the served language), then let the record, `$app.*` and `$param.*`
 * passes fill what the translation brought. A row template (a
 * `contentFrom.template` naming a key) is translated once here and filled per
 * row by its own pass.
 *
 * Every other `$t:` value is left as the key, so the renderer's own
 * translation — and its per-language data — is unchanged. A `meta.title`, a
 * `meta.description` or a sharing card's description is translated here only
 * for a `$record.*` reference: the head fills `$app.*` and `$param.*` in every
 * language itself, and a title naming the page's record is composed for the
 * served language. So the three descriptions resolve alike.
 */
export function translateReferencedKeys(
  page: Page,
  lang: string,
  languages: Languages | undefined
): Page {
  if (languages?.translations === undefined) return page
  const translateIf =
    (reference: RegExp) =>
    (text: string): string => {
      if (!text.startsWith('$t:')) return text
      const translated = resolveTranslationPattern(text, lang, languages)
      return reference.test(translated) ? translated : text
    }
  const { meta } = page
  const head = translateIf(HEAD_REFERENCE)
  return {
    ...page,
    components: mapStringsDeep(page.components, translateIf(BODY_REFERENCE)) as Page['components'],
    ...(page.layout !== undefined && {
      layout: mapStringsDeep(page.layout, translateIf(BODY_REFERENCE)) as Page['layout'],
    }),
    ...(meta !== undefined && {
      meta: {
        ...meta,
        ...(typeof meta.title === 'string' && { title: head(meta.title) }),
        ...(typeof meta.description === 'string' && { description: head(meta.description) }),
        ...(meta.openGraph !== undefined && {
          openGraph: withTranslatedDescription(meta.openGraph, head),
        }),
        ...(meta.twitter !== undefined && {
          twitter: withTranslatedDescription(meta.twitter, head),
        }),
      },
    }),
  }
}
