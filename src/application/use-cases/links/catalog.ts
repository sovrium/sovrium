/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The links catalog: one view over two populations.
 *
 * Two populations answer at `/l/{slug}` — entries in `app.links[]`, resolved
 * from memory and rows NOWHERE, and rows in `system.links` minted at runtime.
 * Anything that lists, filters, counts or paginates links must do it over the
 * MERGED set, because filtering only the SQL half produces an answer that is
 * right for the links an operator created and silently wrong for the ones they
 * deployed.
 *
 * A `system.links` row with `source: 'config'` is NOT a third population: it is
 * an overlay carrying `disabled_at` for a config-declared slug, folded into its
 * config entry rather than listed. A `db` row whose slug the config now claims
 * (`shadowed_at`) is skipped for the same reason — one slug, one row.
 *
 * Everything here is PURE. The union is a projection of config plus rows, so it
 * has no requirements of its own; the programs that read the rows and resolve
 * lifecycle state live in `read-link-catalog.ts` and `link-state.ts`.
 *
 * No `password` and no hash of one ([internal ref] D5): the port's `LinkRecord` does
 * not carry one, so nothing here could leak it if it tried.
 */

/* eslint-disable unicorn/no-null -- the admin links contracts are nullable throughout: `null` is the wire value the console renders against, and `undefined` would drop the key from the JSON entirely. */

import { linkTargets } from '@/domain/models/app/links'
import type {
  LinkRecord,
  LinkSource,
  LinkUtmRecord,
} from '@/application/ports/repositories/links/link-repository'
import type { App } from '@/domain/models/app'
import type { Link } from '@/domain/models/app/links'
import type { ResolvableLink } from '@/domain/models/app/links/link-resolver'

/**
 * The operational states the catalog reports.
 *
 * Five come from `resolveLinkState` — the same function the redirect handler
 * uses. The catalog adds exactly one the resolver does not know about:
 * `archived`, for a soft-deleted row.
 */
export type CatalogState =
  'active' | 'disabled' | 'scheduled' | 'expired' | 'exhausted' | 'archived'

/** The five campaign parameters, as the detail contract renders them. */
export interface UtmView {
  readonly source: string | null
  readonly medium: string | null
  readonly campaign: string | null
  readonly content: string | null
  readonly term: string | null
}

/**
 * One catalog row before it is projected onto a contract.
 *
 * `link` is the ONLY lifecycle source: `validFrom`, `maxClicks` and the rest are
 * read back off it rather than carried alongside, so the values a console
 * displays and the values `resolveLinkState` decided from cannot disagree.
 */
export interface CatalogEntry {
  readonly slug: string
  readonly source: LinkSource
  readonly link: ResolvableLink
  readonly title: string | null
  readonly tags: readonly string[]
  readonly notes: string | null
  readonly utm: UtmView | null
  readonly archived: boolean
  readonly deletedAt: string | null
}

/** Normalise any accepted datetime spelling to ISO 8601 UTC, or report absence. */
export const toIsoOrNull = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString()
}

/** `toIsoOrNull` in the shape `ResolvableLink.lifecycle` expects. */
const toIsoOrUndefined = (value: string | null | undefined): string | undefined =>
  toIsoOrNull(value) ?? undefined

/** Project a stored/declared utm block onto the contract's fixed five rows. */
const toUtmView = (utm: LinkUtmRecord | null | undefined): UtmView | null => {
  if (utm === null || utm === undefined) return null
  return {
    source: utm.source ?? null,
    medium: utm.medium ?? null,
    campaign: utm.campaign ?? null,
    content: utm.content ?? null,
    term: utm.term ?? null,
  }
}

/**
 * The lifecycle a config-declared link resolves against.
 *
 * The overlay may only SUBTRACT: `enabled` is the conjunction of what the file
 * says and what the console has not switched off.
 */
