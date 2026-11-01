/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Record values that BEGIN an address attribute of an author's tag.
 *
 * HTML-escaping a record value keeps it inside the author's attribute, but it
 * does not make it a safe ADDRESS: `href="$record.website"` filled with a
 * stored `javascript:…` is a well-formed attribute that runs script when it is
 * followed, and `src="$record.portrait"` filled with `data:…` loads content
 * the author never chose. When a token is the START of an `href`, `src`,
 * `action` or `formaction` value, the record decides the scheme — so the
 * substituted value is written only when {@link toSafeAssetUrl} admits it (a
 * web address, or a path on this site), and the address is left EMPTY
 * otherwise. Empty rather than `#`: an empty `src` fetches nothing, where `#`
 * would request the page again.
 *
 * A token placed after the author's own text (`href="/m/$record.slug"`) does
 * not choose the scheme — the author did — and is filled exactly as before.
 */

import { toSafeAssetUrl } from '@/domain/kernel/url/asset-url-safety'
import { substituteScopedVars } from '@/domain/models/app/pages/substitute-record-vars'

type Scopes = Readonly<Record<string, Readonly<Record<string, unknown>>>>

/**
 * One address attribute, its name and `=` (capture 1) and its value, quoted or
 * not (capture 2). Used to SPLIT a tag, so the split keeps both captures.
 */
const ADDRESS_ATTRIBUTE =
  /(\s(?:href|src|action|formaction)\s*=\s*)("[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi

/** A value opening on an unescaped token: its namespace is capture 1. */
const LEADING_TOKEN = /^\$([a-zA-Z_]\w*)\.\w/

/** The value of one address attribute, the record deciding its scheme or not. */
const fillAddressValue = (
  quoted: string,
  scopes: Scopes,
  escape: (value: string) => string
): string => {
  const quote = quoted.startsWith('"') || quoted.startsWith("'") ? quoted.charAt(0) : ''
  const value = quote === '' ? quoted : quoted.slice(1, -1)
  const namespace = LEADING_TOKEN.exec(value)?.[1]
  if (namespace === undefined || !Object.hasOwn(scopes, namespace)) {
    return substituteScopedVars(quoted, scopes, escape)
  }
  const address = toSafeAssetUrl(substituteScopedVars(value, scopes))
  return `${quote}${address === undefined ? '' : escape(address)}${quote}`
}

/**
 * Fill the tokens of ONE author tag (`<a href="$record.website">`): each value
 * escaped by `escape`, and an address attribute the record would open held to
 * a web address or a site path. One pass per part, so a filled value is never
 * scanned again.
 */
export const fillAuthorTag = (
  tag: string,
  scopes: Scopes,
  escape: (value: string) => string
): string =>
  tag
    .split(ADDRESS_ATTRIBUTE)
    .map((part, index) =>
      // `split` with two captures yields [text, name=, value, text, name=, value, …].
      index % 3 === 2
        ? fillAddressValue(part, scopes, escape)
        : substituteScopedVars(part, scopes, escape)
    )
    .join('')
