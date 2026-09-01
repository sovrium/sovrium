/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines -- data-source-resolver is the single per-section dataSource resolution surface (read-permission gate, field-level filtering, single/list/search modes, $record substitution, collection-page expansion). The [internal ref] create-permission gate added the `withWritePermissionGates` stamp (2 lines past the cap); the modes share the field-filter + substitution composition, so a split would lose that cohesion. */

import { resolveSystemSource } from '@/domain/models/app/systemSources'
import {
  hasCreatePermission,
  hasInlineEditDefault,
} from '@/domain/validators/permission-evaluators'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  readPrincipalFromSession,
  type ReadAccessPlan,
  type TableLike,
} from '@/domain/validators/read-access-plan'
import { isListIslandMode } from '@/presentation/utils/list-island-mode'
import {
  isRecordDrawerSystemMode,
  isRecordFieldSystemMode,
} from '@/presentation/utils/system-detail-mode'
import { resolveFilters, hasCurrentUserRef, scopeTablesOf } from './current-user-resolver'
import { applyFieldLevelPermissions } from './field-permission-filter'
import { buildRecordTemplatePatch, substituteRecordInProps } from './record-template-substitution'
import type { App } from '@/domain/models/app'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SessionInfo } from '@/domain/types/session-info'

export const SINGLE_RECORD_NOT_FOUND = Symbol('SINGLE_RECORD_NOT_FOUND')
export const UNAUTHORIZED = Symbol('UNAUTHORIZED')

export type DataSourceSectionResult =
  | Component
  | SimpleComponentReference
  | ComponentReference
  | typeof SINGLE_RECORD_NOT_FOUND
  | typeof UNAUTHORIZED

/**
 * Database access interface for data source resolution.
 *
 * Injected by the caller to keep the presentation layer free of
 * direct infrastructure/database dependencies. The live implementation
 * is provided by DataSourceRepositoryLive in the infrastructure layer.
 */
export interface DataSourceDb {
  readonly fetchRecords: (
    tableName: string,
    options?: {
      readonly fields?: readonly string[]
      readonly filter?: readonly DataFilter[]
      readonly sort?: readonly DataSort[]
      readonly pageSize?: number
      readonly page?: number
    }
  ) => Promise<readonly Record<string, unknown>[]>

  readonly countRecords: (tableName: string, filter?: readonly DataFilter[]) => Promise<number>

  readonly fetchSingleRecord: (
    tableName: string,
    paramField: string,
    paramValue: string,
    fields?: readonly string[]
  ) => Promise<Record<string, unknown> | undefined>

  /**
   * Reads the user's accessible record-ids from `user_access` for one scope
   * table. Mandatory: `$currentUser.assignments.<table>` and
   * `$currentUser.activeAssignment` both resolve into data filters, and this
   * reader is what validates them against real access. When it was optional,
   * every consumer had to carry a "cannot validate" branch that trusted the
   * caller-supplied cookie verbatim — a tampered cookie could then scope a
   * user to data they cannot reach. Adapters with nothing to read supply a
   * reader returning `[]`, which fails closed.
   */
  readonly fetchUserAssignments: (userId: string, tableSlug: string) => Promise<readonly string[]>

  /**
   * Optional — fetch every distinct `role` value the user holds across all
   * `system.user_access` rows (any scope-table). Used by `renderPageByPath`
   * to overlay these onto the Better Auth `session.role` into
   * `session.effectiveRoles` so a user whose Better Auth role is `member`
   * but who holds `role: 'engineer'` in `user_access` passes a page guard
   * of `access: ['engineer']`. Mirrors the table-level Z-3 overlay.
   *
   * Bug 2.
   */
  readonly fetchUserAccessRoles?: (userId: string) => Promise<readonly string[]>
}

/** Injects a _dataSourceError prop into a component's props. */
export function withDataSourceError(component: Component, errorMessage: string): Component {
  return {
    ...component,
    props: {
      ...(component.props ?? {}),
      _dataSourceError: errorMessage,
    },
  }
}

/** Validates dataSource fields against a table's field definitions. */
export function validateDataSourceFields(
  component: Component,
  tableName: string,
  requestedFields: readonly string[],
  tableFieldNames: Set<string>
): Component | undefined {
  const missingFields = requestedFields.filter((f) => !tableFieldNames.has(f))
  if (missingFields.length === 0) return undefined
  return withDataSourceError(
    component,
    `Error: fields not found in table "${tableName}": ${missingFields.join(', ')}`
  )
}

/**
 * Replaces $record.fieldName placeholders with actual field values from a record.
 *
 * `transformValue` is applied to each substituted VALUE and never to the
 * surrounding template — that asymmetry is the whole point. It is what lets
 * {@link substituteRecordInContent} escape record data inside an author-written
 * HTML template while leaving the author's own markup byte-identical. By the
 * time the two are one string, provenance is gone and no downstream consumer
 * can tell them apart.
 */
