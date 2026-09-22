/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { extractParamNames } from '@/domain/kernel/matching/route-matcher'
import { normalizeRouteParamRef } from '@/domain/models/app/pages/route-param-ref'
import { PAGE_WINDOW_DEFAULT_PARAM, PAGE_WINDOW_PRESET_ID } from '@/domain/models/app/pages/window'
import {
  activeMarkerViolations,
  codeContentFromViolations,
  repeatPlacementViolations,
  systemRowTemplateDepthViolations,
  systemRowTemplateViolations,
  visibilityPolarityViolations,
} from './component-rule-validation'
import { queryVisibilityViolations } from './query-visibility-validation'
import { boundNodesOf, describeNode } from './record-binding-walk'
import { recordReferenceViolations } from './record-reference-validation'
import { routeParamAllowListViolations } from './route-param-allow-list-validation'
import { sharedFilterChannelViolations } from './shared-filter-validation'
import { sidebarNavigationViolations } from './sidebar-nav-validation'

/**
 * Every `$param.<name>` reference in a string, by the same name grammar the
 * route matcher captures. A single STATIC literal — never built from input
 * (`sovrium/no-dynamic-regexp`).
 */
const PARAM_REFERENCE = /\$param\.([A-Za-z_][A-Za-z0-9_]*)/g

/** Query property names accepted as URL keys: lowercase kebab-case. */
const QUERY_PROP_NAME = /^[a-z][a-z0-9-]*$/

