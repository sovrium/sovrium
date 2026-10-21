/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { slugifyTitle } from '@/domain/kernel/identity/slug'
import { pageNodeIdOf } from '@/domain/models/app/pages/node-identity'
import { migratedLiteral, migratedPageLiteralTokens } from './migrated-literal-tokens-service'
import { MIGRATION_PAGE_FACTS } from './migrated-page-mapping'
import {
  allMigratedNodes,
  migratedPageStructure,
  pageCollisionRefusal,
  withMigratedKeys,
} from './migrated-page-tree-service'
import {
  readRetoolClassicExport,
  type RetoolApp,
  type RetoolExportEntry,
  type RetoolScreen,
} from './retool-classic-export-read'
import { draftSiblings, type Draft, type RetoolPageNode } from './retool-classic-page-drafts'
import type { MigratedPagesReport } from './migrated-pages-report'

/**
 * The Retool classic page migration: a ToolScript ZIP, already inflated, to
 * NEW Sovrium pages and the report's `pages` section ([internal ref] A14, pages part).
 *
 * - Each `Screen` becomes a page, in the order `main.rsx` includes them. Its
 *   name is the kebab-case of its id (`addInventory` is `add-inventory`) and
 *   its path its `urlSlug`, else `/<name>`. The app's `rootScreen` is NOT moved
 *   to `/`: the root of the operator's app is theirs to give.
 * - The shared header frame is written in place at the top of every page, as a
 *   migration creates no template; what it holds that the table does not (its
 *   `Navigation`) is reported on each page.
 * - Components become kit nodes through `RETOOL_CLASSIC_PAGE_MAPPINGS` only
 *   (`retool-classic-page-drafts.ts`); every node arrives unbound, every
 *   Retool expression is listed verbatim, and a form stays an unbound `form`
 *   node: it posts to a query, so no extracted form is made for it.
 * - A screen's queries are data, not page: each is named for the data
 *   migration, with the SQL file its body is kept in.
 * - A page whose name or path the config already holds is refused, never
 *   renamed and never merged.
 * - Every node gets a fresh kebab-case `key`, `<type>-<n>` in page order: the
 *   same export always gives the same pages and the same section.
 *
 * Pure: entries in, plan out. Nothing is fetched, nothing is run, no clock.
 */

/** What the config already holds, read before a migration: a migration never overwrites it. */
export interface RetoolMigrationTarget {
  readonly pages?: readonly { readonly name: string; readonly path: string }[] | undefined
}

/** One page a migration writes. */
export interface RetoolPageEntry {
  readonly name: string
  readonly path: string
  readonly meta: { readonly title: string }
  readonly components: readonly RetoolPageNode[]
}

/** The converter's answer: the new pages and the report's section, or why the export is refused. */
export type RetoolClassicPagesResult =
  | {
      readonly ok: true
      readonly pages: readonly RetoolPageEntry[]
      readonly report: MigratedPagesReport
    }
  | { readonly ok: false; readonly reason: string }

type Report = MigratedPagesReport

interface Placed {
  readonly nodes: readonly RetoolPageNode[]
  readonly unbound: Report['unbound']
  readonly unmapped: Report['unmapped']
}

const NOTHING_PLACED: Placed = { nodes: [], unbound: [], unmapped: [] }

const mergePlaced = (a: Placed, b: Placed): Placed => ({
  nodes: [...a.nodes, ...b.nodes],
  unbound: [...a.unbound, ...b.unbound],
  unmapped: [...a.unmapped, ...b.unmapped],
})

/**
 * Drafts given their place under `parent` (a pointer to the array they fill):
 * each node its index, each ghost the index the next node takes there.
 */
const place = (drafts: readonly Draft[], parent: string, page: string): Placed =>
  drafts.reduce<Placed>((acc, draft) => {
    const pointer = `${parent}/${acc.nodes.length}`
    const at = pageNodeIdOf(page, pointer)
    if (draft.kind === 'ghost') {
      const reason =
        draft.missing === undefined
          ? { reason: 'not-in-table' as const }
          : { reason: 'required-value-missing' as const, missing: draft.missing }
      return {
        ...acc,
        unmapped: [...acc.unmapped, { page, at, component: draft.component, ...reason }],
      }
    }
    const inner = place(draft.children, `${pointer}/children`, page)
    const node: RetoolPageNode = draft.holdsChildren
      ? { ...draft.node, children: inner.nodes }
      : draft.node
    const unbound = draft.bindings.map((binding) => ({ page, node: at, ...binding }))
    return mergePlaced(acc, {
      nodes: [node],
      unbound: [...unbound, ...inner.unbound],
      unmapped: inner.unmapped,
    })
  }, NOTHING_PLACED)

