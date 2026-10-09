/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Many records into many components: the per-row expansion, the collection-page
 * variant of `$record` substitution, and the island-prop stamps that have to
 * run once per expanded row.
 *
 * The three `stamp*` passes live here rather than beside the mode resolvers
 * because they walk the SAME expanded tree this module produces — a data-bound
 * component nested inside a layout container gets its island props from
 * `stampNestedIslands`, and the recursion that finds it is the recursion
 * `expandDataSourceChildren` just built.
 */

import {
  substituteRecordVars,
  withRecordText,
} from '@/domain/models/app/pages/substitute-record-vars'
import { isListIslandMode } from '@/presentation/render/registry/list-island-mode'
import {
  isRecordDrawerSystemMode,
  isRecordFieldSystemMode,
} from '@/presentation/render/registry/system-detail-mode'
import { isComponentReferenceNode } from '@/presentation/render/resolve/component-reference'
import { readsAnotherRecord } from './bound-node-record'
import { desugarSystemSourceRef } from './data-source-contracts'
import { emptyListMarkers } from './empty-list-markers'
import { resolveListIslandInputs } from './list-island-inputs'
import {
  expandRepeat,
  isRepeating,
  pageScopeReads,
  type RecordScope,
} from './record-repeat-expansion'
import {
  RECORD_VALUE_TYPES,
  injectRecordFieldValue,
  substituteRecordInComponent,
  substituteRecordInContent,
  substituteRecordInDataSource,
  withPlainTextPin,
} from './record-substitution'
import { buildRecordTemplatePatch, substituteRecordInProps } from './record-template-substitution'
import { filterChildrenForRecord } from './record-visibility'
import { bindRouteParams } from './route-param-binding'
import type { App } from '@/domain/models/app'
import type { ComponentReference } from '@/domain/models/app/components/reference'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Variant of `substituteRecordInComponent` used by the collection-page
 * resolver to substitute the parent collection record's fields into the
 * page's components (the pages access publishing requirement — Category & Tag
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
 * `dataSource.filter[].value` IS substituted — the parent record drives
 * cross-table filtering (`value: '$record.name'`) — and so are props and content,
 * unless the node reads one record of its own ({@link readsAnotherRecord}).
 */
export function substituteRecordInCollectionTemplate(
  component: Component,
  record: Record<string, unknown>,
  tableName?: string,
  scope?: RecordScope
): Component {
  // A `record-field` (or a field-bound control) needs the bound record's raw
  // value injected, as under a single-mode dataSource. Without this it renders
  // empty on every collection page while `$record.*` resolves normally.
  if (RECORD_VALUE_TYPES.has(component.type)) {
    return injectRecordFieldValue(component, record, tableName)
  }

  // `scope` is the PAGE binding's: what `$record.` may print there,
  // plus the two things only a page bound to one record does — expand a
  // `repeat`, and print a lone object token in a `code` node as JSON.
  const { printable, json } = pageScopeReads(component, record, scope)
  const resolvedContent = substituteRecordInContent(component.content, printable)
  const baseProps = withPlainTextPin(
    component.props ? substituteRecordInProps(component.props, printable) : component.props,
    resolvedContent.forcePlainText
  )
  const baseContent = json ?? resolvedContent.content
  const templatePatch = buildRecordTemplatePatch(component, record, tableName)

  if (component.dataSource) {
    return {
      ...component,
      ...(readsAnotherRecord(component, tableName)
        ? {}
        : { props: baseProps, content: baseContent, ...templatePatch }),
      dataSource: substituteRecordInDataSource(component.dataSource, record),
    } // Children left UNSUBSTITUTED — per-row templates expanded later.
  }

  const own = { ...component, props: baseProps, content: baseContent, ...templatePatch }
  if (scope !== undefined && isRepeating(component)) return expandRepeat(own, scope)

  return {
    ...own,
    // String children render as React children (escaped) — see the note in
    // `substituteRecordInComponent`. No escaping here, or they double-escape.
    children: filterChildrenForRecord(component.children ?? [], record).map(
      (child: Component | string) =>
        typeof child === 'string'
          ? substituteRecordVars(child, withRecordText(printable))
          : substituteRecordInCollectionTemplate(child, record, tableName, scope)
    ),
  }
}

/** Expands a data-bound component's children once per record. */
export interface PaginationMeta {
  readonly pageSize: number
  readonly totalCount: number
  readonly style?: string
}

