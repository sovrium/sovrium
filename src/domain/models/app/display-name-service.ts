/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The name to print for an app: its `displayName` when declared, else its
 * `name` exactly as declared.
 *
 * The fallback is the slug VERBATIM — not title-cased, not de-scoped — because
 * the surfaces that move onto this helper print `name` verbatim today (the
 * default home page heading, its `<title>`), and an app that declares no
 * display name must render byte-for-byte as it did. Title-casing stays the
 * business of `$app.label`, which already did it before this key existed.
 */
export const displayNameOf = (app: {
  readonly name: string
  readonly displayName?: string | undefined
}): string => app.displayName ?? app.name

/**
 * The monogram that stands for an app with no logo: the first letter of the
 * first and of the last word of its display name, uppercased — one letter for
 * a one-word name. Words split on spaces, `-` and `_`, so a slug fallback
 * (`acme-crm`) reads `AC` as its title-cased label does.
 */
export const monogramOf = (displayName: string): string => {
  const words = displayName.split(/[\s_-]+/).filter((word) => word.length > 0)
  const first = words[0]
  const last = words.length > 1 ? words.at(-1) : undefined
  return [first, last]
    .map((word) => (word === undefined ? '' : (Array.from(word)[0] ?? '')))
    .join('')
    .toUpperCase()
}
