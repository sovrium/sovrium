/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Argument validation for the raw internal `_list` MCP tools and the
 * tool-call ledger list: `limit`, `since`, `where` and `after`.
 *
 * Pure: it takes the table's physical columns and their types (read from the
 * engine's catalogue by the repository) and the registry denylist, and answers
 * either a validated query — every column name in which is one the table really
 * has, every value one its column can hold — or the refusal message the tool
 * sends back as invalid params. Deciding the value check here, from the
 * catalogue, rather than by catching the database's error is what makes the
 * SQLite default refuse what PostgreSQL would have failed on.
 */

import { DateTime, Option } from 'effect'
import { classifyDriverFailure } from '@/domain/errors/driver-failure'
import type {
  McpInternalColumn,
  McpInternalColumnKind,
  McpInternalEquality,
  McpInternalListQuery,
} from '@/application/ports/repositories/mcp/mcp-internals-repository'

/**
 * The time column a list orders by and `since` applies to: the first of these
 * the table has. `created_at` for most tables; a form submission and a pause
 * carry their own event time instead. A table with none of them lists by `id`
 * descending and refuses `since`.
 */
const TIME_COLUMNS = ['created_at', 'submitted_at', 'paused_at'] as const

/** The listing arguments every raw list tool takes, all optional and composable. */
export const LIST_TOOL_PROPERTIES = {
  limit: {
    type: 'integer',
    minimum: 1,
    maximum: 1000,
    description: 'Rows per page, 1 to 1000. Defaults to 50.',
  },
  since: {
    type: 'string',
    format: 'date-time',
    description:
      'An ISO 8601 instant: keep the rows whose time column is at or after it. Refused on a table with no time column.',
  },
  where: {
    type: 'object',
    additionalProperties: { type: ['string', 'number', 'boolean', 'null'] },
    description:
      'Column: value equalities, all of which must hold. Only a column the rows answer may be named.',
  },
  after: {
    type: 'string',
    description:
      'The id of the last row of the previous page: the next page continues strictly after it. An empty page is the end.',
  },
} as const

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 1000

/**
 * ONE message for a column the table does not have and a column it withholds,
 * whatever the value: an equality filter on a withheld column that answered a
 * row for the right value and none for a wrong one would be an oracle for it.
 * It names neither the column nor the value.
 */
export const WHERE_COLUMN_REFUSAL =
  "'where' may only name a column this tool answers; see the rows it returns for the column names"

/**
 * ONE message for every `where` value its column cannot hold — a word for a
 * flag, a phrase for a time, anything for a JSON column, a nested object. Like
 * {@link WHERE_COLUMN_REFUSAL} it repeats neither the value nor the column.
 */
export const WHERE_VALUE_REFUSAL =
  "a 'where' value does not fit its column's type; see the rows this tool returns for the values each column holds"

/**
 * True when the database refused a value as data its column cannot hold — a
 * type the catalogue check above does not know. That is still the caller's
 * mistake, so the list answers {@link WHERE_VALUE_REFUSAL} as invalid params
 * rather than a failed query; every other failure stays an internal error.
 */
export const isRefusedValue = (error: unknown): boolean => {
  const failure = classifyDriverFailure(error)
  return failure.origin === 'caller-input' && failure.rejection === 'data-exception'
}

/** A date, or a date-time carrying its zone. A zone-less date-time is not an instant. */
const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2}))?$/

export type InternalListArguments =
  | { readonly _tag: 'Valid'; readonly query: McpInternalListQuery }
  | { readonly _tag: 'Invalid'; readonly message: string }

const invalid = (message: string): InternalListArguments => ({ _tag: 'Invalid', message })

const camelToSnake = (s: string): string => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)

const parseLimit = (raw: unknown): number =>
  typeof raw === 'number' && raw > 0 ? Math.floor(Math.min(raw, MAX_LIMIT)) || 1 : DEFAULT_LIMIT

/** `undefined` when absent, a `Date` for an instant, `false` for anything else. */
const parseSince = (raw: unknown): Date | undefined | false => {
  if (raw === undefined) return undefined
  if (typeof raw !== 'string' || !ISO_INSTANT.test(raw)) return false
  return Option.match(DateTime.make(raw), {
    onNone: () => false as const,
    onSome: (instant) => DateTime.toDateUtc(instant),
  })
}

const NUMERIC_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
const UUID_TEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isNumeric = (value: unknown): boolean =>
  isFiniteNumber(value) || (typeof value === 'string' && NUMERIC_TEXT.test(value))

