/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The origin grammar shared by every environment variable that names other
 * sites the instance trusts (`SOVRIUM_FRAME_ANCESTORS`, `SOVRIUM_CORS_ORIGINS`).
 *
 * An entry is `https://host` or `https://host:port`, or `http://localhost` /
 * `http://127.0.0.1` with an optional port. No path, no wildcard, no keyword,
 * and no `http://` to any other host: a plain-HTTP origin on a network can be
 * impersonated by anyone on the path, which would hand them the trust the
 * variable grants. Origins are not secrets, so a refusal echoes the entry.
 */

const HTTPS_ORIGIN = /^https:\/\/[a-z0-9.-]+(?::\d{1,5})?$/i
const LOCAL_HTTP_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/i

/**
 * Why one entry of `variable` is refused, or `undefined` when it is an origin
 * the variable may name.
 */
export const originEntryRefusal = (variable: string, entry: string): string | undefined => {
  if (entry === '*' || entry.startsWith("'")) {
    return `${variable}: "${entry}" is not allowed (name each origin)`
  }
  if (entry.includes('*')) return `${variable}: "${entry}" is not allowed (no wildcard host)`
  if (HTTPS_ORIGIN.test(entry) || LOCAL_HTTP_ORIGIN.test(entry)) return undefined
  if (/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+[/?#]/i.test(entry)) {
    return `${variable}: "${entry}" is not an origin (no path allowed)`
  }
  if (/^http:\/\//i.test(entry)) {
    return `${variable}: "${entry}" is not allowed (use https, or http only for localhost)`
  }
  return `${variable}: "${entry}" is not an origin`
}

/** A parsed origin list: unset, the origins it names, or the refusal sentence. */
export type OriginList =
  | { readonly _tag: 'Unset' }
  | { readonly _tag: 'Origins'; readonly origins: readonly string[] }
  | { readonly _tag: 'Refused'; readonly message: string }

/**
 * Split `value` on `separator` and validate every entry. `undefined` (unset)
 * is no list and no refusal; a blank value is a refusal, so a variable set by
 * mistake never silently means "nobody". `normalise` runs on each entry
 * BEFORE it is validated.
 */
export const parseOriginList = (
  variable: string,
  value: string | undefined,
  separator: Readonly<RegExp>,
  normalise: (entry: string) => string = (entry) => entry
): OriginList => {
  if (value === undefined) return { _tag: 'Unset' }
  const entries = value
    .split(separator)
    .filter((entry) => entry !== '')
    .map(normalise)
  if (entries.length === 0) {
    return { _tag: 'Refused', message: `${variable} is set but names no origin` }
  }
  const refusal = entries
    .map((entry) => originEntryRefusal(variable, entry))
    .find((message) => message !== undefined)
  return refusal === undefined
    ? { _tag: 'Origins', origins: entries }
    : { _tag: 'Refused', message: refusal }
}
