/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Read every `graph`'s bound GRAPH on the render path, and attach the drawing.
 *
 * The sibling of `matrix-graph-resolver.ts`, and deliberately its twin: the two
 * components read the same KIND of envelope — two collections that address each
 * other by id — so they read it the same way, for the same four reasons.
 *
 * ─── THE DATA IS READ HERE, NOT BY THE ISLAND ──────────────────────────────
 *
 * `graph` IS an island, and this is still a render-path read. The island exists
 * because SELECTION is client state; the DATA is not. Reading here buys three
 * things a fetch-on-mount could not: the accessible twin is in the FIRST
 * response (so a reader with no scripting, and a crawler, get every fact), the
 * read borrows the caller's identity rather than the browser's ambient one, and
 * a page drawing two lenses over one endpoint pays ONE read.
 *
 * ─── ONE READ, NOT TWO ─────────────────────────────────────────────────────
 *
 * A graph needs `nodes` AND `edges`, and `systemRowsFetcher` answers with one
 * flat `body[rowsKey]`. So this pass spends `systemRecordFetcher` with NO record
 * key, which returns the whole response ENVELOPE as one record — the sibling
 * reader in the same module, against the same borrowed identity.
 *
 * ─── AND THE PASS IS TWO WALKS, DELIBERATELY ───────────────────────────────
 *
 * The first walk COLLECTS the endpoints; the reads then happen once per
 * distinct URL, in parallel; the second walk attaches the drawings and is
 * synchronous. A Map and a Matrix over the same endpoint — which is exactly
 * what the console's Organisation page is — therefore cost one read between
 * them, because each resolver reads its own distinct-URL set and the endpoint
 * derives its whole graph per call.
 *
 * Nothing is cached ACROSS requests: every body here was read with one caller's
 * credentials and is discarded with them.
 *
 * ─── IDENTITY: THE CALLER'S, NEVER THE SERVER'S ────────────────────────────
 *
 * The fetcher borrows the caller's `cookie`, `user-agent` and the three IP
 * forwarding headers, so the nodes drawn are exactly the nodes that visitor
 * could have read. A render-path read on the server's own authority would draw
 * an administrator's map for an anonymous visitor (rule S1). The `user-agent`
 * is not decoration: session binding compares it, so dropping it resolves no
 * session, answers 401, and degrades to a map that says nothing is there.
 *
 * ─── FAIL-CLOSED, AND THE FOUR STATES STAY FOUR ────────────────────────────
 *
 * A refused read, a throw, a non-2xx and a render with NO fetcher (a static
 * build, a unit test) all reach `{ kind: 'unavailable' }`, which the component
 * draws as a NOTICE rather than as a drawing.
 *
 * ─── AND THE BINDING IS SPENT ──────────────────────────────────────────────
 *
 * `dataSource` is REMOVED from the resolved node, for the reason
 * `system-rows-template-resolver.ts` gives verbatim: `resolveComponent` keys off
 * `component.dataSource`, finds no `table`, and answers with a
 * `table "undefined" not found` banner over the drawing just made.
 *
 * @see src/infrastructure/egress/system-rows-fetcher.ts — the borrowed identity
 * @see ./graph-projection.ts — the drawing this attaches
 */

import { projectGraph, type GraphView } from '@/presentation/render/resolve/graph-projection'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { SystemRecordFetcher } from '@/presentation/render/resolve/page-system-record-binding'

/** The render-time field this pass attaches, read by `islandGraphComponent`. */
export interface GraphResolvedComponent {
  readonly graphView?: GraphView
}

/** The `{ system }` graph binding, as the walk reads it. */
interface GraphSystemBinding {
  readonly endpoint?: string
  readonly nodesKey?: string
  readonly edgesKey?: string
  readonly query?: Readonly<Record<string, string | number | boolean>>
}

/** The bodies read for this render, by request URL. */
type Envelopes = ReadonlyMap<string, Readonly<Record<string, unknown>> | undefined>

const isGraph = (node: unknown): node is Component =>
  typeof node === 'object' && node !== null && (node as Component).type === 'graph'

const bindingOf = (component: Component): GraphSystemBinding | undefined =>
  component.dataSource?.system as GraphSystemBinding | undefined

/**
 * Append a binding's STATIC query parameters to its endpoint.
 *
 * Percent-encoded, so a parameter carrying an `&` cannot inject a second one.
 * Mirrors the matrix resolver rather than sharing its private helper, so
 * neither module reaches into the other's internals for a six-line string build.
 */