/**
 * How a row's children are substituted — and the one case where it matters.
 *
 * `'deep'` (the default, and every existing caller's behaviour) walks the whole
 * subtree, so a `$record.` anywhere below the row resolves against that row.
 *
 * `'stop-at-nested-binding'` walks the same subtree but leaves the CHILDREN of a
 * node that carries its own `dataSource` untouched, because those children are
 * an inner template that has not met its own rows yet. Without it, an inner
 * `$record.route` is consumed by the OUTER record — which has no such field, so
 * it resolves to the empty string and the inner rows render blank the moment
 * they arrive. It is the same reason `substituteRecordInCollectionTemplate`
 * already stops there for the DB path; this is that rule, reachable from the
 * system-rows path without changing what any existing caller does.
 */
export type RowSubstitutionDepth = 'deep' | 'stop-at-nested-binding'

/**
 * The element each expanded row is wrapped in.
 *
 * By default a data-bound LIST (`<ul>`) wraps its rows in `'li'`; any other
 * host in `'div'`, as an `<li>` outside a list paints a bullet beside each row.
 *
 * `'div'` exists for a row template nested inside another one, and the reason is
 * the HTML PARSER rather than taste. An `<li>` start tag closes any open `<li>`
 * in list-item scope, and a `<div>` does not break that scope — so an inner row
 * wrapped in `<li>` closes the OUTER row's `<li>` and the browser re-parents the
 * inner rows as SIBLINGS of the card that was supposed to contain them. The
 * server's HTML is well-formed by every other measure, the resolved tree is
 * correct, and `renderToString` emits the right string; only the DOM disagrees,
 * which is why this cost a full trace from the resolver to the parser to find.
 */
export type RowWrapperElement = 'li' | 'div'

/** How a row template is expanded — the two knobs the nested path turns. */
export interface RowExpansionOptions {
  readonly substitution?: RowSubstitutionDepth
  readonly rowWrapper?: RowWrapperElement
}

/**
 * The pagination markers a `list` reads to draw its page control
 * (`special-components.tsx`). Only a `list` draws one: on any other node the
 * markers would reach the served HTML as attributes nobody reads.
 */
function paginationMarkers(
  component: Component,
  paginationMeta: PaginationMeta | undefined
): Readonly<Record<string, unknown>> {
  if (paginationMeta === undefined || component.type !== 'list') return {}
  return {
    _paginationPageSize: paginationMeta.pageSize,
    _paginationTotalCount: paginationMeta.totalCount,
    _paginationStyle: paginationMeta.style,
  }
}

/** A data-bound component with no row to draw: no template, and a list's empty-state markers. */
function withNoRows(
  component: Component,
  paginationProps: Readonly<Record<string, unknown>>
): Component {
  return {
    ...component,
    children: [],
    props: {
      ...(component.props ?? {}),
      _dataSourceBound: true,
      ...paginationProps,
      ...emptyListMarkers(component),
    },
  } as Component
}

export function expandDataSourceChildren(
  component: Component,
  records: readonly Record<string, unknown>[],
  paginationMeta?: PaginationMeta,
  expansion: RowExpansionOptions = {}
): Component {
  const { substitution = 'deep', rowWrapper = component.type === 'list' ? 'li' : 'div' } = expansion
  const paginationProps = paginationMarkers(component, paginationMeta)

  if (!component.children || component.children.length === 0) {
    return {
      ...component,
      props: { ...(component.props ?? {}), _dataSourceBound: true, ...paginationProps },
    }
  }
  // No row: the per-row template is drawn zero times — never once with its raw
  // `$record.` text — and a list says its `listDisplay.emptyMessage` instead.
  if (records.length === 0) return withNoRows(component, paginationProps)

  const expandedChildren: readonly (Component | string)[] = records.flatMap((record) => {
    const kept = filterChildrenForRecord(component.children!, record)

    // A record that gated away EVERY child of its template gets no row element
    // at all. The per-row filter reaches the children; stopping one element
    // short of the wrapper would leave such a record an `<li>` holding nothing
    // — and no config could prevent it, because `rowWrapper` is
    // chosen here and has no node an author could hang a predicate on.
    //
    // Stated on the FILTERED CHILDREN, so it fires whatever emptied the row —
    // unlike the `children.length === 0` short-circuit above (an empty template).
    if (kept.length === 0) return []

    return [
      {
        type: rowWrapper as Component['type'],
        // String children render as React children (escaped) — see the note in
        // `substituteRecordInComponent`. Component children route through it,
        // which is where the content pin is applied.
        children: kept.map((child: Component | string) =>
          typeof child === 'string'
            ? substituteRecordVars(child, withRecordText(record))
            : substituteRecordInComponent(child, record, undefined, substitution)
        ),
      },
    ]
  })

  return {
    ...component,
    children: expandedChildren,
    props: { ...(component.props ?? {}), _dataSourceBound: true, ...paginationProps },
  }
}

