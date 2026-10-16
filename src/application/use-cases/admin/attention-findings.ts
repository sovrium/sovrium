/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The attention report's FINDINGS item — the structural findings the
 * Organisation page reports, counted for the Welcome page.
 *
 * ─── ONE DERIVATION, READ TWICE ─────────────────────────────────────────────
 *
 * The figure is contractually EQUAL to `GET /api/admin/organisation/graph`'s
 * `findingsCount`, so it is not re-derived here: this block runs the very
 * program that route runs, {@link buildAdminOrganisationGraph}, and reads its
 * counts. A second derivation would be a second place a finding is defined,
 * and the first rule it learned would make the two figures disagree.
 *
 * ─── NO ORGANISATION PAGE, NO FINDING ───────────────────────────────────────
 *
 * The console serves its Organisation page only to an app declaring `auth`
 * AND something that stores data (that page's `requires`). Elsewhere there is
 * no page for the item to lead to, so the block answers the zero cell WITHOUT
 * reading anything — not a degraded zero, a true one: there is no access graph
 * to have findings about.
 *
 * ─── S4: COUNTS, NEVER SUBJECTS ─────────────────────────────────────────────
 *
 * The detail names severities and how many of each ("1 critical · 2
 * warnings") — never a finding's message, subject or node. The page that names
 * them is the Organisation page, behind its own read.
 *
 * @see src/application/use-cases/admin/organisation-graph-findings.ts (the derivation)
 * @see src/domain/models/api/admin/overview/attention.ts (the wire contract)
 */

import { Effect } from 'effect'
import {
  buildAdminOrganisationGraph,
  type AdminOrganisationGraphServices,
} from '@/application/use-cases/admin/organisation-graph'
import { isCapabilityMet } from '@/domain/models/app/pages/page-requires'
import { DETAIL_SEPARATOR, EMPTY_CELL, measured, unread } from './attention-cells'
import type { Cell, Sourced } from './attention-cells'
import type { AdminOrganisationGraphResponse } from '@/domain/models/api/admin/organisation/graph'
import type { App } from '@/domain/models/app'
import type { PageCapability } from '@/domain/models/app/pages/requires'

/**
 * What the console's Organisation page requires of the app it is served for.
 *
 * Mirrors that page's `requires` (`src/admin/config/pages/data/organisation.ts`):
 * the item must exist exactly where the page it leads to does.
 */
const ORGANISATION_PAGE_REQUIRES: readonly PageCapability[] = ['auth', 'data']

/** Whether the console serves an Organisation page for this app. */
export const servesOrganisationPage = (app: App): boolean =>
  ORGANISATION_PAGE_REQUIRES.every((capability) => isCapabilityMet(app, capability))

/**
 * The graph sources the findings are derived FROM. The third source, the
 * automation pause ledger, colours lanes and finds nothing, so its outage
 * leaves the count measured.
 */
const FINDINGS_SOURCES: ReadonlySet<string> = new Set(['principals', 'team-membership'])

/** The name this cell puts in the report's `degraded` when it was not measured. */
export const FINDINGS_SOURCE = 'organisation findings'

/** The severities, gravest first, with the singular and plural of each. */
const SEVERITY_WORDS = [
  { key: 'critical', one: 'critical', many: 'critical' },
  { key: 'warning', one: 'warning', many: 'warnings' },
  { key: 'notice', one: 'notice', many: 'notices' },
] as const

type FindingsCounts = Pick<AdminOrganisationGraphResponse, 'findingsCount' | 'findingsBySeverity'>

/**
 * Render the findings as a cell: the count, and the severities PRESENT, gravest
 * first — `"1 critical · 2 warnings"`. A severity at zero is not named, so a
 * zero count renders `''` and the pairing contract holds by construction.
 */
export const findingsCell = (counts: Readonly<FindingsCounts>): Cell => ({
  count: counts.findingsCount,
  detail: SEVERITY_WORDS.map(({ key, one, many }) => ({
    n: counts.findingsBySeverity[key],
    one,
    many,
  }))
    .filter(({ n }) => n > 0)
    .map(({ n, one, many }) => `${n} ${n === 1 ? one : many}`)
    .join(DETAIL_SEPARATOR),
})

/**
 * `findingsCount` — the Organisation read's findings, as an attention cell.
 *
 * A graph whose principal or membership read degraded reports a PARTIAL
 * findings list (a lost membership read hides the single-bridge finding
 * outright), so that count is not passed off as measured: the cell falls back
 * to the zero and names itself, exactly as every other unread cell does.
 */
export const findingsBlock = (
  app: App
): Effect.Effect<Sourced<Cell>, never, AdminOrganisationGraphServices> => {
  const read: Effect.Effect<
    Sourced<Cell>,
    never,
    AdminOrganisationGraphServices
  > = servesOrganisationPage(app)
    ? Effect.map(buildAdminOrganisationGraph(app), (graph) =>
        graph.degraded.some((source) => FINDINGS_SOURCES.has(source))
          ? unread(EMPTY_CELL, FINDINGS_SOURCE)
          : measured(findingsCell(graph))
      )
    : Effect.succeed(measured(EMPTY_CELL))
  return read.pipe(Effect.withSpan('admin.attention-findings'))
}