export function substituteRecordVars(
  text: string,
  record: Record<string, unknown>,
  transformValue?: (value: string) => string
): string {
  return text.replace(/\$record\.([a-zA-Z0-9_]+)/g, (_, fieldName: string) => {
    const value = record[fieldName]
    const rendered = value !== undefined ? String(value) : ''
    return transformValue ? transformValue(rendered) : rendered
  })
}

/**
 * Private resolver→renderer signal: "the AUTHOR wrote a TEXT template here, so
 * whatever the record put into it must render as text."
 *
 * Spelled as a `data-*` attribute deliberately. Element props are spread onto
 * the DOM node by every renderer, and `convertCustomPropsToDataAttributes`
 * (ui/sections/props/prop-conversion.ts) rewrites any non-`data-` custom prop
 * into one anyway — so a `data-` name is the only spelling that neither trips a
 * React unknown-attribute warning nor gets silently renamed in transit.
 * `renderHTMLElement` strips it before it reaches the element. Renderers that
 * pass content through React children are already safe and simply ignore it.
 *
 * Mirrors the existing `_dataSourceError` resolver→renderer channel.
 */
const CONTENT_PLAIN_TEXT_ATTR = 'data-content-plain-text'

/** Does this template's OWN first character make it HTML, before any record data? */
const templateIsAuthorHtml = (template: string): boolean => template.trim().startsWith('<')

/**
 * HTML-escape a record value that is being interpolated into an author's HTML
 * template — a destination where entities genuinely DO decode.
 *
 * The full five-character escape, not just the tag delimiters, because an
 * author HTML template may interpolate into either a text or an ATTRIBUTE
 * context and the resolver cannot tell which:
 *
 *     content: '<p>$record.bio</p>'          → text context
 *     content: '<img alt="$record.bio">'     → attribute context
 *
 * Escaping only `<` and `>` closes the first and leaves the second wide open: a
 * stored value of `" onerror="alert(1)` walks straight out of the `alt`
 * attribute and adds an event handler to the author's own tag. Quotes are what
 * shut that door, and `&` must be escaped first or the escaping is itself
 * forgeable (`&lt;` in the data would otherwise decode to a real `<`).
 */
const escapeRecordValueForHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/**
 * Substitutes `$record.*` into a component's `content` WITHOUT letting record
 * data decide whether the result is rendered as HTML or as text.
 *
 * WHY THIS EXISTS. `renderHTMLElement`
 * (ui/sections/renderers/element-renderers/html-element-renderer.tsx) renders
 * `content` through `dangerouslySetInnerHTML` when it starts with `<`. That
 * test used to run on the POST-substitution string — so the config author wrote
 * the literal `'$record.bio'`, which plainly is not HTML, and the RECORD then
 * decided at request time which branch that config took. A stored value
 * beginning with `<` flipped the element out of React's escaped-children path
 * into the raw-HTML path: stored XSS against every later visitor, plantable
 * through whatever ordinary write path the app exposes, no authentication
 * required. The renderer's own docstring asserted the opposite ("content is
 * from server configuration, not user input"), which is precisely why the
 * branch read as safe to every previous reader.
 *
 * THE DECISION IS TAKEN FROM THE AUTHOR'S TEMPLATE ALONE. Two cases:
 *
 *  - Author wrote HTML (`'<p>$record.bio</p>'`) — the markup is theirs and
 *    stays byte-identical, but each substituted VALUE is HTML-escaped, so
 *    record data contributes text and never markup. Entities decode at this
 *    destination, so `Smith & Sons` renders as `Smith & Sons`.
 *  - Author wrote TEXT (`'$record.bio'`, `'Bio: $record.bio'`) — the value is
 *    substituted VERBATIM and {@link CONTENT_PLAIN_TEXT_ATTR} pins the text
 *    branch. React escapes it on output, so the payload survives as readable
 *    text. Escaping here instead would be wrong twice over: React children do
 *    NOT decode entities, so `&lt;` would render as the visible characters
 *    `&lt;` rather than as `<`, corrupting every legitimate `a < b` and
 *    `Q4 > Q3` in every bound record — and double-escaping is a display defect
 *    wearing a security fix's clothes.
 *
 * THE EXPOSURE WAS NEVER UNIFORM, and nothing in the schema signalled it:
 * `text` ends in `renderParagraph`/`renderHeading` (React children — always
 * escaped, always safe), while `container`, `flex`, `grid`, `card`,
 * `accordion`, `modal`, `sidebar`, `toast`, `list-item` and the unknown-type
 * fallback all route through the sniffing sink. This function runs for every
 * content site regardless, so the posture no longer depends on which component
 * type an author happened to wrap the value in.
 */
function substituteRecordInContent(
  content: Component['content'],
  record: Record<string, unknown>
): { readonly content: Component['content']; readonly forcePlainText: boolean } {
  if (typeof content !== 'string') return { content, forcePlainText: false }
  if (templateIsAuthorHtml(content)) {
    return {
      content: substituteRecordVars(content, record, escapeRecordValueForHtml),
      forcePlainText: false,
    }
  }
  const substituted = substituteRecordVars(content, record)
  // Only flag the case that would actually flip the sink — an author TEXT
  // template whose substituted result now begins with `<`.
  return { content: substituted, forcePlainText: templateIsAuthorHtml(substituted) }
}

