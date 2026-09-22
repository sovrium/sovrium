/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Clone an ARBITRARY child template once per row of a SYSTEM read endpoint.
 *
 * ─── THE GAP THIS CLOSES ───────────────────────────────────────────────────
 *
 * `expandDataSourceChildren` — the pass that clones a child template per record
 * and substitutes `$record.*` — had exactly ONE caller, `resolveListMode`,
 * which reads through `db.fetchRecords`. A DB table. There was no `{ system }`
 * path into it, so a component carrying `dataSource: { system: … }` AND
 * `children` DECODED and then rendered its children ONCE, statically, with
 * every `$record.*` reaching the browser as a literal.
 *
 * System rows could otherwise reach a page only through FIXED island shapes: a
 * data-table's columns, a gallery/kanban/calendar card, `list` +
 * `listDisplay.itemTemplate`, a chart, a kpi. None of those can mint a per-row
 * `data-testid` or lay a card out the way a console page needs, which is what
 * kept every remaining console surface on a hand-written TypeScript builder.
 *
 * ─── WHY IT REUSES THE DB PATH'S OWN EXPANSION ─────────────────────────────
 *
 * `expandDataSourceChildren` is called here verbatim rather than reimplemented.
 * That is what makes `$record.*` substitution and per-row `visibility.record`
 * ONE implementation across both row sources: a gate that fired for a table row
 * and silently did nothing for a system row would be the worst kind of access
 * control, and until this pass existed that was exactly the situation.
 *
 * ─── IDENTITY: THE CALLER'S, NOT THE SERVER'S ──────────────────────────────
 *
 * The read runs on the RENDER path, so it borrows the requesting session's own
 * credentials through the injected {@link SystemRowsFetcher} — the same seam
 * `page.redirectToFirst` and the `select` option source already use. A second
 * fetcher is never added: a render-path read on the SERVER's authority would
 * hand every visitor whatever the endpoint shows an administrator (rule S1).
 *
 * ─── FAIL-CLOSED, AND SILENT ───────────────────────────────────────────────
 *
 * Every unresolved case yields ZERO rows: no fetcher (a caller with no HTTP
 * context — a unit test, a static build), a read that throws, an endpoint the
 * caller may not see. The component still renders its own empty state, and an
 * error would turn one unreachable endpoint into a blank page — the same
 * anti-enumeration degradation the option-source resolver takes.
 *
 * ─── READ-ONLY ─────────────────────────────────────────────────────────────
 *
 * A live submit control inside the template is refused at DECODE
 * (`component-rule-validation.ts`), not here: a system row has no table
 * identity, so no field permissions to apply and no write path the platform
 * owns.
 */

import { ISLAND_COMPONENT_TYPES } from '@/presentation/render/registry/island-component-types'
import { isListIslandMode } from '@/presentation/render/registry/list-island-mode'
import { expandDataSourceChildren } from '@/presentation/render/resolve/data-source-rows'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { SystemRowsFetcher } from '@/presentation/render/resolve/first-object-redirect-resolver'

/** Envelope default, shared with every other rows consumer. */
const DEFAULT_ROWS_KEY = 'items'

/**
 * Hard ceiling on the clones one binding may emit.
 *
 * The rows are server-rendered INTO the page, so an unbounded read inlines the
 * endpoint's whole corpus into the HTML — a page-weight cliff an author cannot
 * see coming from the config. Mirrors the option source's own ceiling.
 */
const MAX_EXPANDED_ROWS = 1000

/** The `{ system }` half of a data-source binding, as the walk reads it. */
interface SystemBinding {
  readonly endpoint: string
  readonly rowsKey?: string
  readonly query?: Readonly<Record<string, string | number | boolean>>
}

/**
 * True when a node is an arbitrary row TEMPLATE over a system source.
 *
 * Three exclusions, each of which owns its own fetch and would be broken by a
 * server-side expansion underneath it:
 *
 *  - an ISLAND type (`table`, `gallery`, `kanban`, `chart`, `kpi`, …)
 *    receives the binding serialised into its props and fetches client-side;
 *  - a `list` in island mode (`listDisplay.itemTemplate`) is the same story
 *    under a type that is NOT in the island set;
 *  - `mode: 'single'` is a record DETAIL binding, not a rows one — it has no
 *    row set to clone over.
 *
 * The remaining case is the one with no other home: a plain layout node with
 * children, which is what a console card grid is.
 */
function isSystemRowTemplate(node: unknown): node is Component & { dataSource: object } {
  if (typeof node !== 'object' || node === null) return false
  const component = node as Component
  const system = component.dataSource?.system as SystemBinding | undefined
  if (system?.endpoint === undefined) return false
  if (!Array.isArray(component.children) || component.children.length === 0) return false
  if ((component.dataSource as { mode?: string }).mode === 'single') return false
  if (ISLAND_COMPONENT_TYPES.has(component.type as string)) return false
  return !isListIslandMode(component)
}

/**
 * Append a binding's STATIC query parameters to its endpoint.
 *
 * Values are percent-encoded, so a parameter carrying an `&` cannot inject a
 * second one. Mirrors the option-source resolver rather than sharing its
 * private helper, so neither module reaches into the other's internals for a
 * six-line string build.
 */
