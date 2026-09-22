/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI Chat Query Intent Parser
 *
 * Pure domain function that derives a structured {@link QueryIntent} from a
 * natural-language chat message and the app's table metadata. It powers
 * `[internal ref]`.
 *
 * Why a route-side parser rather than trusting the AI provider's response:
 * the E2E mock AI server matches seeded responses by literal substring on the
 * *whole* prompt — the seeded patterns in the query spec (`'count tickets'`,
 * `'top orders'`, …) do NOT occur verbatim in the user messages, so the mock
 * returns its default category text. The chat surface therefore owns query
 * intent extraction: it parses the user's request deterministically, runs the
 * read query, and formats a human-readable reply itself.
 *
 * This mirrors the sibling {@link import('./ai-chat-mutation-parser')} module —
 * a query turn is the read-only counterpart of a mutation turn. The parser is
 * deliberately structural (it accepts the minimal table shape it needs) so it
 * stays in the domain layer with no presentation/application dependency.
 *
 * Recognised query shapes:
 *  - count       — "How many open tickets are there?"
 *  - aggregate   — "What's the average order value this month?" (avg/sum)
 *  - list        — "Which products have less than 5 in stock?"  (top-N, all)
 */

import { findReferencedTable, findSelectOptionMention, QUOTED_RE } from './ai-chat-parsing'

/** Minimal field shape the query parser reads. */
export interface QueryField {
  readonly name: string
  readonly type: string
  /** Predefined option values for single-select / multi-select fields. */
  readonly options?: ReadonlyArray<string>
}

/** Minimal table shape the query parser reads. */
export interface QueryTable {
  readonly name: string
  readonly fields: ReadonlyArray<QueryField>
}

/** A single-column equality filter narrowing a query. */
export interface QueryFilter {
  readonly column: string
  readonly value: string
}

/** A parsed read-query intent. */
export interface QueryIntent {
  /**
   * The aggregation shape the user asked for:
   *  - `count`   — number of matching rows;
   *  - `avg`     — average of a numeric column;
   *  - `sum`     — sum of a numeric column (also covers "total");
   *  - `list`    — the matching rows themselves (default).
   */
  readonly aggregate: 'count' | 'avg' | 'sum' | 'list'
  /** Resolved target table name. */
  readonly table: string
  /** Optional equality filter (e.g. a single-select option mention). */
  readonly filter?: QueryFilter
  /** Numeric column the aggregate applies to (for `avg` / `sum`). */
  readonly aggregateColumn?: string
  /** Row cap requested explicitly (e.g. "top 10" → 10). */
  readonly limit?: number
  /** Column to sort by (e.g. "by revenue" → the matching numeric column). */
  readonly sortColumn?: string
}

/** A capitalised proper-noun run (e.g. "Acme Corp"), matched globally. */
const PROPER_NOUN_RE = /\b[A-Z][\w]*(?:\s+[A-Z][\w]*)*\b/g

/**
 * The parser's own INTENT vocabulary, declared once and consumed three ways:
 * the {@link looksLikeQuery} gate, the {@link resolveAggregate} dispatch, the
 * {@link parseRequestedLimit} cap — and, by derivation, {@link STOP_WORDS}.
 *
 * Why one declaration rather than four hand-written lists: a token the parser
 * has already consumed as INTENT must never be re-consumed as a free-text
 * FILTER VALUE. A hand-maintained stop-word list drifts
 * from the intent regexes the moment either side gains a verb, and the drift is
 * silent — the user is handed an authoritative-looking negative ("No leads
 * records matching Count were found.") at HTTP 200. Deriving the stop words
 * from the same arrays makes the two structurally incapable of disagreeing.
 */

/** Verbs/pronouns that mark a message as a read query ({@link looksLikeQuery}). */
const QUERY_VERB_PHRASES = [
  'show',
  'list',
  'find',
  'count',
  'how many',
  'which',
  'what',
  'average',
  'avg',
  'sum',
  'total',
  'filter',
  'display',
  'get',
] as const

/** Phrases resolving to `aggregate: 'count'`. */
const COUNT_PHRASES = ['how many', 'count', 'number of'] as const