/** Adds the plain-text pin to a component's props when the sink would flip. */
const withPlainTextPin = (
  props: Component['props'],
  forcePlainText: boolean
): Component['props'] =>
  forcePlainText ? { ...(props ?? {}), [CONTENT_PLAIN_TEXT_ATTR]: true } : props

/**
 * Substitutes `$record.<field>` tokens inside `dataSource.filter[].value`
 * strings using the parent collection record ([internal ref] —
 * Category & Tag Patterns).
 *
 * The collection-page resolver runs BEFORE component-level dataSource
 * resolution, so a category page's `$record.name` token is the parent
 * category's name. By substituting it here, a nested
 * `dataSource.filter[].value: '$record.name'` becomes a concrete literal
 * (eg. `'Technology'`) before `resolvePageDataSources` builds the SQL
 * query — enabling cross-table filtering driven by the parent record.
 *
 * Only string filter values are substituted. Numeric, boolean, array, and
 * `$currentUser` reference values pass through unchanged so the existing
 * filter pipeline (literal types + `$currentUser` resolver) keeps working.
 */
function substituteRecordInDataSource(
  dataSource: NonNullable<Component['dataSource']>,
  record: Record<string, unknown>
): NonNullable<Component['dataSource']> {
  const { filter } = dataSource
  if (!filter || filter.length === 0) return dataSource
  return {
    ...dataSource,
    filter: filter.map((f: DataFilter): DataFilter =>
      typeof f.value === 'string' ? { ...f, value: substituteRecordVars(f.value, record) } : f
    ),
  }
}

/**
 * Recursively substitutes $record.* variables in a component's props,
 * content, dataSource filters, AND children.
 *
 * Used by:
 *  - `applySingleRecordToComponent` (single-mode dataSource): the fetched
 *    record drives substitution at every level — children must be
 *    substituted because they consume the bound record's fields directly.
 *  - `expandDataSourceChildren` (list-mode dataSource): each per-row
 *    record substitutes the child template — same rationale.
 *
 * The collection-page resolver uses a different helper
 * (`substituteRecordInCollectionTemplate`) that intentionally skips the
 * children of components that themselves have a `dataSource`, because
 * those children are per-row templates that must be expanded against
 * each fetched record — not pre-substituted with the parent collection
 * record ([internal ref] — Category & Tag Patterns).
 */
export function substituteRecordInComponent(
  component: Component,
  record: Record<string, unknown>,
  tableName?: string
): Component {
  // GAP-5: a read-only `record-field` display component resolves the bound
  // record's value for `props.field` by the field's declared type. Inject the
  // raw value + bound table name as render-time props so the renderer can
  // dispatch (rich-text → sanitized HTML, attachment → download link, else text)
  // without threading the whole record down through the dispatch config.
  if (component.type === 'record-field') {
    return injectRecordFieldValue(component, record, tableName)
  }
  const resolvedContent = substituteRecordInContent(component.content, record)
  return {
    ...component,
    props: withPlainTextPin(
      component.props ? substituteRecordInProps(component.props, record) : component.props,
      resolvedContent.forcePlainText
    ),
    content: resolvedContent.content,
    dataSource: component.dataSource
      ? substituteRecordInDataSource(component.dataSource, record)
      : component.dataSource,
    // A STRING CHILD needs no escaping and must not get any. Children are
    // rendered by `renderChildren` (ui/sections/component-renderer.tsx) as React
    // children, which escape on output and never reach a
    // `dangerouslySetInnerHTML` sink — only `content` is sniffed. Escaping here
    // too would double-escape: `<` would become `&lt;`, which React then emits
    // as `&amp;lt;`, so the visitor sees the literal characters `&lt;`.
    children: component.children?.map((child: Component | string) =>
      typeof child === 'string'
        ? substituteRecordVars(child, record)
        : substituteRecordInComponent(child, record, tableName)
    ),
  }
}

/**
 * Injects the bound record's raw value + table name into a `record-field`
 * component's props (`_recordValue`, `_recordTable`). The renderer reads these
 * plus `config.tables` to look up the field's declared type and render it
 * read-only (GAP-5 / [internal ref]).
 */
function injectRecordFieldValue(
  component: Component,
  record: Record<string, unknown>,
  tableName: string | undefined
): Component {
  const baseProps = component.props ? substituteRecordInProps(component.props, record) : {}
  const fieldName = baseProps['field']
  const value = typeof fieldName === 'string' ? record[fieldName] : undefined
  return {
    ...component,
    props: {
      ...baseProps,
      _recordValue: value,
      ...(tableName !== undefined ? { _recordTable: tableName } : {}),
    },
  }
}

