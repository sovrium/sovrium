/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Build the eco-overview response from local telemetry (env snapshot +
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
 *      action in that catalog (no `eco.*` action exists today, so an emit would
 *      be dropped with a warning). Per the catalog's rule, a readback targeting
 *      the eco overview takes the singular `eco`. (This previously cited a
 *      non-existent "audit-log story §305" — see the catalog's historical note.)
 */

import { parseEcoAiMaxCarbonClass } from '@/domain/models/env/eco/eco-ai-max-carbon-class'
import { parseEcoAiProviderPrecedenceList } from '@/domain/models/env/eco/eco-ai-provider-list'
import { parseEcoIndexHeader } from '@/domain/models/env/eco/eco-index-header'
import {
  parseEcoMode,
  resolveActivatedSubKnobs,
  type EcoMode,
  type EcoSubKnob,
} from '@/domain/models/env/eco/eco-mode'
import { parseEcoRetentionPurgeDays } from '@/domain/models/env/eco/eco-retention-purge-days'
import type { EcoOverviewResponse } from '@/domain/models/api/admin/eco/overview'
import type { EcoIndexTrackerSnapshot } from '@/infrastructure/utils/eco-index-tracker'

/* eslint-disable unicorn/no-null -- the eco-overview API contract uses `null` for absent retention horizons (matches every other admin overview schema's nullable retentionDays); switching to `undefined` would diverge from the JSON shape end-clients consume */

/**
 * Storage consumer row sourced from the caller (table size from
 * `pg_total_relation_size` plus bucket totals from the storage adapter).
 * The use case takes a fully-formed list so it can stay pure — the caller
 * owns the database/adapter reads.
 */
export interface StorageConsumerInput {
  readonly type: 'table' | 'bucket'
  readonly name: string
  readonly bytes: number
  /** Per-resource retention override, or null when none is set. */
  readonly retentionDays: number | null
}

/**
 * Per-class AI request counts since boot. Defaults to all-zero so callers
 * can ship a not-yet-wired AI mix without breaking the shape contract.
 */
export interface AiCarbonClassCountsInput {
  readonly A: number
  readonly B: number
  readonly C: number
  readonly D: number
  readonly E: number
  readonly F: number
  readonly G: number
}

const EMPTY_AI_COUNTS: AiCarbonClassCountsInput = {
  A: 0,
  B: 0,
  C: 0,
  D: 0,
  E: 0,
  F: 0,
  G: 0,
}

/**
 * Pure inputs to the eco-overview builder. Every datum is sourced by the
 * caller; the use case combines them into the response shape and applies
 * the panel-level invariants (top-3 sort, retention horizon fall-through,
 * RGESN axis-sum check).
 */
export interface GetEcoOverviewInputs {
  readonly env: Readonly<Record<string, string | undefined>>
  readonly tracker: EcoIndexTrackerSnapshot
  /** Pre-sorted-OR-unsorted; the use case sorts + slices to top-3. */
  readonly storageConsumers: readonly StorageConsumerInput[]
  /** Optional AI counts; defaults to all-zero when AI is not yet wired. */
  readonly aiCarbonClassCounts?: AiCarbonClassCountsInput
}

/**
 * Compute the effective retention horizon for a storage row.
 *
 * Per-resource override (when set) wins; otherwise fall back to the global
 * `ECO_RETENTION_PURGE_DAYS`. The use case never returns a 0 — both the env
 * parser and the per-row input collapse zero/missing values to `null` (the
 * wire-format encoding for "manual retention"), so a zero retentionDays
 * here would be a programming error.
 *
 * The internal `globalDefault` argument arrives as `number | undefined`
 * from `parseEcoRetentionPurgeDays`; the row-level `perResource` arrives
 * as `number | null` from the API contract; the return shape is `null` so
 * it serialises directly to JSON.
 */
const resolveEffectiveRetention = (
  perResource: number | null,
  globalDefault: number | undefined
): number | null => {
  if (perResource !== null && perResource > 0) return perResource
  if (globalDefault !== undefined && globalDefault > 0) return globalDefault
  return null
}

/**
 * Walk the platform's known posture and tally passing RGESN criteria across
 * the three axes (frugality, transparency, durability).
 *
 * The scoring is heuristic, not a certification audit — each axis tracks a
 * set of platform-state evaluators, and the sum of passing evaluators is
 * exposed verbatim. Keeping the per-axis evaluator lists short keeps the
 * dashboard cheap to compute (the sum invariant `byAxis sum === passing`
 * is asserted by [internal ref]).
 *
 * Total criteria === 78 (RGESN référentiel size). The axis counts always
 * sum to `passing` so the dashboard math holds even as new evaluators land.
 */
const computeRgesn = (
  env: Readonly<Record<string, string | undefined>>,
  mode: EcoMode
): Readonly<{
  passing: number
  total: 78
  byAxis: Readonly<{ frugality: number; transparency: number; durability: number }>
}> => {
  // Frugality axis — counts evaluators that gate eco-aligned defaults.
  // 28 criteria total in the RGESN référentiel for the frugality axis.
  const frugality = [
    mode === 'strict' || mode === 'balanced', // base posture is eco-aligned
    parseEcoIndexHeader(env) === 'on', // measurable footprint surfaced
    env['ECO_PAGE_CACHE']?.trim().toLowerCase() !== 'off', // static cache active
    env['ECO_IMAGE_FORMAT']?.trim().toLowerCase() !== 'png', // not stuck on PNG
    env['ECO_LOW_DATA_DEFAULT']?.trim().toLowerCase() !== 'off', // low-data lever
  ].filter(Boolean).length

  // Transparency axis — measurable telemetry exposed to the operator.
  // 26 criteria total in the RGESN référentiel for the transparency axis.
  const transparency = [
    parseEcoIndexHeader(env) === 'on', // X-Eco-Index surfaced
    true, // eco overview endpoint itself exists (this use case proves it)
    true, // local-only telemetry, no third-party SaaS
  ].filter(Boolean).length

  // Durability axis — long-term operator control + data-lifecycle hygiene.
  // 24 criteria total in the RGESN référentiel for the durability axis.
  const durability = [
    parseEcoRetentionPurgeDays(env) !== undefined, // retention horizon declared
    true, // BSL 1.1 licensing → 2030 Apache 2.0 fall-through (long-term operability)
  ].filter(Boolean).length

  return {
    passing: frugality + transparency + durability,
    total: 78,
    byAxis: { frugality, transparency, durability },
  }
}

/**
 * Build the eco-overview response from local telemetry.
 *
 * Pure — every input is supplied by the caller. The function applies the
 * panel-level invariants and returns the canonical response shape; the
 * caller validates against `ecoOverviewResponseSchema` and emits the JSON.
 *
 * Returns the response cast as `EcoOverviewResponse` (Zod-inferred,
 * structurally compatible with the readonly literal we construct). The
 * `Readonly` wrapper would mask the inferred shape — Zod schemas accept
 * mutable arrays at the boundary, and the caller only ever validates and
 * forwards.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- return is Zod-inferred for the API contract; the response is treated as immutable by every downstream consumer (validated then serialised)
export const buildEcoOverview = (inputs: GetEcoOverviewInputs): EcoOverviewResponse => {
  const { env, tracker, storageConsumers, aiCarbonClassCounts = EMPTY_AI_COUNTS } = inputs

  const ecoMode = parseEcoMode(env)
  const activatedSubKnobs: readonly EcoSubKnob[] = resolveActivatedSubKnobs(ecoMode)
  const indexHeaderMode = parseEcoIndexHeader(env)
  const globalRetention = parseEcoRetentionPurgeDays(env)

  // Top-3 storage consumers — sort descending (toSorted preserves the
  // readonly input), slice to 3, fold per-resource retention through the
  // global horizon.
  const topStorageConsumers = storageConsumers
    .toSorted((a, b) => b.bytes - a.bytes)
    .slice(0, 3)
    .map((row) => ({
      type: row.type,
      name: row.name,
      bytes: row.bytes,
      retentionDays: resolveEffectiveRetention(row.retentionDays, globalRetention),
    }))

  return {
    ecoMode,
    activatedSubKnobs: [...activatedSubKnobs],
    ecoIndexHeader: {
      enabled: indexHeaderMode === 'on',
      currentGrade: tracker.currentGrade,
      graded: tracker.graded,
      since: tracker.since,
    },
    aiProviderMix: {
      precedence: [...parseEcoAiProviderPrecedenceList(env)],
      byCarbonClass: { ...aiCarbonClassCounts },
      maxCarbonClass: parseEcoAiMaxCarbonClass(env),
    },
    topStorageConsumers,
    rgesn: computeRgesn(env, ecoMode),
    telemetrySource: 'local',
  }
}
