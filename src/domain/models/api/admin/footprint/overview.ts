/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/footprint/overview`.
 *
 * Operator-grade environmental footprint dashboard. Surfaces the resolved
 * `ECO_*` posture, the per-lever provenance, the resolved AI routing, the
 * top-3 storage consumers, the `X-Eco-Index` header telemetry, the page-cache
 * outcome counters, and this process's own CPU/memory usage — all computed
 * locally (no third-party SaaS).
 *
 * The panels split into two kinds, and the console keeps them visually apart
 * for the same reason the contract documents them apart: `ecoIndexHeader`,
 * `pageCache`, `runtime`, `topStorageConsumers` and `database` are MEASURED by
 * this binary, while `ecoMode`, `lowDataMode` and `levers` are DECLARED by
 * this operator. A declared value describes how the instance is configured,
 * never what it emitted.
 *
 * **Two panels were retired, for the same reason twice: the dashboard was
 * reporting numbers nothing computed.**
 *
 * - `rgesn` reported `passing` out of a literal `total: 78` from ten
 *   evaluators, three of which were the literal `true`. It is NOT replaced:
 *   the denominator was right (78 is the real 2024 référentiel size) but the
 *   numerator was invented, and an RGESN result is a product-level fact —
 *   identical on every install of a given version — so it belongs in published
 *   documentation, not in a per-instance telemetry surface that implies it was
 *   measured HERE.
 * - `aiProviderMix.byCarbonClass` was always all-zeros: no code path anywhere
 *   incremented it. It is replaced by {@link aiProviderMixPanelSchema}'s
 *   `routing`, which carries three facts the binary genuinely computes and
 *   acts on.
 *
 * Source story: [internal ref]
 * Pattern: [internal ref]
 * Decision: [internal ref]
 */

import { z } from '@hono/zod-openapi'
import { SUPPORTED_AI_PROVIDERS } from '@/domain/models/env/ai/ai-providers'

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
  currentGrade: ecoIndexGradeSchema
    .nullable()
    .describe(
      'Letter grade of the most recently graded response, or `null` when nothing has been graded yet. NULLABLE on purpose: this field used to default to `A`, so a freshly booted instance advertised a top grade alongside `graded: 0` — a score before any measurement, which ADR-013 D6 forbids. There is no honest letter for "not measured".'
    ),
  graded: z
    .number()
    .int()
    .nonnegative()
    .describe('Cumulative count of responses graded since boot.'),
  since: z
    .string()
    .datetime()
    .describe(
      'ISO 8601 boot timestamp — the counter epoch for `graded`. Shared with `pageCache.since`: both read one process-wide epoch, so the two panels can never report rates over different intervals.'
    ),
  histogram: z
    .record(ecoIndexGradeSchema, z.number().int().nonnegative())
    .describe(
      'Responses per letter grade over the same interval as `graded`. A single `currentGrade` says nothing about the distribution behind it — an instance that served one heavy page among a thousand light ones reads identically to one that serves heavy pages always, unless the spread is published.'
    ),
  meanBytes: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe(
      'Mean `Content-Length` across graded responses, or `null` when nothing has been graded. Published because it is the ONLY quantity the grades are computed from: the grader reads `Content-Length` and nothing else — not DOM size, not request count, not the other inputs the EcoIndex.fr methodology uses. Naming the raw number stops the letters from implying a richer model.'
    ),
})

/**
 * `pageCache` panel — how the static page-output cache actually performed.
 *
 * Genuinely measured, unlike the declared levers in `levers`: every field here
 * is a count this process took or an occupancy it can read back. `hitRate` and
 * the byte figures are the pair that make the cache legible — a high hit rate
 * against a cache sitting at its budget ceiling means the budget is the next
 * thing to raise, and neither number says that alone.
 */
export const pageCachePanelSchema = z.object({
  enabled: z
    .boolean()
    .describe('`ECO_PAGE_CACHE` posture. When `false` every render reports `bypass`.'),
  hits: z.number().int().nonnegative().describe('Responses served from the cache since boot.'),
  misses: z
    .number()
    .int()
    .nonnegative()
    .describe('Cacheable responses rendered then stored since boot.'),
  bypasses: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Responses the cache was never eligible to serve — dynamic paths, authenticated or preview renders, or a cache turned off.'
    ),
  hitRate: z
    .number()
    .min(0)
    .max(1)
    .nullable()
    .describe(
      '`hits / (hits + misses)`, or `null` when no cacheable render has happened yet. Bypasses are EXCLUDED from the denominator: a bypassed render was never offered to the cache, so counting it as a miss would report a failing cache that was in fact never consulted.'
    ),
  entries: z.number().int().nonnegative().describe('Entries currently held.'),
  bytes: z.number().int().nonnegative().describe('Total UTF-8 bytes of HTML currently held.'),
  budgetBytes: z
    .number()
    .int()
    .nonnegative()
    .describe('The live `ECO_PAGE_CACHE_MAX_MB` ceiling, in bytes.'),
  evictions: z
    .number()
    .int()
    .nonnegative()
    .describe('Entries dropped to stay inside the budget, since boot.'),
  refusals: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Renders refused admission for exceeding the entire budget on their own, since boot. Distinct from an eviction: nothing was displaced, and a non-zero count means the budget is smaller than a single page.'
    ),
  since: z
    .string()
    .datetime()
    .describe('ISO 8601 boot timestamp — the shared counter epoch (see `ecoIndexHeader.since`).'),
})

/**
 * `runtime` panel — what this process itself consumed.
 *
 * Deliberately reported as the raw INPUTS a carbon model would need, and not
 * converted into gCO2eq. CPU-seconds to watts needs a TDP and a utilisation
 * model the binary cannot know on a shared vCPU, and the moment a
 * `gramsCO2eq` field exists it becomes the figure everyone quotes regardless
 * of how it was derived — the failure mode [internal ref] D6 names.
 */
export const runtimeFootprintPanelSchema = z.object({
  cpuSeconds: z
    .number()
    .nonnegative()
    .describe('User + system CPU seconds consumed by this process since it started.'),
  rssBytes: z
    .number()
    .int()
    .nonnegative()
    .describe('Resident set size in bytes at the moment the request was served.'),
  uptimeSeconds: z
    .number()
    .nonnegative()
    .describe(
      'Wall-clock seconds since process start. Published because it is what makes the other two readable: 40 CPU-seconds over ten minutes and over ten days describe entirely different instances.'
    ),
})

/**
 * `aiProviderMix` panel — the AI routing decision actually in force.
 *
 * Replaces the retired `byCarbonClass` counter, which reported all-zeros
 * forever because nothing incremented it and the "static carbon-class table"
 * its doc-comment cited did not exist. These three fields are the outcome of
 * `resolveAiEcoRouting`, so the panel can only be right or wrong — never
 * merely decorative.
 *
 * `resolvedProvider` is the load-bearing one: under `local-first` with a
 * configured-but-unreachable Ollama it names the CLOUD fallback, a value no
 * echo of `precedence` can produce.
 */
export const aiProviderMixPanelSchema = z.object({
  routing: z
    .object({
      precedence: z
        .enum(['local-first', 'cloud-first', 'local-only'])
        .describe('Active `ECO_AI_PROVIDER_PRECEDENCE` value.'),
      resolvedProvider: z
        .enum(SUPPORTED_AI_PROVIDERS)
        .optional()
        .describe(
          'Provider AI calls are ACTUALLY routed to, or absent when AI is disabled. May differ from what `precedence` alone implies.'
        ),
      ollamaReachable: z
        .boolean()
        .describe(
          'Result of the local-provider probe that decided the routing. `false` when no Ollama endpoint is configured, or when the configured one did not answer.'
        ),
    })
    .describe('Resolved AI routing — precedence, the provider in force, and the probe behind it.'),
})

/**
 * One row of the `levers` panel: an `ECO_*` env var, the value actually in
 * force, and which input decided it.
 *
 * `source` reuses the same three-way discriminator as `lowDataMode`, so the
 * two panels read alike.
 */
export const ecoLeverSchema = z.object({
  name: z.string().min(1).describe('Env var name of the lever, verbatim.'),
  effective: z
    .union([z.string(), z.number()])
    .describe('The value actually in force for this process right now.'),
  source: z
    .enum(['explicit', 'eco-mode', 'default'])
    .describe(
      "Which input decided `effective`: the operator's own recognised value (`explicit`), the `ECO_MODE` master posture deciding on their behalf (`eco-mode`), or the platform fallback (`default`)."
    ),
})

/**
 * `lowDataMode` panel — the low-data posture the binary will ACTUALLY apply,
 * plus the input that decided it.
 *
 * Replaces the retired `activatedSubKnobs` field, which listed
 * `ECO_LOW_DATA_DEFAULT` as "activated by `ECO_MODE=strict`" while no
 * request-path code read `ECO_MODE` at all — the dashboard certified a lever
 * that moved nothing. A field naming the RESOLVED value and its source can
 * only be right or wrong, never merely decorative.
 */
export const lowDataModePanelSchema = z.object({
  effective: z
    .enum(['on', 'off', 'respect-client'])
    .describe('Low-data posture actually in force for incoming page requests.'),
  source: z
    .enum(['explicit', 'eco-mode', 'default'])
    .describe(
      'Which input decided `effective`: a recognised `ECO_LOW_DATA_DEFAULT` (`explicit`), `ECO_MODE=strict` (`eco-mode`), or the conservative fallback (`default`).'
    ),
})

/**
 * Where a storage row's byte count came from.
 *
 * [internal ref] D6 Verification #4 requires the footprint surface to CITE its
 * measurement source: a byte count with no stated origin is indistinguishable
 * from a fabricated one — which is precisely what this panel used to ship (a
 * hardcoded `bytes: 0` on every table row).
 *
 * `'unavailable'` is a first-class outcome, not an error: a SQLite build
 * without the `dbstat` virtual table genuinely cannot size a table, and saying
 * so is the honest answer.
 */
const storageMeasurementSchema = z.enum([
  'pg_total_relation_size',
  'sqlite_dbstat',
  'storage_adapter',
  'unavailable',
])

/** @public Consumed by the application layer to type storage-panel rows. */
export type StorageMeasurementSource = z.infer<typeof storageMeasurementSchema>

/**
 * One row of the top-3 storage consumers table.
 *
 * `bytes` is NULLABLE, and the two falsy-looking values mean different things:
 * `0` is "measured, and the thing is empty"; `null` is "not measured". The two
 * fields are strictly coupled — `bytes === null` if and only if
 * `measurement === 'unavailable'` — and that coupling is what makes `0`
 * legible rather than ambiguous.
 */
export const topStorageConsumerSchema = z.object({
  type: z.enum(['table', 'bucket']),
  name: z.string().min(1),
  bytes: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe(
      'Measured bytes. `0` means measured-and-empty; `null` means the sizing probe was unavailable (and `measurement` is then `unavailable`).'
    ),
  measurement: storageMeasurementSchema.describe(
    "Where this row's byte count came from. A `table` row can only cite a database sizing source or `unavailable` — never `storage_adapter`, which cannot see a table."
  ),
})

/**
 * `database` panel — the whole-database size, reported on its own.
 *
 * Kept OUTSIDE `topStorageConsumers` on purpose: attributing a database-wide
 * total to a table row is the same class of lie as a fabricated per-table byte
 * count. `scope` states what the figure covers so it can never be read as a
 * per-relation number.
 */
export const databaseFootprintPanelSchema = z.object({
  totalBytes: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Whole-database size in bytes (`pg_database_size` on PostgreSQL; page count × page size on SQLite).'
    ),
  scope: z
    .literal('database')
    .describe('Always `"database"` — this figure covers no single table.'),
})

/**
 * Top-level response shape of `GET /api/admin/footprint/overview`. Carries the
 * operator-grade panels plus a `telemetrySource` discriminator the spec uses
 * to enforce the "no third-party SaaS" platform property.
 */
export const footprintOverviewResponseSchema = z
  .object({
    ecoMode: z
      .enum(['strict', 'balanced', 'lenient'])
      .describe('Resolved `ECO_MODE` posture (canonical taxonomy).'),
    lowDataMode: lowDataModePanelSchema,
    ecoIndexHeader: ecoIndexHeaderPanelSchema,
    aiProviderMix: aiProviderMixPanelSchema,
    levers: z
      .array(ecoLeverSchema)
      .describe(
        'One row per `ECO_*` lever an operator can pull, with its effective value and provenance. The list is exhaustive and hand-written: two levers have no parser module in `src/domain/models/env/eco/`, so a panel generated by enumerating that directory ships six plausible-looking rows and silently drops the other two.'
      ),
    pageCache: pageCachePanelSchema,
    runtime: runtimeFootprintPanelSchema,
    topStorageConsumers: z
      .array(topStorageConsumerSchema)
      .max(3)
      .describe(
        'At most 3 entries, sorted by `bytes` descending with UNMEASURED rows (`bytes: null`) last. The ordering is null-aware rather than null-coerced: treating `null` as `0` would interleave an unmeasured row among the genuinely-empty ones.'
      ),
    database: databaseFootprintPanelSchema,
    telemetrySource: z
      .literal('local')
      .describe('Always `"local"` — no third-party SaaS telemetry is consulted.'),
  })
  .openapi('FootprintOverviewResponse')

/** @public */
export type FootprintOverviewResponse = z.infer<typeof footprintOverviewResponseSchema>
