/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Initials derived from a name — the rung of the avatar fall-back chain most
 * people land on, because most people have never uploaded a picture.
 *
 * It lives in `presentation/utils` because BOTH sides of the SSR/island seam
 * need it and `[internal ref]` forbids either reaching the other:
 * the `avatar` renderer derives them server-side for a record, and the client
 * session fill derives them for the signed-in caller once their name has
 * resolved. One rule, one home — the same reasoning as the shared recipes next
 * door.
 */

/**
 * The first letter of each of a name's first two words, uppercased.
 *
 * "Ada Lovelace" → "AL". A one-word name gives ONE letter, which is the honest
 * answer: inventing a second from the same word would produce "AD" for Ada and
 * read as two people's initials.
 */
export function deriveInitials(label: string): string {
  return label
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => (word[0] ?? '').toUpperCase())
    .join('')
}