/**
 * Variant of `substituteRecordInComponent` used by the collection-page
 * resolver to substitute the parent collection record's fields into the
 * page's components ([internal ref] — Category & Tag
 * Patterns).
 *
 * The key difference from `substituteRecordInComponent`: when a component
 * declares a `dataSource`, its `children` are LEFT UNSUBSTITUTED.
 * Reasoning: those children are per-row templates that
 * `expandDataSourceChildren` substitutes later against each fetched row.
 * Pre-substituting them with the parent category/tag record would
 * clobber the inner `$record.*` tokens (eg. `$record.title` of a post)
 * with the parent's fields (eg. `$record.title` of a category), making
 * row-level data binding impossible.
 *
 * Props, content, and `dataSource.filter[].value` ARE substituted — the
 * parent record drives cross-table filtering (eg.
 * `filter: [{ field: 'category', value: '$record.name' }]`).
 */
export function substituteRecordInCollectionTemplate(
  component: Component,
  record: Record<string, unknown>,
  tableName?: string
): Component {
  // A `record-field` needs the bound record's raw value injected, exactly as it
  // does under a component-level single-mode dataSource. Without this branch the
  // component renders an empty region on every collection page — the shape every
  // slug-routed detail page actually uses — while `$record.*` interpolation on
  // the same page resolves normally, so the binding looks healthy.
  if (component.type === 'record-field') {
    return injectRecordFieldValue(component, record, tableName)
  }

  const resolvedContent = substituteRecordInContent(component.content, record)
  const baseProps = withPlainTextPin(
    component.props ? substituteRecordInProps(component.props, record) : component.props,
    resolvedContent.forcePlainText
  )
  const baseContent = resolvedContent.content
  const templatePatch = buildRecordTemplatePatch(component, record)

  if (component.dataSource) {
    return {
      ...component,
      props: baseProps,
      content: baseContent,
      ...templatePatch,
      dataSource: substituteRecordInDataSource(component.dataSource, record),
      // Children left UNSUBSTITUTED — per-row templates expanded later.
    }
  }

  return {
    ...component,
    props: baseProps,
    content: baseContent,
    ...templatePatch,
    // String children render as React children (escaped) — see the note in
    // `substituteRecordInComponent`. No escaping here, or they double-escape.
    children: component.children?.map((child: Component | string) =>
      typeof child === 'string'
        ? substituteRecordVars(child, record)
        : substituteRecordInCollectionTemplate(child, record, tableName)
    ),
  }
}

/** Expands a data-bound component's children once per record. */
export interface PaginationMeta {
  readonly pageSize: number
  readonly totalCount: number
  readonly style?: string
}

export function expandDataSourceChildren(
  component: Component,
  records: readonly Record<string, unknown>[],
  paginationMeta?: PaginationMeta
): Component {
  const paginationProps = paginationMeta
    ? {
        _paginationPageSize: paginationMeta.pageSize,
        _paginationTotalCount: paginationMeta.totalCount,
        _paginationStyle: paginationMeta.style,
      }
    : {}

  if (!component.children || component.children.length === 0 || records.length === 0) {
    return {
      ...component,
      props: { ...(component.props ?? {}), _dataSourceBound: true, ...paginationProps },
    }
  }

  const expandedChildren: readonly (Component | string)[] = records.map((record) => ({
    type: 'li' as Component['type'],
    // String children render as React children (escaped) — see the note in
    // `substituteRecordInComponent`. Component children route through it, which
    // is where the content pin is applied.
    children: component.children!.map((child: Component | string) =>
      typeof child === 'string'
        ? substituteRecordVars(child, record)
        : substituteRecordInComponent(child, record)
    ),
  }))

  return {
    ...component,
    children: expandedChildren,
    props: { ...(component.props ?? {}), _dataSourceBound: true, ...paginationProps },
  }
}

/**
 * Synthesizes a render-time-only `favorites-button` child component.
 *
 * The `favorites-button` type is never schema-authored — it is injected here
 * so that every single-record detail page automatically gets a star toggle
 * bound to the host record. The renderer for this type lives in the component
 * registry and emits an accessible `<button>` plus an inline toggle runtime.
 */
function buildFavoritesButton(tableName: string, record: Record<string, unknown>): Component {
  const recordId = record['id']
  return {
    type: 'favorites-button' as Component['type'],
    entityType: 'record',
    entityId: recordId !== undefined && recordId !== null ? String(recordId) : '',
    tableName,
  } as unknown as Component
}

function applySingleRecordToComponent(
  component: Component,
  record: Record<string, unknown>,
  tableName: string
): Component {
  const substituted = substituteRecordInComponent(component, record, tableName)
  const existingChildren = (substituted.children ?? []) as ReadonlyArray<Component | string>
  return {
    ...substituted,
    // Append the favorites star toggle as the last child so any record
    // detail page exposes a bookmark control without schema authoring.
    children: [...existingChildren, buildFavoritesButton(tableName, record)],
    props: { ...(substituted.props ?? {}), _dataSourceBound: true, _record: record },
  }
}

interface SingleModeOptions {
  readonly tableName: string
  readonly param: string | undefined
  readonly requestedFields: readonly string[] | undefined
  readonly routeParams: Readonly<Record<string, string>>
  readonly db: DataSourceDb
}

