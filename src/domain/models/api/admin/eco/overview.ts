/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/eco/overview`.
 *
 * Operator-grade environmental footprint dashboard (RGESN-aligned). Surfaces
 * the resolved `ECO_*` posture, the AI provider mix by carbon class, the
 * top-3 storage consumers, the RGESN 78-criterion self-evaluation, and the
 * `X-Eco-Index` header telemetry — all computed locally (no third-party
 * SaaS).
 *
 * Source story: [internal ref]
 * Pattern: [internal ref]
 * Decision: [internal ref]
 */

import { z } from '@hono/zod-openapi'

/** Carbon class A–G (lowest → highest impact, EU energy-label polarity). */
export const carbonClassSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G'])

/** EcoIndex letter grade A–G (per EcoIndex methodology). */
export const ecoIndexGradeSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G'])

/**
 * `ecoIndexHeader` panel — telemetry harvested by the `X-Eco-Index`
 * middleware. `enabled` reflects `ECO_INDEX_HEADER`; `currentGrade` is the
 * most recent response's grade; `graded` is the cumulative count since boot;
 * `since` is the boot timestamp used as the counter epoch.
 */
export const ecoIndexHeaderPanelSchema = z.object({
  enabled: z
    .boolean()
    .describe(
      '`true` when `ECO_INDEX_HEADER=on` (default); `false` only when explicitly disabled.'
    ),
  currentGrade: ecoIndexGradeSchema.describe(
    "Letter grade of the most recently graded response. Defaults to 'A' when no responses have been graded yet."
  ),
  graded: z
    .number()
    .int()
    .nonnegative()
    .describe('Cumulative count of responses graded since boot.'),
  since: z
    .string()
    .datetime()
    .describe('ISO 8601 boot timestamp — the counter epoch for `graded`.'),
})

/**
 * `aiProviderMix` panel — declared precedence list, per-class request counts,
 * and the operator-imposed `ECO_AI_MAX_CARBON_CLASS` cap. Every grade A–G is
 * always keyed (with `0` when no requests routed to that class) so dashboard
 * renderers do not have to defensive-default.
 */
export const aiProviderMixPanelSchema = z.object({
  precedence: z
    .array(z.string())
    .describe(
      'Operator-declared comma-separated `ECO_AI_PROVIDER_PRECEDENCE` list, verbatim. Empty when the operator stuck with the keyword surface (`local-first`/`cloud-first`/`local-only`).'
    ),
  byCarbonClass: z
    .object({
      A: z.number().int().nonnegative(),
      B: z.number().int().nonnegative(),
      C: z.number().int().nonnegative(),
      D: z.number().int().nonnegative(),
      E: z.number().int().nonnegative(),
      F: z.number().int().nonnegative(),
      G: z.number().int().nonnegative(),
    })
    .describe(
      'Per-class request counts since boot. Always keyed with all seven classes so dashboard renderers can iterate without defensive defaults.'
    ),
  maxCarbonClass: carbonClassSchema.describe(
    'Operator-imposed upper bound on routable provider class (`ECO_AI_MAX_CARBON_CLASS`).'
  ),
})

/**
 * One row of the top-3 storage consumers table. `bytes` is non-negative;
 * `retentionDays` is `null` when no horizon is set (manual retention) and a
 * positive integer otherwise.
 */
export const topStorageConsumerSchema = z.object({
  type: z.enum(['table', 'bucket']),
  name: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  retentionDays: z.number().int().positive().nullable(),
})

/**
 * `rgesn` panel — 78-criterion self-evaluation with frugality / transparency
 * / durability axis breakdown. The invariants `passing ≤ total` and
 * `sum(byAxis) === passing` are asserted by the spec; the use case must
 * preserve them when computing per-axis counts.
 */
export const rgesnPanelSchema = z.object({
  passing: z
    .number()
    .int()
    .nonnegative()
    .describe('Number of RGESN criteria the platform currently passes.'),
  total: z
    .literal(78)
    .describe('Fixed RGESN référentiel size (78 criteria across the three axes).'),
  byAxis: z.object({
    frugality: z.number().int().nonnegative(),
    transparency: z.number().int().nonnegative(),
    durability: z.number().int().nonnegative(),
  }),
})

/**
 * Top-level response shape of `GET /api/admin/eco/overview`. Carries the six
 * operator-grade panels plus a `telemetrySource` discriminator the spec
 * uses to enforce the "no third-party SaaS" platform property.
 */
export const ecoOverviewResponseSchema = z
  .object({
    ecoMode: z
      .enum(['strict', 'balanced', 'lenient'])
      .describe('Resolved `ECO_MODE` posture (canonical taxonomy).'),
    activatedSubKnobs: z
      .array(
        z.enum(['ECO_LOW_DATA_DEFAULT', 'ECO_AI_MAX_CARBON_CLASS', 'ECO_RETENTION_PURGE_DAYS'])
      )
      .describe(
        'Sub-knobs activated by the resolved `ECO_MODE`. Empty for `balanced`/`lenient`; populated for `strict`.'
      ),
    ecoIndexHeader: ecoIndexHeaderPanelSchema,
    aiProviderMix: aiProviderMixPanelSchema,
    topStorageConsumers: z
      .array(topStorageConsumerSchema)
      .max(3)
      .describe('At most 3 entries, sorted by `bytes` descending.'),
    rgesn: rgesnPanelSchema,
    telemetrySource: z
      .literal('local')
      .describe('Always `"local"` — no third-party SaaS telemetry is consulted.'),
  })
  .openapi('EcoOverviewResponse')

/** @public */
export type EcoOverviewResponse = z.infer<typeof ecoOverviewResponseSchema>