/**
 * Cross-field decode rules for a single page — the ones that need more context
 * than the field schema they guard, and therefore cannot live on it.
 *
 * Seventeen families, each introduced with the client primitive it guards:
 *
 *  1. **Route-parameter bindings.** A ROWS-source `dataSource.system.param`, or
 *     a `$param.<name>` reference ANYWHERE in the page, names a segment of the
 *     host page's `path`. A name with no matching `:segment` cannot resolve to
 *     anything at request time — the endpoint would be requested with a literal
 *     `:group` in it, a filter would compare against `undefined`, an action URL
 *     would POST to a path containing `$param.table`. All fail SILENTLY at
 *     runtime and all are decidable offline, so they are decode errors naming
 *     the reference AND the path. A DETAIL-source `param` is deliberately NOT
 *     governed — see {@link ROWS_SOURCE_COMPONENT_TYPES}.
 *
 *  2. **`redirectToFirst` needs a list.** "Redirect to the first object" is
 *     meaningless without a source that resolves a list of objects, so the page
 *     must declare one.
 *
 *  3. **`breadcrumb` items XOR derive.** A breadcrumb either enumerates its
 *     trail or derives it from the path; declaring both leaves no defensible
 *     precedence, and `labels` (a per-segment relabel map) is inert without
 *     `derive`.
 *
 *  4. **Query properties.** A `default` outside its own `enum`, and a property
 *     name that is not a legal URL key.
 *
 *  5. **Sidebar groups.** A group with neither `items` nor `source` is a heading
 *     with nothing under it.
 *
 * 5b. **Sidebar landmarks, props and disclosures.** A `headingLevel` outside a
 *     `landmark` announces a name the landmark already carries; groups sharing a
 *     landmark that are not adjacent cannot be wrapped without reordering the
 *     author's navigation; two landmarks with one name are indistinguishable to
 *     the reader cycling them. A `props` bag setting `href`, a class or one of
 *     the ARIA attributes the renderer computes gives one attribute two owners.
 *     A disclosure lists authored children XOR fetched ones — only the fetched
 *     list has loading / error / empty states — and a toggle name without
 *     `{label}` is the same name on every disclosure in the sidebar. Every one is
 *     decidable from the sidebar node alone, and none can live on the schema for
 *     the wrapping reason below.
 *
 *  6. **`visibility.record` needs a record, and an operator.** The per-row gate
 *     is matched against the record a row was expanded from. A component with no
 *     record-binding ancestor is never expanded against one, so the predicate
 *     could never fire — and the component would render unconditionally, which is
 *     the OPPOSITE of what its author wrote. A predicate carrying only `field` is
 *     inert for the same reason from the other direction: `matchesConditionOperators`
 *     ANDs the operators it is given, so no operators means "matches everything"
 *     — a gate that renders everywhere, which is what its author wrote it to
 *     stop. (A MISSPELLED operator is a different defect with a different owner:
 *     the excess-property reporter refuses it by name on the boot path. A bare
 *     `Schema.decodeUnknownSync` would drop it and leave exactly the
 *     operator-less predicate this rule catches.) Both are decidable offline —
 *     the first from the component's ancestry, which is why neither can live on
 *     `VisibilitySchema`.
 *
 *  7. **Window presets.** A preset id that is not a span, a duplicated id, a
 *     `default` naming no preset, and a `window.param` shadowing a declared
 *     `query` property — one URL key cannot carry two independent allow-lists.
 *
 *  8. **Inline select editors.** An `editSelect` states its choices exactly
 *     once: a literal `options` array OR a resolved `optionsSource`.
 *
 *  9. **Derived data-table columns.** `columnsFrom` is exclusive with an
 *     authored `columns`, and needs a DB-table binding to derive from.
 *
 * 10. **The current-item marker.** `activeWhen` and `activeProps` are useless
 *     apart, and a comparison between two literals answers the same on every
 *     render — so it is not a conditional, it is a typo with a default.
 *
 * 11. **Visibility polarity.** One component may not require the host app to
 *     declare a capability AND to not declare it: it could never render, which
 *     is the opposite of what its author wrote.
 *
 * 12. **Shared-filter channels.** Two publishers contributing the SAME param to
 *     the same channel overwrite each other on every emit with no defensible
 *     precedence; and a subscriber consuming a param no publisher on its channel
 *     contributes merges nothing, forever, in silence.
 *
 * 13. **System row templates are read-only.** A `{ system }` rows binding whose
 *     children are cloned per row may carry no live submit control, at any
 *     depth.
 *
 * 14. **`$record.<field>` needs a record.** The per-row substitution runs as
 *     each row is expanded from its template, so a reference with no
 *     record-binding ancestor is never handed a record — and reaches the browser
 *     as the LITERAL text `$record.name`. Same structural fact as family 6, and
 *     the same walk; the difference is only what is being looked for.
 *
 * 16. **`page.params` — a route segment constrained to a declared set.** The
 *     constrained parameter must be one the page's own `path` declares, and the
 *     three envelope keys that resolve against a page or a route cannot be used
 *     by the read that decides whether the route exists. Lives in its own module
 *     (`route-param-allow-list-validation.ts`); see the note there.
 *
 * 17. **`visibility.query` names a state the page can be in.** `page.query`
 *     CLAMPS an out-of-enum URL value to the property's `default`, so a gate
 *     comparing against a value the enum does not carry — or naming a property
 *     that is not declared at all — can never hold, and the component renders
 *     under no URL. Nothing observable distinguishes that from a rare state, so
 *     it is refused at decode. Own module
 *     (`query-visibility-validation.ts`).
 *
 * WHY 4 THROUGH 17 ARE HERE RATHER THAN ON THEIR OWN SCHEMAS. Each is a local
 * rule the schema it guards could express directly — but
 * a `Schema.check` WRAPS the node it guards, and the property walker in
 * `[internal ref]` names a node by the identifier on its
 * OUTERMOST node. A wrapped struct therefore stops being addressed by its own
 * name (checking `PageSchema` re-keyed `Page.components` to
 * `App.pages[].components` and left `#/$defs/Page` published but unreferenced),
 * which silently re-keys the published property universe the docs gate compares
 * against. Keeping every schema node annotate-only and collecting the rules here
 * leaves the emitted contract the shape it already had.
 *
 * Pure: no I/O, no schema import, no React. Returns human-readable violation
 * messages, empty when the page is well-formed. The caller (`PagesSchema`'s
 * `Schema.check`) surfaces the first one as the decode error.
 *
 * @see src/domain/models/app/pages/index.ts — the `Schema.check` that calls this
 */
