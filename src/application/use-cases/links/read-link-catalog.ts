/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reading the links catalog: the merged list, and one slug resolved across it.
 *
 * Filtering, state derivation and pagination all run over the UNION of
 * `app.links[]` and `system.links` (see `catalog.ts`), in that order and once.
 * The ordering is not incidental:
 *
 *  - the static filters (`q`, `tag`, `source`, `include_archived`) run FIRST,
 *    because they need no click count and every candidate they drop is a click
 *    count nobody has to pay for;
 *  - states are then resolved for EVERY surviving candidate rather than for the
 *    page, because `total` and the `state` filter are both defined over the
 *    whole result set and a page-local resolution would make them disagree with
 *    each other;
 *  - the cursor is applied LAST, so `total` reports the size of the filtered
 *    catalog rather than of the remainder after the cursor.
 *
 * The programs declare `LinkRepository` / `AnalyticsRepository` and nothing
 * else: no live database handle, no HTTP context. Mapping a result onto a wire
 * contract is the caller's job.
 */

/* eslint-disable unicorn/no-null -- `nextCursor` is a nullable contract field: `null` is the wire value, and `undefined` would drop the key from the JSON entirely. */

import { Effect } from 'effect'
import { LinkRepository } from '@/application/ports/repositories/links/link-repository'
import { buildCatalog, dbEntry, configEntry, primaryDestination } from './catalog'
import { configSlugs, declaredLink } from './config-slugs'
import { resolveEntryState } from './link-state'
import type { CatalogEntry, CatalogState } from './catalog'
import type { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import type {
  LinkDbError,
  LinkSource,
} from '@/application/ports/repositories/links/link-repository'
import type { App } from '@/domain/models/app'

/** The catalog query, already parsed out of whatever transport carried it. */
export interface LinkCatalogQuery {
  readonly cursor: string | undefined
  readonly limit: number
  readonly q: string | undefined
  readonly tag: string | undefined
  readonly source: LinkSource | undefined
  readonly state: CatalogState | undefined
  readonly includeArchived: boolean
}

/** A catalog entry with its resolved operational state. */
export interface StatedLinkEntry {
  readonly entry: CatalogEntry
  readonly state: CatalogState
}

/** One page of the catalog. `total` counts the whole filtered set, not the page. */
export interface LinkCatalogPage {
  readonly items: readonly StatedLinkEntry[]
  readonly nextCursor: string | null
  readonly total: number
}

/** Opaque base64 cursor over the slug — the catalog's sort key. */
const encodeCursor = (slug: string): string => btoa(slug)

const decodeCursor = (cursor: string | undefined): string | undefined => {
  if (cursor === undefined) return undefined
  try {
    return atob(cursor)
  } catch {
    return undefined
  }
}

/** The filters a state has no bearing on — applied before any click is counted. */
const matchesStaticFilters = (
  entry: Readonly<CatalogEntry>,
  query: Readonly<LinkCatalogQuery>
): boolean => {
  if (!query.includeArchived && entry.archived) return false
  if (query.source !== undefined && entry.source !== query.source) return false
  if (query.tag !== undefined && !entry.tags.includes(query.tag)) return false
  if (query.q === undefined) return true

  const needle = query.q.toLowerCase()
  return [entry.slug, entry.title ?? '', primaryDestination(entry)].some((haystack) =>
    haystack.toLowerCase().includes(needle)
  )
}

/** Cut the filtered, stated catalog down to the requested page. */
const paginate = (
  stated: readonly StatedLinkEntry[],
  query: Readonly<LinkCatalogQuery>
): LinkCatalogPage => {
  const after = decodeCursor(query.cursor)
  const remaining = after === undefined ? stated : stated.filter((row) => row.entry.slug > after)
  const items = remaining.slice(0, query.limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor: remaining.length > items.length && last ? encodeCursor(last.entry.slug) : null,
    total: stated.length,
  }
}

/** The merged catalog, filtered, stated and paginated. */
export const listLinkCatalog = (input: {
  readonly app: App
  readonly query: LinkCatalogQuery
  readonly now: Date
}): Effect.Effect<LinkCatalogPage, LinkDbError, LinkRepository | AnalyticsRepository> =>
  Effect.gen(function* () {
    const { app, query, now } = input
    const repository = yield* LinkRepository
    const rows = yield* repository.list({
      appName: app.name,
      includeArchived: query.includeArchived,
    })

    const candidates = buildCatalog({ app, rows, claimedSlugs: configSlugs(app) }).filter((entry) =>
      matchesStaticFilters(entry, query)
    )

    const stated = yield* Effect.forEach(candidates, (entry) =>
      resolveEntryState(app.name, entry, now).pipe(Effect.map((state) => ({ entry, state })))
    )

    return paginate(
      query.state === undefined ? stated : stated.filter((row) => row.state === query.state),
      query
    )
  }).pipe(Effect.withSpan('links.list-catalog'))

/**
 * Resolve one slug across the union.
 *
 * Answers with the config entry when the file claims the slug (its overlay
 * folded in), the DB entry when a live row holds it, and `undefined` when
 * neither does.
 *
 * Spanned rather than un-exported: it is not a single-file helper —
 * `set-link-overlay.ts` reaches for it too — and it is one indexed read, which
 * is exactly the unit a trace of a slug lookup wants to show.
 */
export const resolveLinkEntry = (
  app: App,
  slug: string
): Effect.Effect<CatalogEntry | undefined, LinkDbError, LinkRepository> =>
  Effect.gen(function* () {
    const repository = yield* LinkRepository
    const declared = declaredLink(app, slug)
    if (declared !== undefined) {
      const overlay = yield* repository.findBySlug({
        appName: app.name,
        slug,
        source: 'config',
      })
      return configEntry(declared, overlay)
    }

    const row = yield* repository.findBySlug({ appName: app.name, slug, source: 'db' })
    return row === undefined ? undefined : dbEntry(row)
  }).pipe(Effect.withSpan('links.resolve-link-entry', { attributes: { slug } }))

/** One slug's catalog entry with its state, or `undefined` when no link holds it. */
export const readLinkEntry = (input: {
  readonly app: App
  readonly slug: string
  readonly now: Date
}): Effect.Effect<StatedLinkEntry | undefined, LinkDbError, LinkRepository | AnalyticsRepository> =>
  Effect.gen(function* () {
    const { app, slug, now } = input
    const entry = yield* resolveLinkEntry(app, slug)
    if (entry === undefined) return undefined
    const state = yield* resolveEntryState(app.name, entry, now)
    return { entry, state }
  }).pipe(Effect.withSpan('links.read-entry'))

/* eslint-enable unicorn/no-null */
