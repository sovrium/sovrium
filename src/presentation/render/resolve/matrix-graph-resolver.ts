/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Read every `matrix`'s bound GRAPH on the render path, and attach the drawing.
 *
 * ─── ONE READ, NOT TWO ─────────────────────────────────────────────────────
 *
 * A matrix needs `nodes` AND `edges`, and `systemRowsFetcher` answers with one
 * flat `body[rowsKey]`. So this pass spends `systemRecordFetcher` with NO record
 * key, which returns the whole response ENVELOPE as one record — the sibling
 * reader in the same module, against the same borrowed identity. Reading twice
 * would make `GET /api/admin/organisation/graph` derive its whole graph twice
 * per render, for a body it already ships complete.
 *
 * ─── AND THE PASS IS TWO WALKS, DELIBERATELY ───────────────────────────────
 *
 * The first walk COLLECTS the endpoints; the reads then happen once per
 * distinct URL, in parallel; the second walk attaches the drawings and is
 * synchronous. Two matrices over the same endpoint — the shape a page drawing
 * resources by role beside resources by team takes — therefore cost ONE read.
 * The alternative, a cache filled during a single async walk, is the same
 * saving bought with a mutable map on the render path.
 *
 * Nothing is cached ACROSS requests: every body here was read with one caller's
 * credentials and is discarded with them.
 *
 * ─── IDENTITY: THE CALLER'S, NEVER THE SERVER'S ────────────────────────────
 *
 * The fetcher borrows the caller's `cookie`, `user-agent` and the three IP
 * forwarding headers, so the nodes drawn are exactly the nodes that visitor
 * could have read. A render-path read on the server's own authority would draw
 * an administrator's grid for an anonymous visitor (rule S1). The `user-agent`
 * is not decoration: session binding compares it, so dropping it resolves no
 * session, answers 401, and degrades to a grid that says nothing is there.
 *
 * ─── FAIL-CLOSED, AND THE FOUR STATES STAY FOUR ────────────────────────────
 *
 * A refused read, a throw, a non-2xx and a render with NO fetcher (a static
 * build, a unit test) all reach `{ kind: 'unavailable' }`, which the component
 * draws as a NOTICE rather than as a grid. That is the one degradation a matrix
 * may not flatten: the instance has grants, and saying it has none because this
 * caller could not read them is exactly the lie the endpoint's own `degraded[]`
 * contract exists to refuse.
 *
 * ─── AND THE BINDING IS SPENT ──────────────────────────────────────────────
 *
 * `dataSource` is REMOVED from the resolved node, for the reason
 * `system-rows-template-resolver.ts` gives verbatim: `resolveComponent` keys off
 * `component.dataSource`, finds no `table`, and answers with a
 * `table "undefined" not found` banner over the grid just drawn.
 *
 * @see src/infrastructure/egress/system-rows-fetcher.ts — the borrowed identity
 * @see ./matrix-projection.ts — the drawing this attaches
 */

import { projectMatrix, type MatrixView } from '@/presentation/render/resolve/matrix-projection'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { SystemRecordFetcher } from '@/presentation/render/resolve/page-system-record-binding'

/** The render-time field this pass attaches, read by `matrixComponent`. */
export interface MatrixResolvedComponent {
  readonly matrixView?: MatrixView
}

/** The `{ system }` graph binding, as the walk reads it. */
interface MatrixSystemBinding {
  readonly endpoint?: string
  readonly nodesKey?: string
  readonly edgesKey?: string
  readonly query?: Readonly<Record<string, string | number | boolean>>
}

/** The bodies read for this render, by request URL. */
type Envelopes = ReadonlyMap<string, Readonly<Record<string, unknown>> | undefined>

const isMatrix = (node: unknown): node is Component =>
  typeof node === 'object' && node !== null && (node as Component).type === 'matrix'

const bindingOf = (component: Component): MatrixSystemBinding | undefined =>
  component.dataSource?.system as MatrixSystemBinding | undefined

/**
 * Append a binding's STATIC query parameters to its endpoint.
 *
 * Percent-encoded, so a parameter carrying an `&` cannot inject a second one.
 * Mirrors the row-template resolver rather than sharing its private helper, so
 * neither module reaches into the other's internals for a six-line string build.
 */
const withStaticQuery = (endpoint: string, query: MatrixSystemBinding['query']): string => {
  const entries = Object.entries(query ?? {})
  if (entries.length === 0) return endpoint
  const search = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${search}`
}

/** The request URL a matrix reads, or nothing when it declares no endpoint. */
const requestUrlOf = (component: Component): string | undefined => {
  const system = bindingOf(component)
  return system?.endpoint === undefined || system.endpoint.length === 0
    ? undefined
    : withStaticQuery(system.endpoint, system.query)
}

/** Every distinct URL the page's matrices read — the first walk. */
const collectUrls = (node: unknown): readonly string[] => {
  if (Array.isArray(node)) return node.flatMap(collectUrls)
  if (typeof node !== 'object' || node === null) return []
  if (isMatrix(node)) {
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
 * Replace one matrix's binding with the drawing read for it.
 *
 * `localize` runs FIRST, for the reason its twin in `graph-resolver.ts` states
 * at length: a cell's `flag.label` is authored vocabulary, `projectMatrix`
 * copies it into `matrixView`, and `matrixView` is skipped by the later `$t:`
 * pass because the rest of it is endpoint data. Resolving before projecting is
 * what lets an authored token reach the drawing resolved without opening that
 * skip.
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
  const matrixView: MatrixView =
    url === undefined
      ? { kind: 'empty', degraded: [] }
      : envelope === undefined
        ? { kind: 'unavailable' }
        : projectMatrix(envelope, {
            ...(component as unknown as Parameters<typeof projectMatrix>[1]),
            ...(system?.nodesKey === undefined ? {} : { nodesKey: system.nodesKey }),
            ...(system?.edgesKey === undefined ? {} : { edgesKey: system.edgesKey }),
          })
  return { ...(rest as Component), matrixView } as Component
}

/** Walk one node, attaching the drawing to any matrix at or below it. */
const mapNode = (
  node: unknown,
  envelopes: Envelopes,
  localize: ((component: Component) => Component) | undefined
): unknown => {
  if (Array.isArray(node)) {
    const mapped = node.map((child) => mapNode(child, envelopes, localize))
    return mapped.every((child, index) => child === node[index]) ? node : mapped
  }
  if (isMatrix(node)) return attachView(node as Component, envelopes, localize)
  if (typeof node !== 'object' || node === null) return node
  const { children } = node as { readonly children?: unknown }
  if (children === undefined) return node
  const mapped = mapNode(children, envelopes, localize)
  return mapped === children ? node : { ...(node as Record<string, unknown>), children: mapped }
}

/**
 * Resolve every `matrix` on a page.
 *
 * Returns the SAME page when nothing matched, so a page with no matrix — which
 * is nearly every page — pays one walk and no read at all.
 *
 * @param page - The page whose matrices to resolve
 * @param fetchSystemRecord - Server-side envelope reader, borrowing the caller's identity
 * @param localize - Resolves a component's authored `$t:` tokens against the page's
 *   active language. Supplied by the caller rather than derived here so this module
 *   stays ignorant of i18n; absent (a page with no dictionary) the component is
 *   projected exactly as authored.
 */
export async function resolveMatrixGraphs(
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