async function resolveSingleMode(
  component: Component,
  options: SingleModeOptions
): Promise<Component | typeof SINGLE_RECORD_NOT_FOUND> {
  const { tableName, param, requestedFields, routeParams, db } = options
  const paramName = param ?? tableName
  const paramValue = routeParams[paramName]
  if (!paramValue) {
    // If param was explicitly configured but missing from route → error.
    // If param was not specified (defaults to tableName) and the URL has no
    // matching segment (e.g. a static path like /profile/edit), fall back to
    // fetching the first record so that single-record views work without a
    // dynamic route param.
    if (param !== undefined) {
      return withDataSourceError(component, `Error: route parameter "${paramName}" not found`)
    }
    const fallbackRecords = await db.fetchRecords(tableName, {
      fields: requestedFields ? [...requestedFields] : undefined,
      pageSize: 1,
      page: 1,
    })
    const firstRecord = fallbackRecords[0]
    if (firstRecord === undefined) return SINGLE_RECORD_NOT_FOUND
    return applySingleRecordToComponent(component, firstRecord, tableName)
  }
  const record = await db.fetchSingleRecord(
    tableName,
    paramName,
    paramValue,
    requestedFields ? [...requestedFields] : undefined
  )
  if (record === undefined) return SINGLE_RECORD_NOT_FOUND
  return applySingleRecordToComponent(component, record, tableName)
}

function checkFieldErrors(
  component: Component,
  tableName: string,
  requestedFields: readonly string[] | undefined,
  tableFields: readonly { readonly name: string }[]
): Component | undefined {
  if (!requestedFields || requestedFields.length === 0) return undefined
  const tableFieldNames = new Set(tableFields.map((f) => f.name))
  return validateDataSourceFields(component, tableName, requestedFields, tableFieldNames)
}

function buildListQueryOptions(
  component: Component,
  requestedFields: readonly string[] | undefined
) {
  const filter = component.dataSource?.filter ?? undefined
  const sort = component.dataSource?.sort ?? undefined
  return {
    queryOpts: {
      fields: requestedFields ? [...requestedFields] : undefined,
      filter,
      sort,
      pageSize: component.dataSource?.pagination?.pageSize,
      page: 1,
    },
    filter,
    pagination: component.dataSource?.pagination,
  }
}

async function resolveListMode(
  db: DataSourceDb,
  component: Component,
  tableName: string,
  requestedFields: readonly string[] | undefined
): Promise<Component> {
  const { queryOpts, filter, pagination } = buildListQueryOptions(component, requestedFields)
  const pageSize = pagination?.pageSize

  const [records, totalCount] = await Promise.all([
    db.fetchRecords(tableName, queryOpts),
    pageSize !== undefined ? db.countRecords(tableName, filter) : Promise.resolve(0),
  ])

  const paginationMeta =
    pageSize !== undefined ? { pageSize, totalCount, style: pagination?.style } : undefined

  return expandDataSourceChildren(component, records, paginationMeta)
}

function buildSearchProps(
  component: Component,
  records: readonly Record<string, unknown>[]
): Record<string, unknown> {
  const { searchFields, debounceMs, limit, bindTo } = component.dataSource ?? {}
  // `listDisplay` is the declarative search-first display config (itemTemplate,
  // emptyMessage, loadMore, highlight). Only `list` components carry it.
  const { listDisplay } = component as { listDisplay?: unknown }
  return {
    ...(component.props ?? {}),
    _searchMode: true,
    _searchRecords: JSON.stringify(records),
    _searchFields: JSON.stringify(searchFields ?? []),
    _searchDebounceMs: debounceMs ?? 0,
    _searchLimit: limit ?? 0,
    _searchChildTemplate: JSON.stringify(component.children ?? []),
    // `bindTo` defers the query to an external searchInput component; the list
    // then renders results only (no own input box) to avoid duplicate inputs.
    ...(bindTo !== undefined ? { _searchBindTo: bindTo } : {}),
    ...(listDisplay !== undefined ? { _listDisplay: JSON.stringify(listDisplay) } : {}),
  }
}

/**
 * Stamps the CLIENT-fetching `list` island props (CAP-1). Mirrors
 * `buildSearchProps`: the binding (DB table OR system read endpoint) and the
 * declarative `listDisplay` are serialized into `props._list*` so the SSR `list`
 * renderer emits a `data-island="list"` host and the island owns the fetch. No
 * server-side records query runs for this binding.
 */
function buildListIslandProps(component: Component): Record<string, unknown> {
  const { listDisplay } = component as { listDisplay?: unknown }
  return {
    ...(component.props ?? {}),
    _listIslandMode: true,
    _listDataSource: JSON.stringify(component.dataSource),
    ...(listDisplay !== undefined ? { _listDisplay: JSON.stringify(listDisplay) } : {}),
  }
}