export function collectPageBindingViolations(page: unknown): readonly string[] {
  if (!isRecord(page)) return []

  const path = typeof page['path'] === 'string' ? page['path'] : ''
  const declared = new Set(extractParamNames(path))
  const label = pageLabel(page)
  const nodes = [...walk(page['components']), ...walk(page['layout'])]
  const strings = [...walkStrings(page['components']), ...walkStrings(page['layout'])]

  const route: RouteContext = { declared, label, path }

  return [
    ...routeParamViolations(nodes, strings, route),
    ...redirectToFirstViolations(page, nodes, label),
    ...breadcrumbViolations(nodes, label),
    ...queryViolations(page, label),
    ...sidebarGroupViolations(nodes, label),
    ...sidebarNavigationViolations(nodes, label),
    ...recordVisibilityViolations(page, label),
    ...windowViolations(page, label),
    ...editSelectOptionViolations(nodes, label),
    ...formFieldOptionViolations(nodes, label),
    ...derivedColumnViolations(nodes, label),
    ...activeMarkerViolations(nodes, label),
    ...visibilityPolarityViolations(nodes, label),
    ...sharedFilterChannelViolations(nodes, label),
    ...systemRowTemplateViolations(nodes, label),
    ...systemRowTemplateDepthViolations(nodes, label),
    ...repeatPlacementViolations(page, label),
    ...recordReferenceViolations(page, declared, label),
    ...codeContentFromViolations(nodes, label),
    ...routeParamAllowListViolations(page, declared, label),
    ...queryVisibilityViolations(page, label),
  ]
}

// ---------------------------------------------------------------------------
// 1. Route-parameter bindings
// ---------------------------------------------------------------------------

/**
 * What every route-parameter rule needs to decide AND to report: the segments
 * the page's `path` declares, plus the two strings a violation message names.
 * Bundled because they always travel together and never independently.
 */
interface RouteContext {
  readonly declared: ReadonlySet<string>
  readonly label: string
  readonly path: string
}

/**
 * Component types whose `dataSource.system` is the ROWS envelope — the ONLY
 * shape whose `param` is unambiguously a ROUTE parameter, and therefore the only
 * one this rule governs.
 *
 * `dataSource.system` is spelled identically by two DIFFERENT schemas, and their
 * `param` fields mean opposite things:
 *
 *  - `SystemSourceSchema` (rows envelope) — `param` names a `:segment` of the
 *    host page's `path`, substituted into the endpoint. A rows source has no
 *    bound record to take an id from, so a name the path does not declare is
 *    always a typo. GOVERNED.
 *  - `SystemDetailSourceSchema` (single record) — `param` names the endpoint's
 *    id SLOT, filled from the clicked row's id (`record-drawer`), the bound
 *    record (`record-field`), or `?record=`. It is unrelated to the page's path:
 *    a drawer on `/board` legitimately declares `param: 'id'`. NOT GOVERNED.
 *
 * The walk is structural (it cannot tell the two apart from the `system` object
 * alone — both carry `endpoint`, `param`, `idKey`, `query`, and the shipped
 * configs set none of the discriminating optional keys), so the CONSUMER's
 * `type` is what separates them. This list is therefore the component types that
 * accept `SystemSourceSchema`: `table` (via `DataTableSystemSourceSchema`,
 * an alias of it) plus the list family and `container` (via `dataBoundFields`).
 * `chart` and `kpi` keep their own specialized system sources, which declare no
 * `param` at all. The page-level `dataSource` is out of reach by construction —
 * only `components` and `layout` are walked — and so is the `app.systemSources[]`
 * catalogue, which is not part of a page.
 *
 * DIRECTION IS DELIBERATE: an allow-list, not a deny-list of the detail
 * consumers. A rows component added later and left off this list simply is not
 * checked (the pre-existing state); a detail consumer added later under a
 * deny-list would have every valid config REFUSED AT BOOT — which is exactly the
 * defect this scoping fixes, and it broke 8 shipped record-drawer specs plus the
 * CLI validation contract before it was caught.
 *
 * @see src/domain/models/app/pages/components/system-source.ts — the rows envelope
 * @see src/domain/models/app/pages/components/system-detail-source.ts — the single record
 * @see src/domain/models/app/pages/components/component-types/modules/data-bound.ts
 */
const ROWS_SOURCE_COMPONENT_TYPES: ReadonlySet<string> = new Set([
  'table',
  'list',
  'kanban',
  'calendar',
  'gallery',
  'timeline',
  'container',
])

