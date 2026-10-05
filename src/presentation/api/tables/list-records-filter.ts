/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  describeUnknownRelativeDate,
  resolveRelativeDatesIn,
  unknownRelativeDateTokens,
  utcCalendarDay,
} from '@/domain/models/app/pages/components/relative-date-filter'
import {
  FILTER_OPERATOR_VOCABULARY,
  isVocabularyTerm,
  unknownTermRefusal,
} from '@/domain/models/app/tables/closed-vocabulary'
import { serverNow } from '@/domain/models/process-env/dev-clock'
import { validateFilterParam } from './field-permission-validation'
import { parseFilterParameter } from './filter-parser'
import { parseFormulaToFilter } from './formula-parser'
import type { FilterStructure } from './row-level-read-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

type FilterResult =
  | { readonly error: false; readonly value: FilterStructure }
  | { readonly error: true; readonly response?: Response }

/**
 * Parse the caller-supplied filter (formula or standard filter) and check every
 * field it names against the caller's field-read permissions.
 *
 * The permission check belongs HERE, at the single point where a request
 * becomes a filter, for two reasons:
 *
 *  - It is the last place the filter is still purely the CALLER's. Downstream,
 *    `buildListFilter` merges the saved view's filter, the `?q=` search group
 *    and the row-level read predicate into the same tree; validating after that
 *    checks server-authored clauses against the caller (see the warning on
 *    `validateFilterParam`).
 *  - It covers every shape at once. `?filterByFormula=`, `?filter=` as JSON and
 *    `?filter=field:value` all converge on one value here, so the rule is
 *    stated once instead of once per parser — which is how `?filterByFormula=`
 *    came to have no parse-time check at all.
 */
export function parseFilter(
  c: Context,
  app: App,
  tableName: string,
  caller: Readonly<{ userRole: string; userGroups: readonly string[] }>
): FilterResult {
  const { userRole, userGroups } = caller
  const parsed = parseFilterInput(c, app, tableName)
  if (parsed.error) return parsed

  const denied = validateFilterParam(parsed.value, { app, tableName, userRole, userGroups, c })
  if (denied) return { error: true, response: denied }
  // After the permission check, so a field the caller may not read is refused
  // as such rather than described.
  const nonBoolean = refuseNonBooleanOperand(c, app, tableName, parsed.value)
  return nonBoolean ?? parsed
}

/**
 * `isTrue` / `isFalse` compare a column with a boolean. On a column holding
 * none, PostgreSQL failed the query (a 500) and SQLite matched no row; the
 * request is refused instead, naming the field and what the operator takes.
 */
function refuseNonBooleanOperand(
  c: Context,
  app: App,
  tableName: string,
  filter: unknown
): FilterResult | undefined {
  const fields = app.tables?.find((table) => table.name === tableName)?.fields ?? []
  const leaf = firstLeafWhere(filter, (candidate) =>
    BOOLEAN_OPERATORS.has(candidate.operator)
      ? !holdsBoolean(app, fields, fieldNamed(fields, candidate.field))
      : false
  )
  if (leaf === undefined) return undefined
  return {
    error: true,
    response: c.json(
      {
        success: false,
        message: `The "${leaf.operator}" operator takes a checkbox or a boolean formula; field "${leaf.field}" holds neither.`,
        code: 'BAD_REQUEST',
      },
      400
    ),
  }
}

/** Shape the request into a filter, without permission checking. */
function parseFilterInput(c: Context, app: App, tableName: string): FilterResult {
  const filterByFormula = c.req.query('filterByFormula')

  if (filterByFormula) {
    const parsedFormula = parseFormulaToFilter(filterByFormula)
    return parsedFormula ? { error: false, value: parsedFormula } : { error: true }
  }

  const fields = app.tables?.find((table) => table.name === tableName)?.fields ?? []
  const parsedFilterResult = parseFilterParameter({
    filterParam: c.req.query('filter'),
    c,
    fieldTypeOf: (name) => fields.find((field) => field.name === name)?.type,
  })
  if (!parsedFilterResult.success) return { error: true, response: parsedFilterResult.error }

  const notAnAndList = refuseNonAndTopLevel(c, parsedFilterResult.filter)
  if (notAnAndList !== undefined) return notAnAndList

  // A value that claims to be a relative date but is outside the grammar is
  // refused, as it is at boot for a page filter — forwarded, it would reach
  // the database as a literal string and match nothing, or whatever that
  // database's own date parser makes of it.
  const [unknown] = unknownRelativeDateTokens(parsedFilterResult.filter)
  if (unknown !== undefined) {
    return {
      error: true,
      response: c.json(
        { success: false, message: describeUnknownRelativeDate(unknown), code: 'BAD_REQUEST' },
        400
      ),
    }
  }

  // An operator the records API does not implement is the caller's mistake,
  // answered 400 with the whole vocabulary. Compiled, it fell through to `=`
  // and a list value reached the database as a 500.
  const unknownOperator = firstUnknownOperator(parsedFilterResult.filter)
  if (unknownOperator !== undefined) {
    return {
      error: true,
      response: c.json(
        {
          success: false,
          message: unknownTermRefusal({
            kind: 'filter operator',
            value: unknownOperator.operator,
            subject: `field "${unknownOperator.field}"`,
            vocabulary: FILTER_OPERATOR_VOCABULARY,
          }),
          code: 'BAD_REQUEST',
        },
        400
      ),
    }
  }

  // [internal ref]: a relative date token in a value names a day of THIS request,
  // resolved here rather than left to the database's own date parser.
  return {
    error: false,
    // `SOVRIUM_DEV_CLOCK` pins that day on a development server.
    value: resolveRelativeDatesIn(parsedFilterResult.filter, utcCalendarDay(serverNow())),
  }
}

