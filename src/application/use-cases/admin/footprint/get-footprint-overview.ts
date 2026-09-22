/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Build the footprint-overview response from local telemetry (env snapshot +
 * in-memory tracker state + storage totals). Pure: callers thread env vars,
 * tracker snapshot, and storage rows in so the use case stays trivially
 * testable.
 *
 * The use case never reaches out to any third-party SaaS — every datum it
 * returns is derived from the inputs the caller already collected. The
 * `telemetrySource: 'local'` field is a literal in the response and is
 * cross-checked by the spec via a network-spy assertion on the request
 * surface.
 *
 * @see plan §10 (locked 2026-05-09) — overview shape contract
 * @see src/domain/models/api/admin/audit-log/action-catalog.ts — if an
 *      audit-emitting handler is ever wired in here, it must FIRST register its
 *      action in that catalog (no `footprint.*` action exists today, so an emit
 *      would be dropped with a warning). Per the catalog's rule, a readback
 *      targeting the footprint overview takes the singular `footprint`. (This previously cited a
 *      non-existent "audit-log story §305" — see the catalog's historical note.)
 */

import { resolveAiEcoRouting } from '@/domain/models/process-env/ai/ai-eco-routing'
import { parseEcoIndexHeader } from '@/domain/models/process-env/eco/eco-index-header'
import { resolveEcoLevers } from '@/domain/models/process-env/eco/eco-levers'
import { resolveEffectiveLowDataDefault } from '@/domain/models/process-env/eco/eco-low-data-default'
import { parseEcoMode } from '@/domain/models/process-env/eco/eco-mode'
import type {
  FootprintOverviewResponse,
  StorageMeasurementSource,
} from '@/domain/models/api/admin/footprint/overview'
import type { EcoIndexTrackerSnapshot } from '@/infrastructure/process/eco-index-tracker'

/**
 * Storage consumer row sourced from the caller (table size from
 * `pg_total_relation_size` / `dbstat`, bucket totals from the storage adapter).
 * The use case takes a fully-formed list so it can stay pure — the caller
 * owns the database/adapter reads.
 *
 * `bytes` is nullable and carries a THREE-state contract: a number is a
 * measurement (including `0`, meaning measured-and-empty), and `null` means
 * nothing was measured. `measurement` names the origin, and the caller must
 * keep the two coupled — `bytes === null` exactly when
 * `measurement === 'unavailable'`.
 */
export interface StorageConsumerInput {
  readonly type: 'table' | 'bucket'
  readonly name: string
  readonly bytes: number | null
  readonly measurement: StorageMeasurementSource
}

/**
 * Pure inputs to the footprint-overview builder. Every datum is sourced by the
 * caller; the use case combines them into the response shape and applies the
 * panel-level invariants (top-3 null-aware sort, lever provenance, AI routing).
 */
export interface GetFootprintOverviewInputs {
  readonly env: Readonly<Record<string, string | undefined>>
  readonly tracker: EcoIndexTrackerSnapshot
  /** Pre-sorted-OR-unsorted; the use case sorts + slices to top-3. */
  readonly storageConsumers: readonly StorageConsumerInput[]
  /**
   * Whole-database size in bytes. Reported as its own scoped figure — never
   * folded into a consumer row, which would attribute a database-wide number
   * to a single relation.
   */
  readonly databaseTotalBytes: number
  /**
   * Result of the local-provider reachability probe.
   *
   * A PARAMETER, not something resolved here: `resolveAiEcoRouting` is pure
   * and the probe is a network round trip, so the caller owns it — and, since
   * this endpoint is `no-store` and reloaded by hand, the caller is expected
   * to feed in a REUSED value rather than a fresh probe per request.
   */
  readonly ollamaReachable: boolean
  /**
   * Page-cache occupancy and since-boot outcome counters, read by the caller
   * from the cache service's process-global state.
   */
  readonly pageCache: FootprintOverviewResponse['pageCache']
  /**
   * This process's CPU / memory / uptime figures at the moment the request was
   * served. A parameter for the same reason the tracker snapshot is: reading
   * them here would make the use case impure and untestable.
   */
  readonly runtime: FootprintOverviewResponse['runtime']
}

/**
 * Rank storage consumers for the top-3 panel: measured rows by byte count
 * descending, then every unmeasured row.
 *
 * The null handling is the point. Coercing `null` to `0` for the comparison
 * would interleave an unmeasured row among the genuinely-empty ones, which
 * re-erases the distinction the `bytes`/`measurement` pair exists to draw — a
 * row nobody sized would sit next to a bucket that was sized and found empty,
 * and the panel would once again invite the reader to treat the two as the
 * same fact.
 */
const rankStorageConsumers = (
  consumers: readonly StorageConsumerInput[]
): readonly StorageConsumerInput[] => {
  const measured = consumers.filter(
    (row): row is StorageConsumerInput & { readonly bytes: number } => row.bytes !== null
  )
  return [
    ...measured.toSorted((a, b) => b.bytes - a.bytes),
    ...consumers.filter((row) => row.bytes === null),
  ]
}

/**
 * Build the `ecoIndexHeader` panel from the tracker snapshot and the toggle.
 *
 * With the header OFF the middleware records nothing, so the tracker's last
 * grade is whatever the previous ON period left behind — a stale letter
 * presented as current. Nulling it here keeps the panel's one claim ("this is
 * the most recent response's grade") true in both postures.
 */
const buildEcoIndexPanel = (
  tracker: EcoIndexTrackerSnapshot,
  enabled: boolean
): FootprintOverviewResponse['ecoIndexHeader'] => ({
  enabled,
  // eslint-disable-next-line unicorn/no-null -- `null` is the contract's "nothing graded" sentinel
  currentGrade: enabled ? tracker.currentGrade : null,
  graded: tracker.graded,
  since: tracker.since,
  histogram: tracker.histogram,
  meanBytes: tracker.meanBytes,
})

/**
 * Build the footprint-overview response from local telemetry.
 *
 * Pure — every input is supplied by the caller. The function applies the
 * panel-level invariants and returns the canonical response shape; the
 * caller validates against `footprintOverviewResponseSchema` and emits the JSON.
 *
 * Returns the response cast as `FootprintOverviewResponse` (Zod-inferred,
 * structurally compatible with the readonly literal we construct). The
 * `Readonly` wrapper would mask the inferred shape — Zod schemas accept
 * mutable arrays at the boundary, and the caller only ever validates and
 * forwards.
 */
export const buildFootprintOverview = (
  inputs: GetFootprintOverviewInputs
): FootprintOverviewResponse => {
  const {
    env,
    tracker,
    storageConsumers,
    databaseTotalBytes,
    ollamaReachable,
    pageCache,
    runtime,
  } = inputs

  const ecoMode = parseEcoMode(env)
  // The SAME resolver the low-data middleware reads at request time, so the
  // dashboard reports the posture actually in force rather than a claim about
  // it. `activatedSubKnobs` drifted precisely because it had its own opinion.
  const lowDataMode = resolveEffectiveLowDataDefault(env)
  const indexHeaderMode = parseEcoIndexHeader(env)

  // The routing decision the AI call path will ACTUALLY take. Only the three
  // decision-bearing fields are surfaced: `configured` merely echoes
  // `AI_PROVIDER` back, and `fallbackReason` is prose. Picking explicitly also
  // keeps the panel's shape pinned to the contract rather than to whatever
  // `AiEcoRouting` happens to carry.
  const routing = resolveAiEcoRouting(env, ollamaReachable)

  // Top-3 storage consumers — null-aware ranking (measured desc, unmeasured
  // last), sliced to 3. Each row carries the provenance of its own number.
  const topStorageConsumers = rankStorageConsumers(storageConsumers)
    .slice(0, 3)
    .map((row) => ({
      type: row.type,
      name: row.name,
      bytes: row.bytes,
      measurement: row.measurement,
    }))

  return {
    ecoMode,
    lowDataMode: { effective: lowDataMode.effective, source: lowDataMode.source },
    ecoIndexHeader: buildEcoIndexPanel(tracker, indexHeaderMode === 'on'),
    pageCache,
    runtime,
    aiProviderMix: {
      routing: {
        precedence: routing.precedence,
        resolvedProvider: routing.resolvedProvider,
        ollamaReachable: routing.ollamaReachable,
      },
    },
    // Every lever, including the two with no parser module in `env/eco/`. The
    // list is hand-written in the domain resolver — see its doc comment for
    // why it must never be generated from the directory.
    levers: resolveEcoLevers(env).map((entry) => ({
      name: entry.name,
      effective: entry.effective,
      source: entry.source,
    })),
    topStorageConsumers,
    database: { totalBytes: databaseTotalBytes, scope: 'database' },
    telemetrySource: 'local',
  }
}