/** A screen id in kebab-case: `addInventory` is `add-inventory`. */
export const retoolPageNameOf = (id: string): string =>
  slugifyTitle(
    id
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/[_.]+/g, ' ')
  ) || 'screen'

/** A `urlSlug` as a page path: one leading slash, its segments slugged. */
const pathOfSlug = (slug: string): string | undefined => {
  const segments = slug
    .split('/')
    .map((segment) => slugifyTitle(segment))
    .filter(Boolean)
  return segments.length === 0 ? undefined : `/${segments.join('/')}`
}

interface ScreenPlace {
  readonly screen: RetoolScreen
  readonly name: string
  readonly path: string
}

/** Each screen's name and path, a repeated name suffixed in the order `main.rsx` holds them. */
const placeScreens = (screens: readonly RetoolScreen[]): readonly ScreenPlace[] =>
  screens.reduce<readonly ScreenPlace[]>((acc, screen) => {
    const base = retoolPageNameOf(screen.id)
    const names = new Set(acc.map((entry) => entry.name))
    const candidates = [
      base,
      ...Array.from({ length: screens.length }, (_, i) => `${base}-${i + 2}`),
    ]
    const name = candidates.find((candidate) => !names.has(candidate)) ?? base
    const path =
      (screen.urlSlug === undefined ? undefined : pathOfSlug(screen.urlSlug)) ?? `/${name}`
    return [...acc, { screen, name, path }]
  }, [])

interface PageResult extends Placed {
  readonly entry: RetoolPageEntry
  readonly file: string
  readonly leftBehind: Report['leftBehind']
}

const convertScreen = (placed: ScreenPlace, app: RetoolApp): PageResult => {
  const header = draftSiblings(app.header, { positions: app.headerPositions })
  const body = draftSiblings(placed.screen.components, { positions: placed.screen.positions })
  const converted = place([...header, ...body], '/components', placed.name)
  const components = withMigratedKeys(converted.nodes)
  return {
    ...converted,
    entry: {
      name: placed.name,
      path: placed.path,
      meta: { title: migratedLiteral(placed.screen.title ?? placed.screen.id) },
      components,
    },
    file: placed.screen.file,
    leftBehind: placed.screen.queries.map((query) => ({
      page: placed.name,
      what: `Query: ${query.id} (${query.type})`,
      ...(query.file === undefined ? {} : { file: query.file }),
    })),
  }
}

/**
 * Plan the migration of a ToolScript ZIP's screens into an app whose config
 * already holds `target`.
 */
export const planRetoolClassicPages = (
  entries: readonly RetoolExportEntry[],
  target: RetoolMigrationTarget = {}
): RetoolClassicPagesResult => {
  const read = readRetoolClassicExport(entries)
  if (!read.ok) return read
  const results = placeScreens(read.app.screens).map((placed) => convertScreen(placed, read.app))
  const refused = results.flatMap((result) => {
    const refusal = pageCollisionRefusal(result.entry, target.pages ?? [])
    return refusal === undefined ? [] : [refusal]
  })
  const refusedNames = new Set(refused.map((refusal) => refusal.page))
  const written = results.filter((result) => !refusedNames.has(result.entry.name))
  const report: MigratedPagesReport = {
    status: 'converted',
    source: 'retool-classic',
    facts: MIGRATION_PAGE_FACTS['retool-classic'],
    created: written.map((result) => ({
      name: result.entry.name,
      path: result.entry.path,
      file: result.file,
      nodes: allMigratedNodes(result.entry.components).length,
    })),
    refused,
    unbound: written.flatMap((result) => result.unbound),
    unmapped: written.flatMap((result) => result.unmapped),
    offScale: [],
    forms: [],
    literalTokens: written.flatMap((result) =>
      migratedPageLiteralTokens(result.entry.name, result.entry.components, [
        { pointer: '/meta', value: result.entry.meta },
      ])
    ),
    leftBehind: written.flatMap((result) => result.leftBehind),
    structure: written.map((result) =>
      migratedPageStructure(result.entry.name, result.entry.components)
    ),
    templates: { created: false },
  }
  return { ok: true, pages: written.map((result) => result.entry), report }
}