const isInstant = (value: unknown): boolean =>
  typeof value === 'string' && typeof parseSince(value) === 'object'

const isFlag = (value: unknown): value is boolean => typeof value === 'boolean'

/**
 * Per column family: the value as it is bound, or `undefined` when the column
 * cannot hold it. A number on a text column compares as its decimal text; every
 * other accepted value is bound unchanged.
 */
const FIT_BY_KIND: Readonly<
  Record<McpInternalColumnKind, (value: unknown) => McpInternalEquality['value'] | undefined>
> = {
  boolean: (value) => (isFlag(value) ? value : undefined),
  number: (value) => (isNumeric(value) ? (value as string | number) : undefined),
  'number-or-boolean': (value) =>
    isNumeric(value) || isFlag(value) ? (value as string | number | boolean) : undefined,
  time: (value) => (isInstant(value) ? (value as string) : undefined),
  uuid: (value) => (typeof value === 'string' && UUID_TEXT.test(value) ? value : undefined),
  text: (value) =>
    typeof value === 'string' ? value : isFiniteNumber(value) ? String(value) : undefined,
  json: () => undefined,
  other: (value) =>
    typeof value === 'string' || isFlag(value) || isFiniteNumber(value) ? value : undefined,
}

/** `null` fits every column (`IS NULL`); anything else is judged by the column's family. */
const fitValue = (
  kind: McpInternalColumnKind,
  value: unknown
): McpInternalEquality['value'] | undefined => (value === null ? null : FIT_BY_KIND[kind](value))

type WhereResult = ReadonlyArray<McpInternalEquality> | { readonly refusal: string }

const parseWhere = (
  raw: unknown,
  columns: ReadonlyMap<string, McpInternalColumnKind>,
  denied: ReadonlySet<string>
): WhereResult => {
  if (raw === undefined) return []
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { refusal: "'where' must be an object of column: value pairs" }
  }
  const entries = Object.entries(raw as Record<string, unknown>)
  const resolved = entries.map(([key, value]) => {
    const column = columns.has(key) ? key : camelToSnake(key)
    const answerable = columns.has(column) && !denied.has(key) && !denied.has(column)
    return { column: answerable ? column : undefined, value }
  })
  // Every column is judged before any value, so a withheld column is refused
  // the same way whatever value came with it.
  if (resolved.some((entry) => entry.column === undefined)) return { refusal: WHERE_COLUMN_REFUSAL }
  const fitted = resolved.map((entry) => {
    const column = entry.column as string
    const kind = columns.get(column) ?? 'other'
    return { column, kind, value: fitValue(kind, entry.value) }
  })
  if (fitted.some((entry) => entry.value === undefined)) return { refusal: WHERE_VALUE_REFUSAL }
  return fitted.map((entry) => ({
    column: entry.column,
    kind: entry.kind,
    value: entry.value as McpInternalEquality['value'],
  }))
}

/** `undefined` when absent, the id as text, `false` for anything else. */
const parseAfter = (raw: unknown): string | undefined | false => {
  if (raw === undefined) return undefined
  if (typeof raw === 'string' && raw.length > 0) return raw
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  return false
}

/**
 * Validate a raw `_list` call's arguments against the table's columns.
 *
 * @param args - the `tools/call` arguments, as the client sent them
 * @param columns - the columns the tool answers, with their catalogue types
 * @param denylistFields - the registry denylist, matched in both spellings
 */
export const parseInternalListArguments = (
  args: Readonly<Record<string, unknown>>,
  columns: ReadonlyArray<McpInternalColumn>,
  denylistFields: ReadonlyArray<string>
): InternalListArguments => {
  const columnKinds = new Map(columns.map((column) => [column.name, column.kind] as const))
  const denied = new Set(denylistFields.flatMap((field) => [field, camelToSnake(field)]))
  const timeColumn = TIME_COLUMNS.find((column) => columnKinds.has(column))

  const since = parseSince(args['since'])
  if (since === false) return invalid("'since' must be an ISO 8601 instant")
  if (since !== undefined && timeColumn === undefined) {
    return invalid("'since' is not available: this table has no time column")
  }

  const where = parseWhere(args['where'], columnKinds, denied)
  if ('refusal' in where) return invalid(where.refusal)

  const after = parseAfter(args['after'])
  if (after === false) return invalid("'after' must be the id of the last row of the previous page")

  return {
    _tag: 'Valid',
    query: { limit: parseLimit(args['limit']), timeColumn, since, where, after },
  }
}