function withStaticQuery(endpoint: string, query: SystemBinding['query']): string {
  if (query === undefined) return endpoint
  const entries = Object.entries(query)
  if (entries.length === 0) return endpoint
  const search = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${search}`
}

/**
 * Fetch a template's rows and expand it.
 *
 * `dataSource` is REMOVED from the expanded node. The binding has been spent,
 * and leaving it would send the node on to `resolveComponent` — which keys off
 * `component.dataSource`, finds no `table`, and answers with a
 * `table "undefined" not found` error banner over the rows just rendered.
 */
/**
 * How many `{ system }` row templates may sit inside one another AT RENDER.
 *
 * The mirror of the decode rule's `MAX_SYSTEM_ROW_TEMPLATE_DEPTH`, kept as its
 * own constant rather than imported: the decode rule REFUSES a third level and
 * this one STOPS at it, and a resolver that trusted the validator to have run
 * would fan out without bound on any path that reaches it another way. Two
 * cheap guards over one shared constant is the wrong trade when the failure is
 * an N x M render-path read an author cannot see coming.
 */
const MAX_TEMPLATE_DEPTH = 2

async function expandTemplate(
  component: Component,
  fetchSystemRows: SystemRowsFetcher | undefined,
  depth: number
): Promise<Component> {
  const system = component.dataSource?.system as SystemBinding
  const rows =
    fetchSystemRows === undefined
      ? []
      : await fetchSystemRows(
          withStaticQuery(system.endpoint, system.query),
          system.rowsKey ?? DEFAULT_ROWS_KEY
        ).catch(() => [])

  const { dataSource: _spent, ...rest } = component as Component & { dataSource?: unknown }

  // ZERO ROWS RENDER ZERO ROWS — never the template.
  //
  // `expandDataSourceChildren` short-circuits on an empty record set and returns
  // the component with its children UNTOUCHED, which for a DB list is the
  // established behaviour and is not changed here. For a system template it is a
  // leak: nothing substitutes, so `$record.key` reaches the browser as literal
  // text and a per-row `data-testid="row-$record.key"` becomes a real attribute
  // naming a record that does not exist. An endpoint legitimately answers with
  // an empty list — an app declaring no `env` block is the ordinary case, not an
  // error — so this is a state every such page reaches.
  //
  // Emptied HERE rather than in the shared expansion so the DB path keeps its
  // exact behaviour: this arm is the new one, and it is the one whose contract
  // says a template is a template.
  if (rows.length === 0) return { ...(rest as Component), children: [] }

  // The children of an INNER template are left unsubstituted here: they have not
  // met their own rows yet, and consuming their `$record.` against this row
  // would blank them before the inner read ever runs. `deep` at the last
  // permitted level, so a leaf template keeps today's behaviour exactly.
  const expanded = expandDataSourceChildren(
    rest as Component,
    [...rows].slice(0, MAX_EXPANDED_ROWS),
    undefined,
    {
      substitution: depth < MAX_TEMPLATE_DEPTH ? 'stop-at-nested-binding' : 'deep',
      // An INNER row is wrapped in a `div`, never an `li`. An `<li>` start tag
      // closes any open `<li>` in list-item scope and a `<div>` does not break
      // that scope, so an inner `li` closes the outer ROW's wrapper and the
      // parser re-parents the inner rows as siblings of the card meant to hold
      // them. The outer level keeps `li` — there is no second one to close it.
      rowWrapper: depth === 1 ? 'li' : 'div',
    }
  )
  if (depth >= MAX_TEMPLATE_DEPTH) return expanded

  // ONE more level, over the per-row CLONES. Each clone carries its own copy of
  // the inner binding with `$record.` already substituted from its own row, so
  // the N reads are N different reads — which is the whole reason the shape is
  // worth its cost.
  const children = await mapNode(expanded.children, fetchSystemRows, depth + 1)
  return children === expanded.children ? expanded : ({ ...expanded, children } as Component)
}

/**
 * Walk one node, expanding any template found at or below it.
 *
 * `depth` counts TEMPLATES on the path, not nodes, so ordinary markup nests
 * freely and only a second data binding spends a level. An expanded node's
 * clones ARE walked again — once — because that is the nested shape a flat rows
 * binding cannot express: `rowsKey` is one flat `body[key]` lookup and
 * `$record.` walks no path, so a card listing its own subject's rows needs a
 * second read per card. A third level is refused here and at decode.
 */
async function mapNode(
  node: unknown,
  fetchSystemRows: SystemRowsFetcher | undefined,
  depth = 1
): Promise<unknown> {
  if (Array.isArray(node)) {
    const mapped = await Promise.all(node.map((child) => mapNode(child, fetchSystemRows, depth)))
    return mapped.every((child, i) => child === node[i]) ? node : mapped
  }
  if (typeof node !== 'object' || node === null) return node
  if (isSystemRowTemplate(node)) return expandTemplate(node as Component, fetchSystemRows, depth)

  const { children } = node as { readonly children?: unknown }
  if (children === undefined) return node
  const mappedChildren = await mapNode(children, fetchSystemRows, depth)
  if (mappedChildren === children) return node
  return { ...(node as Record<string, unknown>), children: mappedChildren }
}

/**
 * Expand every system-backed row template on a page.
 *
 * Returns the SAME page when nothing matched, so a page with no such binding —
 * which is nearly every page — pays one walk and no copy.
 */
export async function expandSystemRowTemplates(
  page: Page,
  fetchSystemRows: SystemRowsFetcher | undefined
): Promise<Page> {
  if (page.components === undefined) return page
  const components = await mapNode(page.components, fetchSystemRows)
  if (components === page.components) return page
  return { ...page, components: components as Page['components'] }
}