/** Why a filter that is not an `and` list is refused, naming the shape `?filter` takes. */
const NOT_AN_AND_LIST_REFUSAL =
  'A filter is an "and" list: {"and": [{"field": ..., "operator": ..., "value": ...}]}. A flat object, a lone condition, a bare array or a top-level "or" is not supported.'

/** Whether a parsed `?filter` is the `and` list the API takes. */
const isAndList = (filter: unknown): boolean =>
  typeof filter === 'object' &&
  filter !== null &&
  !Array.isArray(filter) &&
  !('or' in filter) &&
  Array.isArray((filter as { readonly and?: unknown }).and)

/**
 * The top level of `?filter` is an `and` list. Any other shape — a flat object
 * (`{"stage":"Won"}`), one bare condition, a bare array, a top-level `or` — was
 * read as no filter at all and answered every row, which a caller could not
 * tell from a filter that matched everything. It is refused, naming the shape
 * the API takes. `undefined` when there is no filter or it is an `and` list.
 */
const refuseNonAndTopLevel = (c: Context, filter: unknown): FilterResult | undefined =>
  filter === undefined || isAndList(filter)
    ? undefined
    : {
        error: true,
        response: c.json(
          { success: false, message: NOT_AN_AND_LIST_REFUSAL, code: 'BAD_REQUEST' },
          400
        ),
      }

/** The operators that compare a column with a boolean. */
const BOOLEAN_OPERATORS: ReadonlySet<string> = new Set(['isTrue', 'isFalse'])

type TableField = NonNullable<NonNullable<App['tables']>[number]['fields']>[number]

const fieldNamed = (fields: readonly TableField[], name: string): TableField | undefined =>
  fields.find((field) => field.name === name)

/**
 * Whether a field holds a boolean: a checkbox, a formula whose `resultType` is
 * `boolean`, or a lookup of a field that holds one on the related table. A
 * field the table does not declare is left to the checks that own unknown names.
 */
const holdsBoolean = (
  app: App,
  fields: readonly TableField[],
  field: TableField | undefined
): boolean => {
  if (field === undefined || field.type === 'checkbox') return true
  if (field.type === 'formula') return 'resultType' in field && field.resultType === 'boolean'
  const target = lookupTarget(app, fields, field)
  return target !== undefined && target.type !== 'lookup' && holdsBoolean(app, [], target)
}

/** The field a lookup reads on the related table, or `undefined` for any other field. */
const lookupTarget = (
  app: App,
  fields: readonly TableField[],
  field: TableField
): TableField | undefined => {
  if (field.type !== 'lookup' || !('relationshipField' in field) || !('relatedField' in field)) {
    return undefined
  }
  const relationship = fieldNamed(fields, field.relationshipField)
  if (relationship === undefined || !('relatedTable' in relationship)) return undefined
  const related = app.tables?.find((table) => table.name === relationship.relatedTable)
  return fieldNamed(related?.fields ?? [], field.relatedField)
}

/** A condition of a filter tree: the field it names and its operator. */
interface FilterLeaf {
  readonly field: string
  readonly operator: string
}

/** The first condition, depth first, for which `test` holds. */
function firstLeafWhere(
  node: unknown,
  test: (leaf: FilterLeaf) => boolean
): FilterLeaf | undefined {
  if (Array.isArray(node)) {
    return node.reduce<FilterLeaf | undefined>(
      (found, child) => found ?? firstLeafWhere(child, test),
      undefined
    )
  }
  if (typeof node !== 'object' || node === null) return undefined
  const record = node as Readonly<Record<string, unknown>>
  if ('operator' in record) {
    const leaf = { field: String(record['field']), operator: String(record['operator']) }
    return test(leaf) ? leaf : undefined
  }
  return firstLeafWhere(record['and'], test) ?? firstLeafWhere(record['or'], test)
}

/** The first leaf, depth first, whose operator is not a records-API operator. */
const firstUnknownOperator = (node: unknown): FilterLeaf | undefined =>
  firstLeafWhere(node, (leaf) => !isVocabularyTerm(FILTER_OPERATOR_VOCABULARY, leaf.operator))
