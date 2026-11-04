/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The schemes a link (and, in the rich-text profile, an image) keeps by
 * default: navigable, never scripting.
 */
export const DEFAULT_LINK_SCHEMES: readonly string[] = ['http', 'https', 'mailto']

/** Schemes that run code where a link is followed: never kept, whatever a caller asks. */
const SCRIPTING_LINK_SCHEMES: ReadonlySet<string> = new Set(['javascript', 'data', 'vbscript'])

/**
 * The schemes a sanitized `<a href>` keeps when a caller adds some: the
 * default ones, then the caller's that are well-formed URI scheme names (read
 * lower case, without a colon) and never `javascript`, `data` or `vbscript`,
 * whatever the caller's own checks said. Links only: an image's address is
 * never widened. `undefined` when the caller adds nothing, so the profile runs
 * unchanged.
 */
export const linkSchemesWith = (
  extra: readonly string[] | undefined
): readonly string[] | undefined => {
  const added = (extra ?? [])
    .map((scheme) => scheme.trim().toLowerCase())
    .filter(
      (scheme) =>
        /^[a-z][a-z0-9+.-]*$/.test(scheme) &&
        !SCRIPTING_LINK_SCHEMES.has(scheme) &&
        !DEFAULT_LINK_SCHEMES.includes(scheme)
    )
  return added.length === 0 ? undefined : [...new Set([...DEFAULT_LINK_SCHEMES, ...added])]
}