const configLifecycle = (link: Link, overlay: LinkRecord | undefined) => ({
  enabled: link.lifecycle?.enabled !== false && (overlay?.disabledAt ?? null) === null,
  validFrom: toIsoOrUndefined(link.lifecycle?.validFrom),
  validUntil: toIsoOrUndefined(link.lifecycle?.validUntil),
  maxClicks: link.lifecycle?.maxClicks,
  expiredTo: link.lifecycle?.expiredTo,
})

/** The resolvable definition a config-declared link contributes. */
const configResolvable = (link: Link, overlay: LinkRecord | undefined): ResolvableLink => ({
  slug: link.slug,
  ...(link.to === undefined ? {} : { to: link.to }),
  ...(link.targets === undefined ? {} : { targets: link.targets }),
  lifecycle: configLifecycle(link, overlay),
  ...(link.utm === undefined ? {} : { utm: link.utm }),
})

/** Fold a config-declared link and its optional overlay row into one entry. */
export const configEntry = (link: Link, overlay: LinkRecord | undefined): CatalogEntry => ({
  slug: link.slug,
  source: 'config',
  link: configResolvable(link, overlay),
  title: link.title ?? null,
  tags: link.tags === undefined ? [] : [...link.tags],
  notes: link.notes ?? null,
  utm: toUtmView(link.utm),
  archived: false,
  deletedAt: null,
})

/** Project a `source: 'db'` row into a catalog entry. */
export const dbEntry = (row: LinkRecord): CatalogEntry => ({
  slug: row.slug,
  source: 'db',
  link: {
    slug: row.slug,
    ...(row.destination === null ? {} : { to: row.destination }),
    ...(row.targets === null ? {} : { targets: row.targets }),
    lifecycle: {
      enabled: row.enabled && row.disabledAt === null,
      validFrom: toIsoOrUndefined(row.validFrom),
      validUntil: toIsoOrUndefined(row.validUntil),
      maxClicks: row.maxClicks ?? undefined,
      expiredTo: row.expiredTo ?? undefined,
    },
    ...(row.utm === null ? {} : { utm: row.utm }),
  },
  title: row.title,
  tags: row.tags,
  notes: row.notes,
  utm: toUtmView(row.utm),
  archived: row.deletedAt !== null || row.archivedAt !== null,
  deletedAt: row.deletedAt,
})

/**
 * Merge both populations into one catalog, ordered by slug.
 *
 * Slug ascending is the only TOTAL order available across the union: a config
 * entry has no `created_at` to sort against a DB row's, and an order that fell
 * back to "config first, then rows by recency" would make the cursor
 * non-monotonic the moment a link was minted mid-pagination.
 *
 * `claimedSlugs` is passed in rather than derived here so this module stays a
 * projection with no policy of its own — the reservation rule lives once, in
 * `config-slugs.ts`, and every caller asks it the same way.
 */
export const buildCatalog = (input: {
  readonly app: App
  readonly rows: readonly LinkRecord[]
  readonly claimedSlugs: ReadonlySet<string>
}): readonly CatalogEntry[] => {
  const { app, rows, claimedSlugs } = input
  const declared = app.links ?? []
  const overlays = new Map(rows.filter((row) => row.source === 'config').map((r) => [r.slug, r]))

  const fromConfig = declared.map((link) => configEntry(link, overlays.get(link.slug)))
  const fromDb = rows
    .filter((row) => row.source === 'db')
    // A shadowed row's slug now belongs to the file. Listing it too would show
    // one address twice, with two different destinations.
    .filter((row) => !claimedSlugs.has(row.slug))
    .map(dbEntry)

  return [...fromConfig, ...fromDb].toSorted((a, b) => a.slug.localeCompare(b.slug))
}

/** The destination a grid renders — the first of the link's candidates. */
export const primaryDestination = (entry: Readonly<CatalogEntry>): string =>
  linkTargets(entry.link)[0]?.to ?? ''

/* eslint-enable unicorn/no-null */