/**
 * Stamps the CLIENT-fetching `record-field-system` island props (CAP-2). A
 * `record-field` with its OWN `dataSource.system` SELF-binds to a system DETAIL
 * endpoint: the bound record id is the route param value (`system.param`,
 * default `'id'`) resolved here from `routeParams`, injected into the endpoint's
 * `:param` slot by the island. The data-source (the `{ system }` binding) and the
 * resolved id are serialized into `props._recordFieldSystem*` so the SSR
 * record-field renderer emits a `data-island="record-field-system"` host and the
 * island owns the fetch. No server-side records query runs for this binding, and
 * app.tables cross-validation is SKIPPED — `props.field` names an endpoint key.
 */
function buildRecordFieldSystemProps(
  component: Component,
  routeParams: Readonly<Record<string, string>>
): Record<string, unknown> {
  const { system } = component.dataSource as { system?: { param?: string } }
  const paramName = system?.param ?? 'id'
  return {
    ...(component.props ?? {}),
    _recordFieldSystemMode: true,
    _recordFieldDataSource: JSON.stringify(component.dataSource),
    _recordFieldSystemId: routeParams[paramName] ?? '',
  }
}

/**
 * Returns the island-stamped component when a data-bound component renders
 * CLIENT-side via an island (a `list` with `listDisplay.itemTemplate` over a
 * table/system binding, a `record-field` self-binding to a system DETAIL
 * endpoint, OR a `record-drawer` bound to a system DETAIL endpoint), else
 * `undefined`. For these the island owns the fetch, so server resolution +
 * app.tables cross-validation are SKIPPED (a system source describes the endpoint
 * shape, not a declared table). Consolidating these short-circuits here keeps
 * `resolveComponent`'s branch count flat.
 */
function resolveIslandShortCircuit(
  component: Component,
  routeParams: Readonly<Record<string, string>>
): Component | undefined {
  if (isListIslandMode(component)) {
    return { ...component, props: buildListIslandProps(component) }
  }
  if (isRecordFieldSystemMode(component)) {
    return { ...component, props: buildRecordFieldSystemProps(component, routeParams) }
  }
  // A system-detail record-drawer fetches its record on row-click (the id arrives
  // on the dispatched event, not a route param) — no server-side prop to stamp, so
  // return it unchanged: server resolution + app.tables validation are skipped.
  if (isRecordDrawerSystemMode(component)) {
    return component
  }
  return undefined
}

async function resolveSearchMode(
  db: DataSourceDb,
  component: Component,
  tableName: string,
  requestedFields: readonly string[] | undefined
): Promise<Component> {
  // Fetch all records server-side so the island can filter client-side
  const records = await db.fetchRecords(tableName, {
    fields: requestedFields ? [...requestedFields] : undefined,
    filter: component.dataSource?.filter ?? undefined,
    sort: component.dataSource?.sort ?? undefined,
  })

  return { ...component, props: buildSearchProps(component, records) }
}

/**
 * The composed read plan for an SSR data-bound component.
 *
 * `undefined` means "auth is not configured" — the full-access model, under
 * which every table is readable and no column is restricted.
 *
 * ROW-LEVEL SCOPING IS NOT PART OF THIS PLAN, and its absence is deliberate
 * rather than forgotten: resolving `rowLevelPermissions.read.when` needs a
 * per-request database round-trip to load assignment scopes, which page render
 * has no seam for today. `rowContext` is therefore omitted, the plan reports
 * `'unresolved'`, and this caller does NOT consult it — which preserves the
 * pre-existing behaviour rather than blanking every row-level-scoped page. The
 * gap is real and tracked; see the report accompanying this change. Collection
 * pages have their own row-level gate (`page-collection-resolver.ts`,
 * [internal ref]) and are unaffected.
 */
function resolveRenderPlan(ctx: {
  readonly matchedTable: TableLike | undefined
  readonly app: App
  readonly session: SessionInfo | undefined
}): ReadAccessPlan | undefined {
  if (!ctx.app.auth) return undefined
  return buildReadAccessPlan({
    app: ctx.app,
    table: ctx.matchedTable,
    principal: readPrincipalFromSession(ctx.session),
    policy: CANONICAL_READ_POLICY,
  })
}

/** Returns a permission-denied data-bound component with no children or data. */
function emptyDataBoundComponent(component: Component): Component {
  return {
    ...component,
    children: undefined,
    props: { ...(component.props ?? {}), _dataSourceBound: true },
  }
}

/**
 * Stamp the render-time write-permission gates into a data-table component's
 * props, where the session role is known and the island's is not.
 *
 * `_canCreate` offers the toolbar "Nouvel
 * enregistrement" affordance only when the current role may create — absent,
 * not disabled, otherwise: anti-enumeration.
 *
 * `_canUpdate` is the permission-derived default
 * behind a column's `editable`, the one its schema annotation has always
 * promised ("default: from table permissions") and never delivered. It is
 * computed from {@link hasInlineEditDefault} rather than re-derived in the
 * browser for two reasons: the island never receives the session role, so it
 * could not answer `update: ['engineer']` at all; and a second permission
 * model in the client bundle is exactly what the `Permission Evaluator Drift`
 * gate exists to prevent.
 *
 * Both are a no-op for non-data-tables and when auth is not configured. The two
 * absent-value defaults differ, deliberately: create is OFFERED when unknown
 * (full-access model), edit is WITHHELD when unknown (fail-closed, and the
 * behaviour every grid has today).
 *
 * Both carry the caller's GROUPS as well as their role. A grant naming a group
 * (`create: ['group:ops']`) is matched against memberships and never against
 * the role string, so passing the role alone left every group-granted member
 * silently un-offered a button they were entitled to press — while the CRUD
 * form gate in this same layer (`render-page.tsx` → `gateCaller`) already
 * forwarded them. One page, two treatments.
 */
