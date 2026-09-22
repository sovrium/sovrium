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

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { isListIslandMode } from '@/presentation/render/registry/list-island-mode'
import {
  isRecordDrawerSystemMode,
  isRecordFieldSystemMode,
} from '@/presentation/render/registry/system-detail-mode'
import { isComponentReferenceNode } from '@/presentation/render/resolve/component-reference'
import { desugarSystemSourceRef } from './data-source-contracts'
import {
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
    children: filterChildrenForRecord(component.children ?? [], record).map(
      (child: Component | string) =>
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
 * `'li'` is the historical synthesis and stays the default: a data-bound LIST
 * renders `<ul>`, and its rows are list items.
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

export function expandDataSourceChildren(
  component: Component,
  records: readonly Record<string, unknown>[],
  paginationMeta?: PaginationMeta,
  expansion: RowExpansionOptions = {}
): Component {
  const { substitution = 'deep', rowWrapper = 'li' } = expansion
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

  const expandedChildren: readonly (Component | string)[] = records.flatMap((record) => {
    const kept = filterChildrenForRecord(component.children!, record)

    // A record that gated away EVERY child of its template gets no row element
    // at all. The per-row filter reaches the children and used to stop one
    // element short of the wrapper, so such a record still produced an `<li>`
    // holding nothing — and no config could prevent it, because `rowWrapper` is
    // chosen here and has no node an author could hang a predicate on.
    //
    // The rule is stated on the FILTERED CHILDREN rather than on the predicate:
    // it fires whenever the expansion has nothing left to put in a row,
    // whatever emptied it. Distinct from the `children.length === 0`
    // short-circuit above, which is an author's genuinely empty template — that
    // is not a gate firing, and it still yields the bound-but-empty component
    // it describes.
    if (kept.length === 0) return []

    return [
      {
        type: rowWrapper as Component['type'],
        // String children render as React children (escaped) — see the note in
        // `substituteRecordInComponent`. Component children route through it,
        // which is where the content pin is applied.
        children: kept.map((child: Component | string) =>
          typeof child === 'string'
            ? substituteRecordVars(child, record)
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
export function resolveIslandShortCircuit(
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
 * which is pure, descends.
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
  if (!children || children.length === 0) return host
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
  return resolveIslandShortCircuit(bound, ctx.routeParams) ?? child
}