/**
 * Every route-parameter reference reachable from the page must name a
 * `:segment` the page's `path` declares.
 */
function routeParamViolations(
  nodes: readonly Record<string, unknown>[],
  strings: readonly string[],
  route: RouteContext
): readonly string[] {
  return [
    ...nodes.flatMap((node) => systemParamViolation(node, route.declared, route.label, route.path)),
    ...referenceParamViolations(nodes, strings, route),
  ]
}

/**
 * Every `$param.<name>` reference reachable as a STRING anywhere in the page.
 *
 * ─── WHY THE SCAN IS OVER STRINGS RATHER THAN OVER KNOWN KEYS ──────────────
 *
 * `$param.<name>` started life in `dataSource.filter[].value` and this rule
 * used to look only there. That was already the wrong shape and became visibly
 * so once the reference had to reach an action URL, a file upload target and an
 * island-hosted prop: enumerating the keys a route value is useful in means
 * this rule silently stops firing every time a new one is added — a validation
 * gap that fails exactly the way the thing it validates does, in silence.
 *
 * A string scan cannot go stale that way, and it is the same decision the
 * `$query.<name>` substitution pass already made on the resolution side
 * (`query-props-resolver.ts` walks every string leaf rather than a key list).
 * The two now agree: a reference is legal wherever a string is, and is checked
 * wherever a string is.
 *
 * The TYPED form `{ kind: 'routeParam', name }` is an object rather than a
 * string, so it is collected from the node walk instead — the two spellings are
 * equivalent by design and must be adjudicated identically.
 *
 * Names are deduplicated, so a page interpolating `$param.table` into a dozen
 * URLs reports the typo once rather than a dozen times.
 */
function referenceParamViolations(
  nodes: readonly Record<string, unknown>[],
  strings: readonly string[],
  { declared, label, path }: RouteContext
): readonly string[] {
  const fromStrings = strings
    .filter((value) => value.includes('$param.'))
    .flatMap((value) => [...value.matchAll(PARAM_REFERENCE)].map((match) => match[1]))
    .filter((name): name is string => name !== undefined)

  const fromTypedRefs = nodes
    .map((node) => normalizeRouteParamRef(node))
    .filter((ref) => ref !== undefined)
    .map((ref) => ref.name)

  return [...new Set([...fromStrings, ...fromTypedRefs])]
    .filter((name) => !declared.has(name))
    .toSorted((a, b) => a.localeCompare(b))
    .map(
      (name) =>
        `${label} references route param "$param.${name}" but its path "${path}" declares no ":${name}" segment`
    )
}

/**
 * `dataSource.system.param` — the rows-envelope ROUTE binding, and only that
 * one. Gated on the owning component's `type` because the detail envelope is
 * spelled the same way and means something else entirely
 * ({@link ROWS_SOURCE_COMPONENT_TYPES}), which is why this one takes the whole
 * NODE where its filter sibling takes the `dataSource`.
 */
function systemParamViolation(
  node: Readonly<Record<string, unknown>>,
  declared: ReadonlySet<string>,
  label: string,
  path: string
): readonly string[] {
  const { type, dataSource } = node
  if (typeof type !== 'string' || !ROWS_SOURCE_COMPONENT_TYPES.has(type)) return []
  if (!isRecord(dataSource)) return []

  const { system } = dataSource
  if (!isRecord(system)) return []
  const { param: name } = system
  if (typeof name !== 'string' || declared.has(name)) return []
  return [
    `${label} binds dataSource.system.param "${name}" but its path "${path}" declares no ":${name}" segment`,
  ]
}

// ---------------------------------------------------------------------------
// 2. `redirectToFirst` needs a list source
// ---------------------------------------------------------------------------

/**
 * `redirectToFirst` resolves the FIRST row of a list and 302s to it. A page with
 * no list source resolves no rows, so the property could never fire — which
 * reads as "the redirect is broken" rather than "the redirect is unreachable".
 *
 * A list source is either a component-level rows binding (`dataSource.system`
 * inline, or `dataSource.systemSource` by catalog name) or a page-level DB
 * binding in `mode: list`.
 */
