/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a declared view turns into a records query — the pure half of reading
 * through a view.
 *
 * One module answers for both readers — the records list's `?view=` resolver
 * and the view-records program — so the view a caller names (matching rules
 * included) and the rows it narrows to cannot depend on which route asked.
 *
 * The rules a view imposes are narrowing-only, and each function below is one
 * of them:
 *  - its `filters` are AND-merged IN FRONT of the caller's filter, never
 *    replaced by it ({@link mergeViewFilter});
 *  - its `fields` are a whitelist the caller's `?fields=` is intersected with,
 *    never widened past ({@link intersectViewFields});
 *  - a caller's filter or sort may name only columns the view serves, or a
 *    reader could probe a withheld column through the rows it keeps
 *    ({@link fieldsOutsideView}).
 */

/** A filter node as a view declares it and as the records query consumes it. */
export type ViewFilterNode =
  | { readonly field: string; readonly operator: string; readonly value: unknown }
  | { readonly and: readonly ViewFilterNode[] }
  | { readonly or: readonly ViewFilterNode[] }

/** The top-level shape the records query takes: an AND group of nodes. */
export interface ViewFilterGroup {
  readonly and?: readonly ViewFilterNode[]
}

/** The two keys a view is addressed by. */
interface ViewAddress {
  readonly id: string | number
  readonly name: string
}

/**
 * The view a route or a page names, by its id OR its name.
 *
 * Both are accepted because both are how an author writes it: the id is the
 * stable address, the name is what the author reads in their own config. The
 * id is compared as a string, since a view id may be declared as a number and
 * always arrives from a URL as text.
 */
export const findViewByKey = <V extends ViewAddress>(
  views: readonly V[] | undefined,
  key: string
): V | undefined => views?.find((view) => String(view.id) === key || view.name === key)

/** Whether a view declares `permissions: { public: true }` — the one literal that opens it past the session. */
export const isPublicView = (view: { readonly permissions?: unknown }): boolean => {
  const { permissions } = view
  return (
    typeof permissions === 'object' &&
    permissions !== null &&
    (permissions as { readonly public?: unknown }).public === true
  )
}

const isFilterNode = (value: unknown): value is ViewFilterNode =>
  typeof value === 'object' &&
  value !== null &&
  ('field' in value || 'and' in value || 'or' in value)

/**
 * A view's own `filters` as the conditions of a top-level AND group.
 *
 * An `and` root contributes its children; a leaf or an `or` root contributes
 * itself as ONE condition. The `or` case is the one a hand-written normaliser
 * lost: returning nothing for it served the whole table through a view drawn
 * around an alternative.
 */
export const viewFilterConditions = (filters: unknown): readonly ViewFilterNode[] => {
  if (!isFilterNode(filters)) return []
  if ('and' in filters) return filters.and
  return [filters]
}

/**
 * The view's filter AND the caller's, in that order — a caller narrows a view,
 * it never un-applies one.
 */
export const mergeViewFilter = (
  viewFilters: unknown,
  callerFilter: ViewFilterGroup | undefined
): ViewFilterGroup | undefined => {
  const combined = [...viewFilterConditions(viewFilters), ...(callerFilter?.and ?? [])]
  return combined.length === 0 ? undefined : { and: combined }
}

/** A view's `sorts` as the records query's `field:direction,…` parameter. */
export const viewSortParam = (
  sorts: readonly { readonly field: string; readonly direction: string }[] | undefined
): string | undefined =>
  sorts === undefined || sorts.length === 0
    ? undefined
    : sorts.map((sort) => `${sort.field}:${sort.direction}`).join(',')

/**
 * A view's `groupBy` as the records query's `?groupBy=` parameter: every level,
 * outermost first, comma-separated (`stage,owner`). `undefined` when the view
 * groups nothing.
 */
export const viewGroupByParam = (
  groupBy:
    { readonly field: string; readonly thenBy?: readonly { readonly field: string }[] } | undefined
): string | undefined =>
  groupBy === undefined
    ? undefined
    : [groupBy.field, ...(groupBy.thenBy ?? []).map((level) => level.field)].join(',')

/**
 * A `?fields=` value that selects no user column.
 *
 * `id` is accepted by the field selection as a root-level column rather than a
 * user field, so asking for it alone yields records whose `fields` are empty.
 * An empty string would not do: the selection reads it as "no selection" and
 * serves every column.
 */
const SELECT_NO_USER_FIELD = 'id'

const splitFieldList = (list: string | undefined): readonly string[] =>
  (list ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0)

/**
 * The columns a read through a view serves: the view's `fields` intersected
 * with the caller's `?fields=`.
 *
 * A view that declares no `fields` (or an empty list) sets no whitelist, and the
 * caller's selection passes unchanged. A caller asking for nothing gets the
 * whole list. A caller asking only for columns outside the list gets NO user
 * column — never the whole table, which is what an empty selection would mean.
 */
export const intersectViewFields = (
  viewFields: readonly string[] | undefined,
  requested: string | undefined
): string | undefined => {
  if (viewFields === undefined || viewFields.length === 0) return requested
  const asked = splitFieldList(requested)
  if (asked.length === 0) return viewFields.join(',')
  const kept = asked.filter((name) => viewFields.includes(name))
  return kept.length > 0 ? kept.join(',') : SELECT_NO_USER_FIELD
}

