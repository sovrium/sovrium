/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `field:direction` sort spelling every Sovrium grid emits.
 *
 * A data-table column header serialises its sort as ONE parameter —
 * `?sort=size:desc` — because that is what the record API has always taken and
 * what the island's `buildSortParam` therefore builds. Several admin read
 * endpoints grew a `?sort=` + `?order=` PAIR instead, so a header click sent a
 * spelling the endpoint had never been taught: the file browser answered 400
 * where the operator asked for an ordering, and the user directory silently
 * ignored it.
 *
 * This is the one place that reads the combined spelling, so the two dialects
 * cannot drift apart again. It splits and nothing else: WHICH fields and which
 * directions an endpoint can serve stays that endpoint's own contract, so an
 * unsupported key still fails its schema and answers 400 rather than being
 * quietly served in whatever order the store happened to yield.
 */

/** One parsed sort instruction. `direction` is absent when none was spelled. */
export interface SortSpec {
  readonly field: string
  readonly direction?: string
}

/**
 * Split a `field:direction` sort parameter into its two halves.
 *
 * - `undefined` / empty / whitespace-only → `undefined` ("no sort requested"),
 *   which lets the caller's schema apply its own default.
 * - `'size'` → `{ field: 'size' }` — the pair spelling, unchanged. The caller
 *   keeps reading its separate `?order=`.
 * - `'size:desc'` → `{ field: 'size', direction: 'desc' }`.
 * - `'size:'` → `{ field: 'size', direction: '' }`. A trailing colon is a
 *   MALFORMED request, not an omitted direction: returning the field alone
 *   would let it fall through to the default and answer 200 for a parameter
 *   the caller never managed to spell. The empty direction fails the caller's
 *   enum, which is a 400 — the honest answer.
 * - `'a:b:c'` → `{ field: 'a', direction: 'b:c' }`, split at the FIRST colon,
 *   so the surplus lands in the direction and is refused there.
 */
export function parseSortSpec(raw: string | undefined): SortSpec | undefined {
  const trimmed = raw?.trim()
  if (!trimmed) return undefined

  const separator = trimmed.indexOf(':')
  if (separator === -1) return { field: trimmed }

  const field = trimmed.slice(0, separator).trim()
  if (!field) return undefined
  return { field, direction: trimmed.slice(separator + 1).trim() }
}
