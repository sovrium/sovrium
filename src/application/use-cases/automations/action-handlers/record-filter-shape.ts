/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  isCompilableFilterOperator,
  uncompilableOperatorMessage,
} from '@/domain/models/app/automations/condition-validation'
import {
  LIST_MEMBER_OPERATOR,
  withListMembershipConditions,
} from '@/domain/models/app/tables/user-list-field-service'
import type {
  QueryFilter,
  QueryFilterNode,
} from '@/application/ports/repositories/tables/table-repository'

/**
 * The shape of a record action's `filter` and what it is compiled against:
 * the `{ conditions: [...] }` group, its `id equals` fast path, and the table's
 * declared fields. Split from `record-filters.ts`, which runs the lookups.
 */

interface FilterCondition {
  readonly field?: string
  readonly operator?: string
  readonly value?: unknown
}

interface FilterGroup {
  readonly conditions?: readonly FilterCondition[]
}

/** The declared fields of a table, as far as a filter's compilation reads them. */
export type FilterTableFields =
  | readonly { readonly name: string; readonly type: string; readonly allowMultiple?: unknown }[]
  | undefined

/** The declared fields of `tableName`, or undefined when the config declares no such table. */
export const declaredTableFields = (
  app: {
    readonly tables?: readonly {
      readonly name: string
      readonly fields: readonly { readonly name: string; readonly type: string }[]
    }[]
  },
  tableName: string
): FilterTableFields => app.tables?.find((t) => t.name === tableName)?.fields

/**
 * What a filter lookup knows of its table: the field names a condition may
 * name ({@link declaredFieldNames}) and the declared fields themselves, which
 * say which columns hold a list of people ({@link toQueryFilter}).
 */
export interface DeclaredFilterFields {
  readonly fields: ReadonlySet<string> | undefined
  readonly table: FilterTableFields
}

const isValidIdEqualsCondition = (condition: FilterCondition): boolean => {
  if (condition.field !== 'id') return false
  if (condition.operator !== 'equals') return false
  if (condition.value === undefined) return false
  if (condition.value === '') return false
  return true
}

/**
 * Extract a single record id from the foundational filter shape:
 * `{ conditions: [{ field: 'id', operator: 'equals', value: <id> }] }`.
 *
 * Returns undefined if the filter is missing, has multiple conditions, or does
 * not match the `id equals` shape — callers then fall back to
 * {@link resolveIdsByFilter}, which handles any ConditionGroup. The fast path
 * exists so single-record writes (the record-event trigger's "update the row
 * that just changed") skip the list query.
 */
export const extractIdFromFilter = (filter: unknown): string | undefined => {
  if (!filter || typeof filter !== 'object') return undefined
  const { conditions } = filter as FilterGroup
  if (!Array.isArray(conditions) || conditions.length !== 1) return undefined
  const condition = conditions[0]
  if (!condition || typeof condition !== 'object') return undefined
  if (!isValidIdEqualsCondition(condition)) return undefined
  return String(condition.value)
}

/**
 * Translate the spec's filter shape (`{ conditions: [{ field, operator,
 * value }] }`) into the repository's `QueryFilter` (`{ and: [...] }`). The two
 * shapes carry the same information; the rename exists because the spec mirrors
 * the records-API public contract while `QueryFilter` is the internal
 * repository protocol.
 *
 * `contains` on a `user` field holding several people is membership in its
 * list, as on the records API and a page's own filter — never a text match
 * that a stray id CONTAINING the value would pass. `tableFields` are the
 * table's declared fields, which say which columns hold such a list.
 *
 * Returns undefined for a filter that compiles to zero usable conditions.
 * Callers MUST treat that as a refusal, never as "match everything" — an
 * all-matching filter on a delete is a mass-deletion.
 */
export const toQueryFilter = (
  filter: unknown,
  tableFields?: FilterTableFields
): QueryFilter | undefined => {
  if (!filter || typeof filter !== 'object') return undefined
  const { conditions } = filter as FilterGroup
  if (!Array.isArray(conditions) || conditions.length === 0) return undefined
  const and = conditions.flatMap((c) => {
    if (!c || typeof c !== 'object') return []
    const { field, operator, value } = c as FilterCondition
    if (typeof field !== 'string' || typeof operator !== 'string') return []
    return [{ field, operator, value }] as const
  })
  return and.length > 0 ? { and: withListMembershipConditions(and, tableFields) } : undefined
}

/**
 * The author-declared field names of `tableName`, or undefined when the config
 * declares no such table.
 *
 * Undefined means "cannot adjudicate", NOT "everything is allowed": the only
 * way to reach it is a record action whose `table` prop is itself a `{{...}}`
 * template, since the AppSchema table rule already refuses a literal unknown
 * table at boot. Such an action would fail at the query anyway (no such
 * relation, on both engines), so declining to judge its fields preserves the
 * pre-existing behaviour rather than inventing a second verdict for it.
 */
export const declaredFieldNames = (
  app: {
    readonly tables?: readonly {
      readonly name: string
      readonly fields: readonly { readonly name: string }[]
    }[]
  },
  tableName: string
): ReadonlySet<string> | undefined => {
  const table = app.tables?.find((t) => t.name === tableName)
  return table ? new Set(table.fields.map((f) => f.name)) : undefined
}

/** {@link DeclaredFilterFields} of `tableName`, as every condition lookup is given them. */
export const declaredFilterFields = (
  app: Parameters<typeof declaredTableFields>[0],
  tableName: string
): DeclaredFilterFields => ({
  fields: declaredFieldNames(app, tableName),
  table: declaredTableFields(app, tableName),
})

/** Every `{ field, operator }` leaf of a compiled filter tree. */
const filterLeaves = (
  node: QueryFilterNode
): readonly { readonly field: string; readonly operator: string }[] => {
  if ('operator' in node && typeof node.operator === 'string' && typeof node.field === 'string') {
    return [{ field: node.field, operator: node.operator }]
  }
  if ('and' in node && Array.isArray(node.and)) return node.and.flatMap(filterLeaves)
  if ('or' in node && Array.isArray(node.or)) return node.or.flatMap(filterLeaves)
  return []
}

/**
 * The first condition of a compiled filter whose operator no record filter
 * compiles, with the message refusing it — or undefined when all compile.
 *
 * The run-time half of the boot-time refusal: a filter a run hands over — a
 * batch item, a `{{template}}` a webhook caller filled — is never decoded, so
 * a misspelt `notEqual` would otherwise reach the SQL compiler. The only other
 * operator allowed is the list-membership test {@link toQueryFilter} writes
 * itself.
 */
export const uncompilableFilterOperator = (
  queryFilter: QueryFilter
): { readonly field: string; readonly operator: string; readonly message: string } | undefined => {
  const refused = (queryFilter.and ?? [])
    .flatMap(filterLeaves)
    .find(
      ({ operator }) => operator !== LIST_MEMBER_OPERATOR && !isCompilableFilterOperator(operator)
    )
  return refused === undefined
    ? undefined
    : {
        field: refused.field,
        operator: refused.operator,
        message: `filter on field '${refused.field}': ${uncompilableOperatorMessage(refused.operator)}`,
      }
}