/** Every field name a filter group names, at any depth. */
export const filterFieldNames = (group: ViewFilterGroup | undefined): readonly string[] => {
  const walk = (node: ViewFilterNode): readonly string[] => {
    if ('field' in node) return [node.field]
    if ('and' in node) return node.and.flatMap(walk)
    return node.or.flatMap(walk)
  }
  return (group?.and ?? []).flatMap(walk)
}

/** The field names a `field:direction,…` sort parameter names. */
export const sortFieldNames = (sort: string | undefined): readonly string[] =>
  splitFieldList(sort).flatMap((entry) => {
    const [field] = entry.split(':')
    return field === undefined || field === '' ? [] : [field]
  })

/** Record-envelope columns a caller may always filter or sort on. */
const ENVELOPE_COLUMNS: ReadonlySet<string> = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
])

/**
 * The first name a caller's filter or sort uses that the view does not serve,
 * or `undefined` when every name is inside it.
 *
 * A view with no whitelist restricts nothing here. With one, a filter on a
 * withheld column would still answer a question about it — the rows it keeps —
 * so it is refused rather than silently dropped.
 */
export const fieldsOutsideView = (
  viewFields: readonly string[] | undefined,
  names: readonly string[]
): string | undefined => {
  if (viewFields === undefined || viewFields.length === 0) return undefined
  return names.find((name) => !viewFields.includes(name) && !ENVELOPE_COLUMNS.has(name))
}

/** The parts of a view definition that name fields. */
interface ViewDefinitionParts {
  readonly filters?: unknown
  readonly sorts?: readonly { readonly field: string; readonly direction: string }[]
  readonly fields?: readonly string[]
  readonly groupBy?: { readonly field: string }
}

/** The parts that name fields may be left out once masked; the rest is unchanged. */
type MaskedViewDefinition<V extends ViewDefinitionParts> = Omit<
  V,
  'filters' | 'sorts' | 'fields' | 'groupBy'
> &
  Partial<Pick<V, 'filters' | 'sorts' | 'fields' | 'groupBy'>>

/**
 * A filter node with every condition on a field `canRead` refuses left out, or
 * `undefined` when nothing is left.
 *
 * The node is checked at every depth rather than trusted to its type: the
 * masking must stay safe on any shape it is handed. So a condition hands back
 * ONLY its `field`, `operator` and `value` — any other key it carries (a nested `and`, say) could name a
 * hidden field — a condition whose `field` is not text is left out, and so is a
 * group whose children are not a list, or a child that is not a node.
 */
const maskFilterNode = (
  node: unknown,
  canRead: (field: string) => boolean
): ViewFilterNode | undefined => {
  if (!isFilterNode(node)) return undefined
  if ('field' in node) {
    const { field, operator } = node
    if (typeof field !== 'string' || !canRead(field)) return undefined
    return 'value' in node
      ? { field, operator, value: node.value }
      : ({ field, operator } as ViewFilterNode)
  }
  const children: unknown = 'and' in node ? node.and : node.or
  if (!Array.isArray(children)) return undefined
  const kept = children.flatMap((child: unknown) => {
    const masked = maskFilterNode(child, canRead)
    return masked === undefined ? [] : [masked]
  })
  if (kept.length === 0) return undefined
  return 'and' in node ? { and: kept } : { or: kept }
}

/**
 * A definition's `filters` with every condition on a field `canRead` refuses
 * left out.
 *
 * Two shapes reach here. A config view declares ONE node — an `and` / `or`
 * group or a single condition — and a group or filter left with no condition is
 * dropped (`undefined`). A FLAT ARRAY of conditions has each entry masked on
 * its own, an entry that is not a filter node is left out rather than handed
 * over unread, and the array keeps its shape even when it ends up empty, so a client reading `filters` as a list still gets one.
 * Anything else is returned as it came: the masking only removes, it never
 * invents a shape.
 */
const maskViewFilters = (filters: unknown, canRead: (field: string) => boolean): unknown => {
  if (Array.isArray(filters)) {
    return filters.flatMap((entry: unknown) => {
      const masked = maskFilterNode(entry, canRead)
      return masked === undefined ? [] : [masked]
    })
  }
  return isFilterNode(filters) ? maskFilterNode(filters, canRead) : filters
}

/**
 * A view definition as one reader may see it: its `fields`, filter conditions
 * (at any depth, in a node or a flat array), `sorts` and `groupBy` keep only
 * the fields `canRead` admits.
 *
 * The definition describes the columns and values a view was drawn around, so
 * handing it over verbatim names a field kept from the reader — and the value
 * filtered on it. The view itself stays listed: what it serves is masked by the
 * records read, and the reader is told only what they may read of how. A group
 * left with no condition is dropped, and a filter left with none is omitted.
 */
export const maskViewDefinition = <V extends ViewDefinitionParts>(
  view: V,
  canRead: (field: string) => boolean
): MaskedViewDefinition<V> => {
  const filters = maskViewFilters(view.filters, canRead)
  const { filters: _filters, groupBy, ...rest } = view
  return {
    ...rest,
    ...(filters === undefined ? {} : { filters }),
    ...(view.sorts === undefined ? {} : { sorts: view.sorts.filter((s) => canRead(s.field)) }),
    ...(view.fields === undefined ? {} : { fields: view.fields.filter(canRead) }),
    ...(groupBy === undefined || !canRead(groupBy.field) ? {} : { groupBy }),
  } as MaskedViewDefinition<V>
}