function withWritePermissionGates(ctx: {
  readonly component: Component
  readonly app: App
  readonly table: NonNullable<ReturnType<NonNullable<App['tables']>['find']>>
  readonly session: SessionInfo | undefined
}): Component {
  if (ctx.component.type !== 'data-table' || !ctx.app.auth) return ctx.component
  const role = ctx.session?.role ?? ''
  const groups = ctx.session?.groups ?? []
  const _canCreate = hasCreatePermission(ctx.table, role, ctx.app.tables, groups)
  const _canUpdate = hasInlineEditDefault(ctx.table, role, ctx.app.tables, groups)
  return { ...ctx.component, props: { ...(ctx.component.props ?? {}), _canCreate, _canUpdate } }
}

/** Resolves a validated component by mode (list/single/search) with field-level filtering. */
function resolveByMode(ctx: {
  readonly component: Component
  readonly app: App
  readonly table: NonNullable<ReturnType<NonNullable<App['tables']>['find']>>
  readonly session: SessionInfo | undefined
  readonly routeParams: Readonly<Record<string, string>>
  readonly db: DataSourceDb
  readonly plan: ReadAccessPlan | undefined
}): Promise<DataSourceSectionResult> {
  const { table: tableName, fields: requestedFields, mode, param } = ctx.component.dataSource!
  // The plan's restricted set, NOT a locally re-derived one. The predecessor
  // (`getRestrictedFields`) early-returned an empty set whenever the table
  // declared no `permissions.fields` — which is exactly when the built-in
  // default rules are the only field-level control there is, so a `viewer`
  // granted table read saw every column on a page while the records API
  // stripped all but name/title from the same table.
  const restricted = ctx.plan?.restrictedColumns ?? new Set<string>()
  const gated = withWritePermissionGates(ctx)
  const { component: fc, fields: ff } = applyFieldLevelPermissions(
    gated,
    requestedFields,
    restricted
  )
  if (mode === 'single') {
    return resolveSingleMode(fc, {
      tableName,
      param,
      requestedFields: ff,
      routeParams: ctx.routeParams,
      db: ctx.db,
    })
  }
  if (mode === 'search') return resolveSearchMode(ctx.db, fc, tableName, ff)
  return resolveListMode(ctx.db, fc, tableName, ff)
}

/** Validates prerequisites: table existence and read permissions. */
function validateDataSourcePrereqs(
  component: Component,
  ctx: {
    readonly matchedTable: ReturnType<NonNullable<App['tables']>['find']>
    readonly tableName: string
    readonly plan: ReadAccessPlan | undefined
  }
): Component | undefined {
  if (!ctx.matchedTable) {
    return withDataSourceError(component, `Error: table "${ctx.tableName}" not found`)
  }
  // `plan === undefined` is the auth-not-configured full-access model.
  if (ctx.plan !== undefined && !ctx.plan.allowed) {
    return emptyDataBoundComponent(component)
  }
  return undefined
}

/**
 * Desugar the `{ systemSource: <name> }` named-catalog shorthand (CAP-4) into the
 * inline `{ system: <entry> }` form by resolving the name against
 * `app.systemSources`. The resolved catalog entry (minus its `name`) is a drop-in
 * for the inline system binding, so AFTER desugaring the component is identical to
 * one authored with `dataSource: { system: { endpoint, ... } }` — every downstream
 * branch (island short-circuits + the data-table island fetch hooks) sees only
 * `dataSource.system` and needs no `{ systemSource }` awareness, and the catalog
 * never reaches the client bundle. A reference that does not resolve (catalog-less
 * app) is left unchanged: decode-time `validateAllSystemSourceReferences` already
 * rejects an undeclared reference before boot.
 */
function desugarSystemSourceRef(component: Component, app: App): Component {
  const dataSource = component.dataSource as { readonly systemSource?: unknown } | undefined
  const ref = dataSource?.systemSource
  if (typeof ref !== 'string') return component
  const entry = resolveSystemSource(ref, app.systemSources)
  if (!entry) return component
  const { name: _name, ...system } = entry
  return { ...component, dataSource: { system } as Component['dataSource'] }
}

