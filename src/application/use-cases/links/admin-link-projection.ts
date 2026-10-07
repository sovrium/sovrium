/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The admin console's view of one catalog entry: the list row and the detail
 * body `GET /api/admin/links[/:slug]` answer, and the body the link mutations
 * answer after a write.
 *
 * One projection for every caller — the read registry (HTTP and MCP alike) and
 * the mutation routes reading a row back — so the list, the detail and a
 * just-written link cannot describe the same entry three ways.
 *
 * What is absent is deliberate: no `password` and no hash of one (the catalog
 * entry does not carry it), and no click metrics (those are read from the
 * analytics endpoints, the one aggregation path over the click store).
 */

import { linkTargets } from '@/domain/models/app/links'
import { primaryDestination, toIsoOrNull, type CatalogEntry, type CatalogState } from './catalog'
import type { AdminLink } from '@/domain/models/api/admin/links'

/** The fixed, non-configurable base path a link is served at. */
const LINK_PREFIX = '/l/'

/**
 * Project a catalog entry onto the list-row contract.
 *
 * `lastModifiedBy` is always null: `system.links` records who CREATED a row
 * (`created_by`) but not who last edited it, and inventing an actor from the
 * creator would answer the operator's "who last touched this?" with a
 * confidently wrong name.
 */
export const toAdminLink = (entry: Readonly<CatalogEntry>, state: CatalogState): AdminLink => ({
  slug: entry.slug,
  shortUrl: `${LINK_PREFIX}${entry.slug}`,
  destination: primaryDestination(entry),
  title: entry.title,
  tags: [...entry.tags],
  source: entry.source,
  state,
  validFrom: toIsoOrNull(entry.link.lifecycle?.validFrom),
  validUntil: toIsoOrNull(entry.link.lifecycle?.validUntil),
  maxClicks: entry.link.lifecycle?.maxClicks ?? null,
  _admin: { lastModifiedBy: null, deletedAt: entry.deletedAt },
})

/** Project an entry onto the detail contract. */
export const toAdminLinkDetail = (entry: Readonly<CatalogEntry>, state: CatalogState) => ({
  ...toAdminLink(entry, state),
  targets: linkTargets(entry.link).map((target, index) => ({
    index,
    to: target.to,
    // An absent weight is 1, not 0: treating it as 0 would drop a declared
    // destination out of the rotation while it still reads as participating.
    weight: Math.max(1, Math.trunc(target.weight ?? 1)),
  })),
  utm: entry.utm,
  notes: entry.notes,
  expiredTo: entry.link.lifecycle?.expiredTo ?? null,
  qrUrl: `${LINK_PREFIX}${entry.slug}.svg`,
})