function redirectToFirstViolations(
  page: Readonly<Record<string, unknown>>,
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  if (page['redirectToFirst'] === undefined) return []
  if (hasListSource(page, nodes)) return []
  return [
    `${label} declares redirectToFirst but resolves no list: add a component dataSource.system / dataSource.systemSource, or a page-level dataSource with mode: list`,
  ]
}

function hasListSource(
  page: Readonly<Record<string, unknown>>,
  nodes: readonly Record<string, unknown>[]
): boolean {
  const pageSource = page['dataSource']
  if (isRecord(pageSource) && pageSource['mode'] === 'list') return true

  return nodes.some((node) => {
    const { dataSource } = node
    if (!isRecord(dataSource)) return false
    return isRecord(dataSource['system']) || typeof dataSource['systemSource'] === 'string'
  })
}

// ---------------------------------------------------------------------------
// 3. `breadcrumb` items XOR derive; `labels` / `home` require derive
// ---------------------------------------------------------------------------

function breadcrumbViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes
    .filter((node) => node['type'] === 'breadcrumb')
    .flatMap((node) => {
      const hasDerive = node['derive'] !== undefined
      return [
        ...(node['breadcrumbItems'] !== undefined && hasDerive
          ? [
              `${label} declares a breadcrumb with both breadcrumbItems and derive — keep one: an enumerated trail OR a path-derived one`,
            ]
          : []),
        ...(node['labels'] !== undefined && !hasDerive
          ? [
              `${label} declares breadcrumb labels without derive — the label map relabels DERIVED path segments and is inert on an enumerated trail`,
            ]
          : []),
        ...(node['home'] !== undefined && !hasDerive
          ? [
              `${label} declares a breadcrumb home crumb without derive — an enumerated trail states its own first item, so the root crumb would be a duplicate`,
            ]
          : []),
      ]
    })
}

// ---------------------------------------------------------------------------
// 4. Query properties
// ---------------------------------------------------------------------------

/**
 * A declared query property must be usable from a URL and internally coherent.
 *
 * The name rule is checked HERE rather than by refining the record's key schema
 * because Effect 4's `Schema.Record` silently DROPS an entry whose key fails —
 * a typo'd `Period:` would become a property that simply does not exist, with no
 * error and a `$query.Period` that never resolves.
 */
function queryViolations(
  page: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  const { query } = page
  if (!isRecord(query)) return []

  const invalidNames = Object.keys(query).filter((name) => !QUERY_PROP_NAME.test(name))

  return [
    ...(invalidNames.length > 0
      ? [
          `${label} declares query property name(s) [${invalidNames.join(', ')}] that are not lowercase kebab-case (${QUERY_PROP_NAME.source})`,
        ]
      : []),
    ...Object.entries(query).flatMap(([name, prop]) =>
      unreachableDefaultViolation(name, prop, label)
    ),
  ]
}

function unreachableDefaultViolation(
  name: string,
  prop: unknown,
  label: string
): readonly string[] {
  if (!isRecord(prop)) return []
  const { enum: allowed } = prop
  if (!Array.isArray(allowed)) return []
  // Both fallbacks answer to one rule, because they fail the same way: a value
  // outside the property's own `enum` names a state the page can never be in.
  // `default` would render it on every unparameterised request; `onUnknown`
  // would render it on every mistyped one — and a `visibility.query` gate can
  // never NAME either, since that predicate's value is checked against this same
  // `enum` (family 17). Reported per key so an author with both wrong is told
  // about both.
  return (['default', 'onUnknown'] as const).flatMap((key) => {
    const fallback = prop[key]
    if (typeof fallback !== 'string' || allowed.includes(fallback)) return []
    return [
      `${label} declares query property "${name}" whose ${key} "${fallback}" is not one of its enum values [${allowed.join(', ')}]`,
    ]
  })
}

// ---------------------------------------------------------------------------
// 5. Sidebar groups
// ---------------------------------------------------------------------------

function sidebarGroupViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes
    .filter((node) => node['type'] === 'sidebar')
    .flatMap((node) => (Array.isArray(node['groups']) ? node['groups'] : []))
    .filter(isRecord)
    .filter((group) => group['items'] === undefined && group['source'] === undefined)
    .map((group) => {
      const name = typeof group['label'] === 'string' ? group['label'] : 'unnamed'
      return `${label} declares sidebar group "${name}" with neither items nor source — a heading with no entries under it`
    })
}

// ---------------------------------------------------------------------------
// 6. `visibility.record` requires a record-binding ancestor
// ---------------------------------------------------------------------------

/**
 * `visibility.record` renders a component only on records whose named field
 * satisfies a predicate — a PER-ROW gate, evaluated as each row is expanded from
 * its template (`presentation/rendering/record-visibility.ts`).
 *
 * A record only ever reaches a component through an ANCESTOR that binds one: a
 * component-level `dataSource` (a table binding, a rows envelope, a named
 * `systemSource`, or a single-record detail source), or the page-level
 * `dataSource` a collection page declares, which binds every component on the
 * page. Outside that, `satisfiesFieldCondition` is handed no record, the
 * predicate cannot fire, and the component renders on every request — so the
 * author has written a gate that does the opposite of what it says.
 *
 * THE ANCESTOR IS PROPER, NEVER SELF. A `record-field` with its own `dataSource`
 * resolves that source AFTER visibility would be decided, so it cannot gate
 * itself on the record it is about to fetch.
 *
 * DIRECTION: the rule refuses an ABSENCE, so a binding form it does not
 * recognise would refuse a VALID config — the failure mode
 * {@link ROWS_SOURCE_COMPONENT_TYPES} above was scoped to avoid. It is therefore
 * anchored on the single structural fact every binding form shares — the node
 * carries a `dataSource` object — rather than on a list of component types or of
 * `dataSource` shapes, neither of which can go stale into a false refusal.
 */
function recordVisibilityViolations(
  page: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  return boundNodesOf(page).flatMap(({ node, boundByAncestor }) => {
    const condition = readRecordVisibility(node)
    if (condition === undefined) return []
    if (!boundByAncestor) {
      return [
        `${label} declares visibility.record on a ${describeNode(node)} with no record-binding ancestor — the per-row gate is matched against a bound record, so here it could never fire and the component would render unconditionally. Nest it under a component with a dataSource (list / gallery / kanban / data-table row template, or a single-record container), or use visibility.condition for a session-based gate`,
      ]
    }
    if (!hasOperator(condition)) {
      return [
        `${label} declares visibility.record on a ${describeNode(node)} with a field but no operator — the matcher ANDs the operators it is given, so an empty predicate matches every record and the gate renders everywhere. Add one of ${CONDITION_OPERATORS.join(', ')}`,
      ]
    }
    return []
  })
}

/**
 * The operator vocabulary `ConditionOperatorsSchema` declares.
 *
 * Duplicated as a literal list rather than derived from the schema: this module
 * is deliberately schema-free (see the header — a `Schema.check` wrapping a node
 * re-keys the published property universe), and the list is only ever used to
 * NAME the options in an error message. Its worst failure is an out-of-date
 * suggestion, never a wrong verdict — {@link hasOperator} tests for the absence
 * of ANY key but `field`, so an operator added later is honoured without
 * touching this.
 */
const CONDITION_OPERATORS = [
  'eq',
  'neq',
  'in',
  'notIn',
  'contains',
  'gt',
  'lt',
  'gte',
  'lte',
] as const

/** True when a predicate carries at least one key that is not `field`. */
function hasOperator(condition: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(condition).some((key) => key !== 'field')
}

/**
 * The node's `visibility.record` predicate, by either convention — the component
 * ROOT (where the schema spreads `visibilityFields`) or `props.visibility` (the
 * runtime convention the renderer reads) — or `undefined` when it declares none.
 *
 * Anchored on the node having a `type`, so the structural walk reports the
 * COMPONENT once rather than reporting it and then its own `props` object again:
 * on the `props` node, `props.visibility` is reachable as a root `visibility`
 * and the two conventions collapse into one node twice.
 */
