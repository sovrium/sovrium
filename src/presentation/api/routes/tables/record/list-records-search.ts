/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { filterReadableFields } from '@/domain/validators/field-read-filter'
import type { FilterStructure } from './row-level-read-helpers'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Translate a `?q=` search term into a filter the record query can execute.
 *
 * Search has to run in the QUERY, across the whole table. A client filtering the
 * page it already holds cannot find a record that sits on a later page, and it
 * does not fail quietly: it renders "no results", telling the user data that is
 * plainly in the table does not exist. Expressing the term as a filter also
 * makes `pagination.total` the count of MATCHING rows for free, so the pager
 * stops offering pages of a result set that no longer has them.
 *
 * Field types are restricted to the text-shaped ones. A substring match against
 * a number, date or boolean column is not meaningful, and on PostgreSQL `LIKE`
 * against a non-text column is an outright error — one such column in the table
 * would turn every search into a 500.
 */

/**
 * Field types a substring search can meaningfully target.
 *
 * Computed types (`formula`, `lookup`, `rollup`, `count`) are excluded even when
 * they render as text: they are view expressions rather than stored columns, and
 * their result type is not knowable from the field type alone.
 */
const SEARCHABLE_FIELD_TYPES: ReadonlySet<string> = new Set([
  'single-line-text',
  'long-text',
  'rich-text',
  'email',
  'url',
  'phone-number',
  'single-select',
  'status',
  'code',
  'barcode',
])

/**
 * The searchable columns this role is allowed to read.
 *
 * Readability is decided by the same function that shapes the response, applied
 * to a probe record, so search can never match on a value the caller would not
 * have been shown — otherwise the mere presence of a row in the results would
 * disclose the content of a field hidden from them.
 */
const resolveSearchableColumns = (
  app: App,
  tableName: string,
  userRole: string,
  table: Table | undefined
): readonly string[] => {
  const searchable = (table?.fields ?? [])
    .filter((field) => SEARCHABLE_FIELD_TYPES.has(field.type))
    .map((field) => field.name)
  if (searchable.length === 0) return []

  const probe = Object.fromEntries(searchable.map((name) => [name, '']))
  const readable = filterReadableFields({ app, tableName, userRole, record: probe })
  return searchable.filter((name) => name in readable)
}

export interface SearchFilterInput {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly table: Table | undefined
}

/**
 * The `?q=` term this request will actually be filtered by — trimmed, with an
 * empty or whitespace-only value meaning "no search" rather than "match
 * nothing".
 *
 * Exported because TWO things must agree about it and they live in different
 * functions: the filter built below, and the `appliedQuery` the response echoes
 * back so the grid knows not to narrow the page a second time
 * (`src/domain/models/api/_shared/search.ts`). Deriving the term twice is how
 * they drift — a route that filtered on `'Zinc'` while reporting `'  Zinc  '`
 * would still switch the client filter off, but would be lying about which
 * question it answered.
 */
export const readSearchTerm = (c: Context): string | undefined => {
  const term = c.req.query('q')?.trim()
  return term ? term : undefined
}

/**
 * Build the `?q=` search filter, or `undefined` when the request carries no
 * search term.
 *
 * With a term but no searchable column the result is an empty `or` group, which
 * the WHERE builder renders as "match nothing". That is the honest answer: there
 * is nowhere for the term to match, so returning the unfiltered table would
 * claim every row matched.
 */
export const buildSearchFilter = (input: SearchFilterInput): FilterStructure => {
  const { c, app, tableName, userRole, table } = input

  const term = readSearchTerm(c)
  if (!term) return undefined

  const columns = resolveSearchableColumns(app, tableName, userRole, table)
  return {
    and: [{ or: columns.map((field) => ({ field, operator: 'contains', value: term })) }],
  }
}
