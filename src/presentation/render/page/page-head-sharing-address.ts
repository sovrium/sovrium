/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toSafeAssetUrl } from '@/domain/kernel/url/asset-url-safety'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'
import type { OpenGraph } from '@/domain/models/app/pages/meta'

/**
 * `address` when it is an `http:`/`https:` URL or a same-origin path, else
 * `undefined`: a canonical or sharing address resolved from a record is free
 * text, and a `javascript:` value an editor typed must leave the tag out
 * rather than reach the head. The address is kept as written, not normalised.
 */
export const checkedAddress = (address: string | undefined): string | undefined =>
  address === undefined || toSafeAssetUrl(address) === undefined ? undefined : address

/** The sharing card with its resolved `url` checked by {@link checkedAddress}. */
export function withCheckedUrl(
  openGraph: OpenGraph | undefined,
  lang: string,
  languages: Languages | undefined
): OpenGraph | undefined {
  if (openGraph?.url === undefined) return openGraph
  const { url, ...rest } = openGraph
  const checked = checkedAddress(resolveTranslationPattern(url, lang, languages))
  return checked === undefined ? rest : { ...rest, url: checked }
}