function readRecordVisibility(
  node: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> | undefined {
  if (typeof node['type'] !== 'string') return undefined
  const { visibility: fromRoot, props } = node
  const fromProps = isRecord(props) ? props['visibility'] : undefined
  const visibility = isRecord(fromRoot) ? fromRoot : fromProps
  if (!isRecord(visibility)) return undefined
  const condition = visibility['record']
  return isRecord(condition) ? condition : undefined
}

// ---------------------------------------------------------------------------
// 7. Window presets
// ---------------------------------------------------------------------------

/**
 * A declared `page.window` must be selectable and internally coherent.
 *
 * All four rules are here rather than on `PageWindowSchema` for the reason the
 * header records: a `Schema.check` WRAPS the node it guards, so a checked
 * `PageWindowPreset` would stop being addressed by its own identifier and
 * silently re-key the published property universe the docs gate compares
 * against.
 *
 * The `param` collision rule is the one that is easy to miss and impossible to
 * debug: `window.param` and a `page.query` property share the URL's key space,
 * and a page declaring both under one name would have two independent resolvers
 * clamping the same parameter into two different allow-lists. Whichever
 * substitution ran second would win, which is a coin toss the config author
 * cannot see.
 */
function windowViolations(
  page: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  const { window } = page
  if (!isRecord(window)) return []

  const presets = Array.isArray(window['presets']) ? window['presets'].filter(isRecord) : []
  const ids = presets
    .map((preset) => preset['id'])
    .filter((id): id is string => typeof id === 'string')

  return [
    ...presetGrammarViolations(ids, label),
    ...duplicatePresetViolations(ids, label),
    ...windowDefaultViolation(window, ids, label),
    ...windowParamCollisionViolation(page, window, label),
  ]
}

/** Every preset id must spell a span: a positive integer plus `h`, `d` or `w`. */
function presetGrammarViolations(ids: readonly string[], label: string): readonly string[] {
  const invalid = ids.filter((id) => !PAGE_WINDOW_PRESET_ID.test(id))
  if (invalid.length === 0) return []
  return [
    `${label} declares window preset id(s) [${invalid.join(', ')}] that are not a span: a positive integer followed by h, d or w (${PAGE_WINDOW_PRESET_ID.source})`,
  ]
}

/**
 * Two presets with one id make the selector ambiguous — the second is
 * unreachable, and which one `default` names is a lookup-order accident.
 */
function duplicatePresetViolations(ids: readonly string[], label: string): readonly string[] {
  const duplicated = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]
  if (duplicated.length === 0) return []
  return [
    `${label} declares window preset id(s) [${duplicated.join(', ')}] more than once — each id names one window`,
  ]
}

/** `default` must name a declared preset, or nothing is selectable. */
function windowDefaultViolation(
  window: Readonly<Record<string, unknown>>,
  ids: readonly string[],
  label: string
): readonly string[] {
  const fallback = window['default']
  if (typeof fallback !== 'string' || ids.length === 0 || ids.includes(fallback)) return []
  return [
    `${label} declares window default "${fallback}" which is not one of its preset ids [${ids.join(', ')}]`,
  ]
}

/** `window.param` may not shadow a declared `page.query` property. */
function windowParamCollisionViolation(
  page: Readonly<Record<string, unknown>>,
  window: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  const param = typeof window['param'] === 'string' ? window['param'] : PAGE_WINDOW_DEFAULT_PARAM
  const { query } = page
  if (!isRecord(query) || !(param in query)) return []
  return [
    `${label} declares window param "${param}" and a query property of the same name — one URL key cannot carry two independent allow-lists`,
  ]
}

// ---------------------------------------------------------------------------
// 8. Inline select editors: options XOR optionsSource
// ---------------------------------------------------------------------------

/**
 * An inline `editSelect` states its choices exactly once — as a literal
 * `options` array, or as an `optionsSource` binding resolved before render.
 *
 * Neither is a dropdown with nothing in it. Both is two answers to one question
 * with no defensible precedence, which is the same reason a breadcrumb may not
 * carry `breadcrumbItems` and `derive` together.
 */
function editSelectOptionViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes
    .map((node) => node['editSelect'])
    .filter(isRecord)
    .flatMap((editSelect) => {
      const name = typeof editSelect['field'] === 'string' ? editSelect['field'] : 'unnamed'
      const hasOptions = editSelect['options'] !== undefined
      const hasSource = editSelect['optionsSource'] !== undefined
      if (hasOptions && hasSource) {
        return [
          `${label} declares an editSelect on "${name}" with both options and optionsSource — keep one: a literal list OR a resolved source`,
        ]
      }
      if (!hasOptions && !hasSource) {
        return [
          `${label} declares an editSelect on "${name}" with neither options nor optionsSource — a dropdown with nothing to pick`,
        ]
      }
      return []
    })
}

/**
 * A `control: select` form field states its choices at most once — as a literal
 * `options` array, or as an `optionsSource` binding resolved before render.
 *
 * ─── WHY "AT MOST", NOT "EXACTLY" ──────────────────────────────────────────
 *
 * Its `editSelect` sibling above refuses NEITHER as well as BOTH, because an
 * inline row editor with no choices can only ever be a dropdown with nothing in
 * it. A form field is different: `control` is optional and a TABLE-bound form
 * derives every control, and its choices, from the column type — so a field
 * declaring neither is the ordinary case, not a defect. Only the ambiguity is
 * refused here.
 */
function formFieldOptionViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes
    .flatMap((node) => (Array.isArray(node['fields']) ? node['fields'] : []))
    .filter(isRecord)
    .flatMap((field) => {
      if (field['options'] === undefined || field['optionsSource'] === undefined) return []
      const name = typeof field['field'] === 'string' ? field['field'] : 'unnamed'
      return [
        `${label} declares a form field "${name}" with both options and optionsSource — keep one: a literal list OR a resolved source`,
      ]
    })
}

// ---------------------------------------------------------------------------
// 9. Derived data-table columns
// ---------------------------------------------------------------------------

/**
 * `columnsFrom: 'table'` derives one column per declared field of the bound
 * table, which is what makes a records grid over ANY table one page definition
 * rather than one per table.
 *
 * Two rules, both about what the derivation can actually read. It needs a
 * DB-table binding: a system source describes an endpoint's shape rather than a
 * declared table, so there are no fields to derive from and the grid would
 * render no columns at all — the silent failure this refuses. And it is
 * exclusive with an authored `columns`, for the breadcrumb reason again.
 */
function derivedColumnViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes
    .filter((node) => node['columnsFrom'] !== undefined)
    .flatMap((node) => {
      const { dataSource } = node
      const boundToTable = isRecord(dataSource) && typeof dataSource['table'] === 'string'
      return [
        ...(node['columns'] !== undefined
          ? [
              `${label} declares a data-table with both columns and columnsFrom — keep one: authored columns OR columns derived from the bound table`,
            ]
          : []),
        ...(boundToTable
          ? []
          : [
              `${label} declares columnsFrom without a dataSource.table — a system source describes an endpoint's shape, not a declared table, so there are no fields to derive columns from`,
            ]),
      ]
    })
}

// ---------------------------------------------------------------------------
// Walk helpers
// ---------------------------------------------------------------------------

/**
 * Depth-first collection of every object node reachable from `value`.
 *
 * Deliberately structural rather than typed against the component union: the
 * union is ~58 branches wide and each carries its own children key, so a typed
 * traversal would need updating for every new component type — and would fail
 * SILENTLY (a missed branch is a rule that stops firing, not a compile error).
 * A structural walk cannot go stale that way. It only ever READS well-known
 * keys, so an unrelated object shape passing through is inert.
 */
function walk(value: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(walk)
  if (!isRecord(value)) return []
  return [value, ...Object.values(value).flatMap(walk)]
}

/**
 * Depth-first collection of every STRING leaf reachable from `value`.
 *
 * The sibling of {@link walk}, and structural for the same reason: a reference
 * is legal wherever a string is, so a rule keyed on known property names would
 * stop firing the moment a new one accepted one.
 */
function walkStrings(value: unknown): readonly string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(walkStrings)
  if (!isRecord(value)) return []
  return Object.values(value).flatMap(walkStrings)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pageLabel(page: Readonly<Record<string, unknown>>): string {
  const name = typeof page['name'] === 'string' ? page['name'] : 'unnamed'
  return `page "${name}"`
}
