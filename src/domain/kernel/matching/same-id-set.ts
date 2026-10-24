/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether two lists of ids name the same records, whatever their order: each
 * id is read as its text, so `2` and `'2'` are one id, and an id listed twice
 * counts once.
 *
 * A save reads it to tell an untouched link list from a changed one. Each list
 * a save sends REPLACES the record's links, so a list the reader left as it was
 * loaded is kept out of the write — a link made meanwhile, elsewhere, survives
 * it — while a list that differs is sent whole and its removals apply.
 */
export const sameIdSet = (left: readonly unknown[], right: readonly unknown[]): boolean => {
  const ids = new Set(left.map(String))
  const others = new Set(right.map(String))
  return ids.size === others.size && [...ids].every((id) => others.has(id))
}
