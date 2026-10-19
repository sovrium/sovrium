/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record a single-comment route's URL names: its record id, and the
 * spellings its table goes by. A table is addressed by its id or its name, and
 * a comment stores whichever the URL it was posted through used.
 */
export interface CommentAddress {
  readonly recordId: string
  readonly tableKeys: readonly string[]
}

/**
 * `true` when the comment was written on the record the URL names.
 *
 * A single-comment route gates its caller on the record in its URL, so a
 * comment that belongs to any other record — one the caller may not be able to
 * read — must answer as a missing comment rather than be reached through a
 * readable URL.
 */
export function belongsToAddress(
  comment: { readonly recordId: string; readonly tableId: string },
  address: CommentAddress
): boolean {
  return (
    String(comment.recordId) === address.recordId &&
    address.tableKeys.includes(String(comment.tableId))
  )
}

/**
 * Every key a table's comments may be stored under: the URL segment a post
 * named — the table's id or its name — and both of those spellings.
 *
 * A comment keeps the spelling it was posted through, so a thread read by one
 * spelling alone misses the comments posted through the other. A table name
 * starts with a letter and an id is a number, so the keys of two tables never
 * meet.
 */
export function commentTableKeysOf(
  table: { readonly id?: number | string | undefined; readonly name: string },
  ...segments: readonly string[]
): readonly string[] {
  const id = table.id === undefined ? [] : [String(table.id)]
  return [...new Set([...segments, ...id, table.name])]
}