async function resolveComponent(
  item: Component | SimpleComponentReference | ComponentReference,
  ctx: {
    readonly app: App
    readonly routeParams: Readonly<Record<string, string>>
    readonly session: SessionInfo | undefined
    readonly cookies: Readonly<Record<string, string>> | undefined
    readonly db: DataSourceDb
  }
): Promise<DataSourceSectionResult> {
  const { app, routeParams, session, cookies, db } = ctx
  if ('component' in item || '$ref' in item) return item
  // CAP-4: desugar a `{ systemSource: <name> }` catalog reference into the inline
  // `{ system: <entry> }` binding FIRST, so the rest of resolution (and every
  // downstream island) only ever deals with the inline system shape.
  const component = desugarSystemSourceRef(item as Component, app)
  if (!component.dataSource) return component

  // CAP-1/CAP-2: a client-fetching data-bound component (a `list` itemTemplate
  // binding, or a `record-field` self-binding to a system DETAIL endpoint) is
  // stamped for its island and SKIPS server-side resolution + app.tables
  // cross-validation — the island owns the fetch.
  const islandStamped = resolveIslandShortCircuit(component, routeParams)
  if (islandStamped) return islandStamped

  const { table: tableName, fields: requestedFields } = component.dataSource
  const matchedTable = (app.tables ?? []).find((t) => t.name === tableName)
  const plan = resolveRenderPlan({
    matchedTable: matchedTable as TableLike | undefined,
    app,
    session,
  })
  const prereqResult = validateDataSourcePrereqs(component, { matchedTable, tableName, plan })
  if (prereqResult) return prereqResult

  const fieldError = checkFieldErrors(component, tableName, requestedFields, matchedTable!.fields)
  if (fieldError) return fieldError

  // Z-1 / P-6: Resolve `$currentUser.*` references in dataSource.filter.
  // - Unauthenticated requests on filters with $currentUser refs return 401
  //   (defense-in-depth: filter resolution is server-enforced).
  // - Unrestricted users (admin) bypass assignments-based filters entirely.
  // - `$currentUser.activeAssignment` requires `scopeTables` so the cookie
  //   value can be validated against the configured scope set
  //   (tamper-resistant — see current-user-resolver.ts).
  const resolvedComponent = await resolveCurrentUserFilters(component, {
    session,
    cookies,
    db,
    scopeTables: scopeTablesOf(app),
  })
  if (resolvedComponent === UNAUTHORIZED) return UNAUTHORIZED

  return resolveByMode({
    component: resolvedComponent,
    app,
    table: matchedTable!,
    session,
    routeParams,
    db,
    plan,
  })
}

/**
 * Resolves `$currentUser.*` references inside `dataSource.filter[].value`,
 * returning a new component with concrete literal values. Returns
 * `UNAUTHORIZED` when an unauthenticated request hits a filter that
 * contains a `$currentUser` reference.
 */
async function resolveCurrentUserFilters(
  component: Component,
  ctx: {
    readonly session: SessionInfo | undefined
    readonly cookies: Readonly<Record<string, string>> | undefined
    readonly db: DataSourceDb
    readonly scopeTables: readonly string[]
  }
): Promise<Component | typeof UNAUTHORIZED> {
  const filters = component.dataSource?.filter
  if (!hasCurrentUserRef(filters)) return component

  const result = await resolveFilters(filters, {
    session: ctx.session,
    cookies: ctx.cookies,
    fetchAssignments: ctx.db.fetchUserAssignments,
    scopeTables: ctx.scopeTables,
  })
  if (result.kind === 'unauthorized') return UNAUTHORIZED

  // Replace the dataSource with a copy where every `$currentUser.*` value
  // is now a concrete literal (or empty array for missing assignments).
  return {
    ...component,
    dataSource: {
      ...component.dataSource!,
      filter: result.filter,
    },
  }
}

/**
 * Resolves dataSource bindings for a page.
 *
 * Database access is provided via the `db` parameter (dependency injection)
 * to keep the presentation layer free of infrastructure dependencies.
 *
 * Returns:
 * - `undefined` when a single-mode dataSource finds no matching record (→ 404).
 * - `{ unauthorized: true }` when any component on the page declares a
 *   `$currentUser.*` filter and the request has no session (Z-1 → 401).
 * - The resolved `Page` otherwise.
 */
export async function resolvePageDataSources(
  page: Page,
  app: App,
  routeParams: Readonly<Record<string, string>>,
  ctx: {
    readonly session: SessionInfo | undefined
    readonly cookies?: Readonly<Record<string, string>>
    readonly db: DataSourceDb
  }
): Promise<Page | { readonly unauthorized: true } | undefined> {
  if (!page.components || page.components.length === 0) return page
  const componentCtx = {
    app,
    routeParams,
    session: ctx.session,
    cookies: ctx.cookies,
    db: ctx.db,
  }

  const resolvedComponents = await Promise.all(
    page.components.map((item) => resolveComponent(item, componentCtx))
  )

  if (resolvedComponents.some((s) => s === UNAUTHORIZED)) return { unauthorized: true }
  if (resolvedComponents.some((s) => s === SINGLE_RECORD_NOT_FOUND)) return undefined

  return {
    ...page,
    components: resolvedComponents.filter(
      (s): s is Component | SimpleComponentReference | ComponentReference =>
        s !== SINGLE_RECORD_NOT_FOUND && s !== UNAUTHORIZED
    ),
  }
}