/** Phrases resolving to `aggregate: 'avg'`. */
const AVG_PHRASES = ['average', 'avg', 'mean'] as const

/** Phrases resolving to `aggregate: 'sum'` (`total` is disambiguated below). */
const SUM_PHRASES = ['sum', 'total'] as const

/** Phrases introducing an explicit row cap ({@link parseRequestedLimit}). */
const LIMIT_PHRASES = ['top', 'first', 'limit', 'last'] as const

/**
 * Word-boundary alternation regexes, each COMPILED FROM the phrase array above
 * it — so a phrase can never be recognised by a regex without also becoming a
 * stop word, which is the invariant this whole block exists to hold.
 */
const QUERY_VERB_RE = new RegExp(`\\b(${QUERY_VERB_PHRASES.join('|')})\\b`)
const COUNT_RE = new RegExp(`\\b(${COUNT_PHRASES.join('|')})\\b`)
const AVG_RE = new RegExp(`\\b(${AVG_PHRASES.join('|')})\\b`)
// `total` is handled separately below — it is ambiguous between a sum verb and
// a sort-key column name, so it needs the `by total` exclusion.
const SUM_RE = new RegExp(`\\b(${SUM_PHRASES.filter((phrase) => phrase !== 'total').join('|')})\\b`)
const LIMIT_RE = new RegExp(`\\b(?:${LIMIT_PHRASES.join('|')})\\s+(\\d+)\\b`)

/**
 * Grammatical filler that is capitalised at a sentence start but is not an
 * entity name. Distinct from the intent vocabulary above: these words carry no
 * intent, they are simply never entity names.
 */
const GRAMMATICAL_STOP_WORDS = ['whats', 'who', 'now', 'the', 'a', 'an'] as const

/**
 * Words skipped when guessing a free-text filter value, so "What's the total
 * for Acme Corp" filters on "Acme Corp" — not on "What", and not on "Total".
 *
 * DERIVED, never hand-listed: the union of every intent phrase (split into its
 * component words, so "how many" contributes both "how" and "many") and the
 * grammatical filler above. Adding a verb to any intent array above therefore
 * makes it a stop word in the same edit.
 */
const STOP_WORDS: ReadonlySet<string> = new Set(
  [
    ...QUERY_VERB_PHRASES,
    ...COUNT_PHRASES,
    ...AVG_PHRASES,
    ...SUM_PHRASES,
    ...LIMIT_PHRASES,
    ...GRAMMATICAL_STOP_WORDS,
  ].flatMap((phrase) => phrase.split(/\s+/).map((word) => word.toLowerCase()))
)

/**
 * Find a single-select option value mentioned in the message and build an
 * equality filter from it (e.g. "open tickets" → `status = 'open'`). Thin
 * adapter over the shared {@link findSelectOptionMention} primitive — it maps
 * the mention's `field` onto the {@link QueryFilter}'s `column`.
 */
const findSelectFilter = (message: string, table: QueryTable): QueryFilter | undefined => {
  const mention = findSelectOptionMention(message, table.fields)
  return mention === undefined ? undefined : { column: mention.field, value: mention.value }
}

/**
 * Find a free-text equality filter from a quoted literal or a proper-noun run
 * (e.g. "for Acme Corp" → `<first text column> = 'Acme Corp'`). Used for
 * cross-table-style queries that name an entity rather than a select option.
 */
const findTextFilter = (message: string, table: QueryTable): QueryFilter | undefined => {
  const textField = table.fields.find(
    (field) => field.type === 'single-line-text' || field.type === 'long-text'
  )
  if (textField === undefined) return undefined
  const quoted = message.match(QUOTED_RE)?.[1]
  const properNoun = pickEntityProperNoun(message)
  const value = quoted ?? properNoun
  return value !== undefined ? { column: textField.name, value } : undefined
}

/**
 * Pick a free-text entity name from a message: the first capitalised run that
 * is not a single sentence-start stop word. A multi-word run ("Acme Corp") is
 * always accepted; a single-word run is accepted only when it is not a stop
 * word.
 */
