/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { tableHasIdColumn } from './searchable-text-columns'

/**
 * The word search of a `long-text` field declared `fullTextSearch`, and the one
 * tokenizer every full-text query in the engine is cut with.
 *
 * ## One tokenizer, two engines
 *
 * SQLite indexes with FTS5's `unicode61`, which splits on every character that
 * is not a letter or a digit. PostgreSQL's parser does not — it keeps an
 * address, a path or `user_id` as one token — so the PostgreSQL index replaces
 * every non-alphanumeric run with a space before parsing. Both therefore index
 * the WORDS below, and a query cut by {@link searchWords} asks both engines for
 * the same thing. A second tokenizer, anywhere, is how the two would drift.
 *
 * ## The grammar
 *
 * Bare words are ANDed, each matching the start of a word. A double-quoted span
 * is a phrase of whole adjacent words. Nothing else is syntax: `-`, `*`, `OR`,
 * `NEAR`, `:`, parentheses and an unpaired quote are separators, because every
 * one of them is cut away by {@link searchWords} before a word reaches an
 * engine. A query with no word in it yields no term, which the caller answers
 * with "nothing matches" rather than with every row.
 */

/**
 * The internal filter operator a declared word search travels as, from the
 * records route to the SQL WHERE builder. It is NOT in the records API's
 * public filter vocabulary: a caller cannot send it, only `?q=` produces it.
 */
export const WORD_SEARCH_OPERATOR = 'matchesWords'

/** What a word-search filter leaf carries; its `field` is the searched column. */
export interface WordSearchValue {
  /** The `?q=` term, as typed — cut into terms by the WHERE builder. */
  readonly query: string
  /** The app table the field belongs to — names the SQLite full-text mirror. */
  readonly table: string
  /**
   * Whether the table has the SQLite full-text mirror (it needs an `id`). A
   * field on a table without it is searched as a substring on SQLite.
   */
  readonly mirrored: boolean
}

/** One term of a parsed query: a word matched as a prefix, or a phrase of whole words. */
export type WordSearchTerm =
  | { readonly kind: 'prefix'; readonly word: string }
  | { readonly kind: 'phrase'; readonly words: readonly string[] }

/**
 * Split text into lower-case words: runs of letters and digits.
 *
 * Unicode-aware (`\p{L}\p{N}`) rather than `[a-z0-9]`: an ASCII-only split turns
 * `Müller` into `m` and `ller`, neither of which either engine indexed.
 */
export const searchWords = (text: string): readonly string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0)

/**
 * The query's quote-delimited segments, with an unpaired final quote read as a
 * separator: an odd number of `"` leaves the last one without a partner, so the
 * text on both sides of it is joined back into one unquoted segment.
 */
const quoteSegments = (query: string): readonly string[] => {
  const segments = query.split('"')
  if (segments.length % 2 === 1) return segments
  return [...segments.slice(0, -2), `${segments.at(-2) ?? ''} ${segments.at(-1) ?? ''}`]
}

/**
 * Parse a `?q=` term into word-search terms.
 *
 * Even segments (outside quotes) contribute one prefix term per word; odd
 * segments (inside a pair of quotes) contribute one phrase, when they hold a
 * word at all.
 */
export const parseWordSearchQuery = (query: string): readonly WordSearchTerm[] =>
  quoteSegments(query).flatMap((segment, index): readonly WordSearchTerm[] => {
    const words = searchWords(segment)
    if (index % 2 === 0) return words.map((word) => ({ kind: 'prefix', word }))
    return words.length > 0 ? [{ kind: 'phrase', words }] : []
  })

/** The slice of a table this module reads. */
interface WordSearchTable {
  readonly name: string
  readonly fields: readonly { readonly name: string; readonly type: string }[]
  readonly primaryKey?: { readonly type?: string; readonly fields?: readonly string[] }
}

/** The `long-text` fields of a table declared `fullTextSearch: true`, in declaration order. */
export const wordSearchFields = (table: WordSearchTable | undefined): readonly string[] =>
  (table?.fields ?? [])
    .filter(
      (field) =>
        field.type === 'long-text' &&
        (field as { readonly fullTextSearch?: unknown }).fullTextSearch === true
    )
    .map((field) => field.name)

/** The value of a word-search leaf over `table` for the term `query`. */
export const wordSearchValue = (table: WordSearchTable, query: string): WordSearchValue => ({
  query,
  table: table.name,
  mirrored: tableHasIdColumn(table),
})

/** Whether an unknown filter-leaf value is a {@link WordSearchValue}. */
export const isWordSearchValue = (value: unknown): value is WordSearchValue => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Readonly<Record<string, unknown>>
  return (
    typeof candidate['query'] === 'string' &&
    typeof candidate['table'] === 'string' &&
    typeof candidate['mirrored'] === 'boolean'
  )
}