const withStaticQuery = (endpoint: string, query: GraphSystemBinding['query']): string => {
  const entries = Object.entries(query ?? {})
  if (entries.length === 0) return endpoint
  const search = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${search}`
}

/** The request URL a graph reads, or nothing when it declares no endpoint. */
const requestUrlOf = (component: Component): string | undefined => {
  const system = bindingOf(component)
  return system?.endpoint === undefined || system.endpoint.length === 0
    ? undefined
    : withStaticQuery(system.endpoint, system.query)
}

/** Every distinct URL the page's graphs read — the first walk. */
const collectUrls = (node: unknown): readonly string[] => {
  if (Array.isArray(node)) return node.flatMap(collectUrls)
  if (typeof node !== 'object' || node === null) return []
  if (isGraph(node)) {
    const url = requestUrlOf(node as Component)
    return url === undefined ? [] : [url]
  }
  return collectUrls((node as { readonly children?: unknown }).children)
}

/** Read each distinct URL once, in parallel, borrowing the caller's identity. */
const readEnvelopes = async (
  urls: readonly string[],
  fetchSystemRecord: SystemRecordFetcher | undefined
): Promise<Envelopes> => {
  if (fetchSystemRecord === undefined) return new Map()
  return new Map(
    await Promise.all(
      [...new Set(urls)].map(
        async (url) =>
          [url, await fetchSystemRecord(url, undefined).catch(() => undefined)] as const
      )
    )
  )
}

/**
 * Replace one graph's binding with the drawing read for it.
 *
 * `localize` runs FIRST, and the ordering is the whole of it. A column's
 * `label` is authored config — required by the schema, and the group name the
 * accessible twin reads — but `projectGraph` copies it into `graphView`, and
 * `graphView` is deliberately skipped by the `$t:` pass that runs later on the
 * render walk, because the rest of that object is what an endpoint returned:
 * data, not vocabulary. So an authored token used to cross into the projection
 * raw, and the pass that would have resolved it then ran on a field nobody
 * reads. Resolving the component BEFORE it is projected fixes that without
 * widening the skip — what reaches the drawing is vocabulary already.
 */
const attachView = (
  source: Component,
  envelopes: Envelopes,
  localize: ((component: Component) => Component) | undefined
): Component => {
  const component = localize === undefined ? source : localize(source)
  const system = bindingOf(component)
  const { dataSource: _spent, ...rest } = component as Component & { dataSource?: unknown }
  const url = requestUrlOf(component)
  const envelope = url === undefined ? undefined : envelopes.get(url)
  const graphView: GraphView =
    url === undefined
      ? { kind: 'empty', degraded: [] }
      : envelope === undefined
        ? { kind: 'unavailable' }
        : projectGraph(envelope, {
            ...(component as unknown as Parameters<typeof projectGraph>[1]),
            ...(system?.nodesKey === undefined ? {} : { nodesKey: system.nodesKey }),
            ...(system?.edgesKey === undefined ? {} : { edgesKey: system.edgesKey }),
          })
  return { ...(rest as Component), graphView } as Component
}

/** Walk one node, attaching the drawing to any graph at or below it. */
const mapNode = (
  node: unknown,
  envelopes: Envelopes,
  localize: ((component: Component) => Component) | undefined
): unknown => {
  if (Array.isArray(node)) {
    const mapped = node.map((child) => mapNode(child, envelopes, localize))
    return mapped.every((child, index) => child === node[index]) ? node : mapped
  }
  if (isGraph(node)) return attachView(node as Component, envelopes, localize)
  if (typeof node !== 'object' || node === null) return node
  const { children } = node as { readonly children?: unknown }
  if (children === undefined) return node
  const mapped = mapNode(children, envelopes, localize)
  return mapped === children ? node : { ...(node as Record<string, unknown>), children: mapped }
}

/**
 * Resolve every `graph` on a page.
 *
 * Returns the SAME page when nothing matched, so a page with no graph — which
 * is nearly every page — pays one walk and no read at all.
 *
 * @param page - The page whose graphs to resolve
 * @param fetchSystemRecord - Server-side envelope reader, borrowing the caller's identity
 * @param localize - Resolves a component's authored `$t:` tokens against the page's
 *   active language. Supplied by the caller rather than derived here so this module
 *   stays ignorant of i18n; absent (a page with no dictionary) the component is
 *   projected exactly as authored.
 */
export async function resolveGraphs(
  page: Page,
  fetchSystemRecord: SystemRecordFetcher | undefined,
  localize?: (component: Component) => Component
): Promise<Page> {
  if (page.components === undefined) return page
  const urls = collectUrls(page.components)
  const envelopes = await readEnvelopes(urls, fetchSystemRecord)
  const components = mapNode(page.components, envelopes, localize)
  if (components === page.components) return page
  return { ...page, components: components as Page['components'] }
}