const pickEntityProperNoun = (message: string): string | undefined => {
  const runs = message.match(PROPER_NOUN_RE) ?? []
  return runs.find((run) => {
    const words = run.split(/\s+/)
    if (words.length > 1) return true
    return !STOP_WORDS.has(run.toLowerCase())
  })
}

/** Parse an explicit "top N" / "first N" / "limit N" row cap from the message. */
const parseRequestedLimit = (lower: string): number | undefined => {
  const match = lower.match(LIMIT_RE)
  return match?.[1] !== undefined ? Number(match[1]) : undefined
}

/** Resolve the numeric column an aggregate / sort phrase refers to. */
const findNumericColumn = (message: string, table: QueryTable): string | undefined => {
  const lower = message.toLowerCase()
  const numericFields = table.fields.filter((field) => field.type === 'number')
  // Prefer a numeric field whose name is mentioned by the user.
  const named = numericFields.find((field) => lower.includes(field.name.toLowerCase()))
  return (named ?? numericFields[0])?.name
}

/**
 * Decide whether a message looks like a read query — a question, a
 * "show/list/find" verb, an aggregate word, or a "filter" follow-up. This
 * keeps plain chatter from being misread as a query.
 */
const looksLikeQuery = (message: string, lower: string): boolean =>
  /\?/.test(message) || QUERY_VERB_RE.test(lower)

/**
 * Resolve the aggregate shape of a query message.
 *
 * "total" is ambiguous — it is both a sum verb ("total order value") and a
 * common numeric column name used as a sort key ("orders by total"). It is
 * treated as a sum verb only when it is NOT used as a sort key ("by total").
 */
const resolveAggregate = (lower: string): QueryIntent['aggregate'] => {
  if (COUNT_RE.test(lower)) return 'count'
  if (AVG_RE.test(lower)) return 'avg'
  const totalAsVerb = /\btotal\b/.test(lower) && !/\bby\s+total\b/.test(lower)
  if (SUM_RE.test(lower) || totalAsVerb) return 'sum'
  return 'list'
}

/**
 * Assemble a {@link QueryIntent}, including each optional field only when it is
 * defined so the result honours the `exactOptionalPropertyTypes` contract.
 */
const buildIntent = (parts: {
  readonly aggregate: QueryIntent['aggregate']
  readonly table: string
  readonly filter: QueryFilter | undefined
  readonly aggregateColumn: string | undefined
  readonly limit: number | undefined
  readonly sortColumn: string | undefined
}): QueryIntent => ({
  aggregate: parts.aggregate,
  table: parts.table,
  ...(parts.filter !== undefined && { filter: parts.filter }),
  ...(parts.aggregateColumn !== undefined && { aggregateColumn: parts.aggregateColumn }),
  ...(parts.limit !== undefined && { limit: parts.limit }),
  ...(parts.sortColumn !== undefined && { sortColumn: parts.sortColumn }),
})

/**
 * Derive a {@link QueryIntent} from a chat message, or `undefined` when the
 * message is not a recognised read query.
 *
 * `fallbackTable` is the last table queried in the same session — it lets a
 * follow-up question ("Now filter by high priority") resolve a table even
 * though the message names no table.
 */
export const parseQueryIntent = (
  message: string,
  tables: ReadonlyArray<QueryTable>,
  fallbackTable?: string
): QueryIntent | undefined => {
  const lower = message.toLowerCase()
  const resolved =
    findReferencedTable(message, tables) ?? tables.find((table) => table.name === fallbackTable)
  if (resolved === undefined || !looksLikeQuery(message, lower)) return undefined

  const aggregate = resolveAggregate(lower)
  const wantsAggregateColumn = aggregate === 'avg' || aggregate === 'sum'
  return buildIntent({
    aggregate,
    table: resolved.name,
    filter: findSelectFilter(message, resolved) ?? findTextFilter(message, resolved),
    aggregateColumn: wantsAggregateColumn ? findNumericColumn(message, resolved) : undefined,
    limit: parseRequestedLimit(lower),
    sortColumn: /\bby\b/.test(lower) ? findNumericColumn(message, resolved) : undefined,
  })
}