/**
 * Stamps the CLIENT-fetching `list` island props (CAP-1). Mirrors
 * `buildSearchProps`: the binding (DB table OR system read endpoint) and the
 * declarative `listDisplay` are serialized into `props._list*` so the SSR `list`
 * renderer emits a `data-island="list"` host and the island owns the fetch. No
 * server-side records query runs for this binding.
 */
function buildListIslandProps(component: Component, app: App | undefined): Record<string, unknown> {
  const { listDisplay } = component as { listDisplay?: unknown }
  return {
    ...(component.props ?? {}),
    _listIslandMode: true,
    _listDataSource: JSON.stringify(component.dataSource),
    _listInputs: JSON.stringify(resolveListIslandInputs(component, app)),
    // Kept an OBJECT, not a JSON string: the props pass that resolves `$t:`
    // walks nested objects but reads a string whole, so a serialised
    // `emptyMessage: '$t:…'` reached the page as the raw key.
    ...(listDisplay !== undefined ? { _listDisplay: listDisplay } : {}),
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
export function resolveIslandShortCircuit(
  component: Component,
  routeParams: Readonly<Record<string, string>>,
  app?: App
): Component | undefined {
  if (isListIslandMode(component)) {
    return { ...component, props: buildListIslandProps(component, app) }
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

/**
 * Stamps the island props of a data-bound component NESTED inside a layout
 * container, and recurses through the containers between them.
 *
 * WHY only `list` was ever visibly broken by its absence: every other data
 * component (`table`, `kanban`, `calendar`, …) is an UNCONDITIONAL island
 * TYPE, so the renderer emits its `data-island` host from the type alone,
 * wherever the component sits. `list` is the one type whose island-ness is
 * decided at RESOLVE time — a `list` is a static bullet list until a
 * `dataSource` plus a `listDisplay.itemTemplate` make it a client-fetching one —
 * so its host depends on a prop stamp. `resolvePageDataSources` walks
 * `page.components`, the TOP level only, so a list one container down never got
 * the stamp: it fell through to the server-side expand path and emitted a bare
 * `<ul>` with no marker, no fetch and no rows. Both island DETECTION walkers
 * (`PageIslandDetection`, `render-page.tsx#selfNeedsIslands`) already recurse,
 * so the runtime script was being injected for a host that never existed.
 *
 * SCOPE, deliberately narrow: this walk stamps island props and NOTHING else.
 * It runs no query, consults no permission plan, and cannot fail — so a nested
 * data-bound component that resolves SERVER-side keeps byte-for-byte the
 * behaviour it had before, and server-side resolution of nested bindings stays
 * the top-level-only concern it has always been. Only the dispatch decision,
 * which is pure, descends. The one exception is a record-bound
 * (`mode: 'single'`) node, which has no island to fetch for it: the resolver
 * resolves it after this walk, wherever it sits (`resolveNestedSingleRecords`).
 *
 * A data-bound node's OWN children are left untouched: they are per-row
 * templates expanded once per record by `expandDataSourceChildren`, not
 * siblings on the page.
 *
 * Identity-preserving: a subtree with nothing to stamp is returned by reference.
 */
export function stampNestedIslands(
  component: Component,
  ctx: { readonly app: App; readonly routeParams: Readonly<Record<string, string>> }
): Component {
  const host = stampSpecimenSubject(component, ctx)
  // `children` is declared on each member of a distributed union, so the union
  // of array types has no callable `.map` — widen to the one element type they
  // all share, as `expandDataSourceChildren` does.
  const children = host.children as
    ReadonlyArray<Component | ComponentReference | string> | undefined
  if (!Array.isArray(children) || children.length === 0) return host
  const stamped = children.map((child) => stampNestedChild(child, ctx))
  return stamped.some((child, index) => child !== children[index])
    ? ({ ...host, children: stamped } as Component)
    : host
}

/**
 * A `specimen` holds the node it draws in `component`, not in `children`.
 *
 * Two reasons this needs its own step rather than falling out of the walk
 * above. The field is not `children`, so the walk cannot see it; and the node
 * is written in by `drawnSpecimenNode` AFTER the specimen pass has walked it,
 * so nothing earlier in the pipeline has stamped it either.
 *
 * It only started mattering when the catalogue drew its first CLIENT-fetching
 * specimen. Every other data type is an unconditional island TYPE and gets its
 * host from the renderer; the catalogue's `list` is the one whose island-ness
 * is decided here, so without this it drew a bare empty `<ul>` on the kit page
 * while its six siblings fetched normally.
 *
 * Identity-preserving, like its caller: a specimen with nothing to stamp — and
 * every node that is not a specimen — comes back by reference.
 */
function stampSpecimenSubject(
  node: Component,
  ctx: { readonly app: App; readonly routeParams: Readonly<Record<string, string>> }
): Component {
  const drawn = (node as { readonly component?: unknown }).component
  // A STRING here is the reference form (`{ component: 'name' }`), which names
  // a template and is not ours to descend into. Only an object is a drawn node.
  if (typeof drawn !== 'object' || drawn === null) return node
  const stamped = stampNestedChild(drawn as Component, ctx)
  return stamped === drawn ? node : ({ ...node, component: stamped } as Component)
}

/** One child of a layout container: stamp it for its island, or descend past it. */
function stampNestedChild(
  child: Component | ComponentReference | string,
  ctx: { readonly app: App; readonly routeParams: Readonly<Record<string, string>> }
): Component | ComponentReference | string {
  if (typeof child === 'string') return child
  // The VALUE-keyed guard, not `'component' in child`. A `specimen` declares a
  // field called `component` holding a whole node, so the key test reads every
  // specimen as a reference to a template and hands it back untouched — which
  // is precisely how the catalogue's `list` lost its island stamp. Both
  // reference schemas type their field as `Schema.String`, so a string means a
  // name and an object means a component.
  if (isComponentReferenceNode(child)) return child
  // Same preamble as `resolveComponent`: a nested `{ systemSource }` reference
  // and a nested `$param` filter must be concrete BEFORE the short-circuit
  // serialises `dataSource` for the client, exactly as at the top level.
  const bound = bindRouteParams(desugarSystemSourceRef(child, ctx.app), ctx.routeParams)
  if (!bound.dataSource) return stampNestedIslands(bound, ctx)
  // Not an island binding — hand back the ORIGINAL child, with neither the
  // desugaring nor the route binding above applied, so a nested server-resolved
  // binding passes through this walk exactly as it did before it existed.
  return resolveIslandShortCircuit(bound, ctx.routeParams, ctx.app) ?? child
}

/**
 * Stamps the island props of every data-bound node declared inside an
 * `app.components` TEMPLATE, so a list placed by `{ component: 'name' }` mounts
 * exactly as the same list written inline does.
 *
 * WHY the templates and not the reference: a reference is expanded by the
 * RENDERER, from the template list it is handed, long after the page walk above
 * has run — and that walk deliberately returns a reference untouched, because it
 * names a template rather than being a component. So the page-side stamp never
 * reached the list inside the template, and a `list` — the one data type whose
 * island-ness is decided here rather than by its type — fell through to a bare
 * `<ul>` with no `data-island`. Stamping the templates once per render, beside
 * the code-highlight pass that already does the same for `code`, puts the stamp
 * where the renderer reads, whether the reference sits at the top level or
 * inside a container, and whether the list is the template itself or nested
 * within it.
 *
 * Identity-preserving: a template list with nothing to stamp comes back by
 * reference, so an app with no data-bound template pays nothing downstream.
 */
export function stampTemplateIslands(
  components: App['components'],
  ctx: { readonly app: App; readonly routeParams: Readonly<Record<string, string>> }
): App['components'] {
  if (components === undefined || components.length === 0) return components
  const stamped = components.map((template) => stampNestedChild(template as Component, ctx))
  return stamped.some((template, index) => template !== components[index])
    ? (stamped as App['components'])
    : components
}
