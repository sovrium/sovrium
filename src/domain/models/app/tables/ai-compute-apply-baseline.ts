/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * In-process AI-compute baseline merge for the SQLite write path ([internal ref]
 * Phase 2, design §6).
 *
 * Postgres computes the deterministic baseline synchronously in a BEFORE
 * trigger. SQLite has no procedural language, so the create/update HTTP write
 * seams call {@link applyAiComputeBaseline} BEFORE dispatching the INSERT/UPDATE
 * — it computes the baseline for each AI-compute field in pure TS (via the
 * shared {@link computeAiSummaryBaseline} et al.) and merges it into the field
 * map, so the baseline lands in the SAME write (the "never empty after write"
 * invariant holds identically to Postgres).
 *
 * Pure function — no Effect, no I/O. The kind-specific transform + override
 * guard come from the shared `baseline` module, so SQLite and the PG trigger
 * generator share one source of truth.
 */

import {
  applyBaselineGuard,
  computeAiCategorizeBaseline,
  computeAiExtractBaseline,
  computeAiGenerateBaseline,
  computeAiSentimentBaseline,
  computeAiSummaryBaseline,
  computeAiTagBaseline,
  computeAiTranslateBaseline,
  isSourceEmpty,
  type AiComputeKind,
} from './ai-compute-baseline'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

/** The seven AI-compute field kinds. */
const AI_COMPUTE_KINDS: ReadonlySet<string> = new Set<AiComputeKind>([
  'ai-summary',
  'ai-categorize',
  'ai-tag',
  'ai-translate',
  'ai-extract',
  'ai-sentiment',
  'ai-generate',
])

/** Narrow a field to one of the AI-compute kinds. */
const isAiComputeField = (
  field: Fields[number]
): field is Extract<Fields[number], { readonly type: AiComputeKind }> =>
  AI_COMPUTE_KINDS.has(field.type)

/** Whether an AI-compute field fires for the given write operation. */
const firesFor = (field: { readonly computeOn?: string }, op: 'insert' | 'update'): boolean => {
  const computeOn = field.computeOn ?? 'create'
  if (computeOn === 'manual') return false
  if (op === 'insert') return computeOn === 'create' || computeOn === 'both'
  return computeOn === 'update' || computeOn === 'both'
}

/**
 * Concatenate the configured `sourceFields` into a single source string,
 * matching the PG `source_content` local: `COALESCE(field, '')` segments
 * joined by single spaces. Reads from `incoming` first, falling back to the
 * `old` record value (UPDATE only) so an unchanged source field still
 * contributes its stored value.
 */
const buildSourceContent = (
  sourceFields: readonly string[],
  incoming: Readonly<Record<string, unknown>>,
  old: Readonly<Record<string, unknown>> | undefined
): string =>
  sourceFields
    .map((sf) => {
      const value = sf in incoming ? incoming[sf] : old?.[sf]
      return value === null || value === undefined ? '' : String(value)
    })
    .join(' ')

/** Resolved source values map for ai-generate placeholder interpolation. */
const resolveSourceValues = (
  sourceFields: readonly string[],
  incoming: Readonly<Record<string, unknown>>,
  old: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(sourceFields.map((sf) => [sf, sf in incoming ? incoming[sf] : old?.[sf]]))

/** String-valued kinds NULL the column on empty source (PG `NEW.field = NULL`). */
const STRING_KINDS: ReadonlySet<AiComputeKind> = new Set([
  'ai-summary',
  'ai-translate',
  'ai-generate',
])

/**
 * Dispatch the kind-specific baseline transform (no empty-source handling —
 * the caller applies the string-kind NULL branch first). Each entry maps a
 * kind to the matching shared `computeAi*Baseline` call.
 */
const BASELINE_DISPATCH: {
  readonly [K in AiComputeKind]: (
    field: Extract<Fields[number], { readonly type: K }>,
    source: string,
    sourceValues: Readonly<Record<string, unknown>>
  ) => unknown
} = {
  'ai-summary': (field, source) => computeAiSummaryBaseline(source, { maxLength: field.maxLength }),
  'ai-translate': (_field, source) => computeAiTranslateBaseline(source),
  'ai-generate': (field, source, sourceValues) =>
    computeAiGenerateBaseline(field.prompt ?? '', field.sourceFields, sourceValues),
  'ai-categorize': (field, source) =>
    computeAiCategorizeBaseline(source, { categories: field.categories }),
  'ai-tag': (field, source) =>
    computeAiTagBaseline(source, { tags: field.tags, maxTags: field.maxTags }),
  'ai-sentiment': (_field, source) => computeAiSentimentBaseline(source),
  'ai-extract': (field, source) => computeAiExtractBaseline(source, { schema: field.schema }),
}

/**
 * Compute the baseline value for a single AI-compute field. Returns the value
 * to store (string / array / object / null).
 *
 * Empty-source handling matches the PG trigger's empty branch: the string
 * kinds (summary / translate / generate) NULL the column (handled upfront);
 * tag clears to `[]`; categorize / sentiment / extract already return their
 * own empty baseline (`null`) from the shared compute functions.
 */
const computeFieldBaseline = (
  field: Extract<Fields[number], { readonly type: AiComputeKind }>,
  source: string,
  sourceValues: Readonly<Record<string, unknown>>
): unknown => {
  // eslint-disable-next-line unicorn/no-null -- empty-source clears the column to SQL NULL
  if (STRING_KINDS.has(field.type) && isSourceEmpty(source)) return null
  const compute = BASELINE_DISPATCH[field.type] as (
    field: Extract<Fields[number], { readonly type: AiComputeKind }>,
    source: string,
    sourceValues: Readonly<Record<string, unknown>>
  ) => unknown
  return compute(field, source, sourceValues)
}

/**
 * Whether any configured source field changed value between `old` and the
 * incoming write (UPDATE only). Mirrors the PG `buildSourceChangedExpr`:
 * `NEW.sf IS DISTINCT FROM OLD.sf` for any source field present in the write.
 */
const sourceChanged = (
  sourceFields: readonly string[],
  incoming: Readonly<Record<string, unknown>>,
  old: Readonly<Record<string, unknown>> | undefined
): boolean => sourceFields.some((sf) => sf in incoming && incoming[sf] !== old?.[sf])

/**
 * Compute the AI-compute baseline merge for a write. Returns ONLY the fields
 * whose baseline should be (re)computed — caller merges this onto the incoming
 * field map. Fields the override guard chooses to `preserve` are omitted (the
 * incoming/stored value wins).
 *
 * When `ai-generate`/etc. has a non-empty interpolated baseline but the source
 * is empty, the kind's `computeAi*Baseline` already returns the empty value
 * (`null` / `[]`), which is merged so the column is explicitly cleared — the
 * SQLite analogue of the PG `NEW.field = NULL` empty-source branch.
 *
 * @param table    the table whose AI-compute fields are evaluated
 * @param op       the write operation (`insert` on create, `update` on PATCH)
 * @param incoming the user-supplied field map for this write
 * @param old      the previously-stored record (UPDATE only)
 */
export const applyAiComputeBaseline = (params: {
  readonly table: Table
  readonly op: 'insert' | 'update'
  readonly incoming: Readonly<Record<string, unknown>>
  readonly old?: Readonly<Record<string, unknown>>
}): Readonly<Record<string, unknown>> => {
  const { table, op, incoming, old } = params
  const aiFields = (table.fields ?? []).filter(isAiComputeField).filter((f) => firesFor(f, op))

  return aiFields.reduce<Record<string, unknown>>((merge, field) => {
    const decision = applyBaselineGuard({
      op,
      kind: field.type,
      incoming: incoming[field.name],
      old: old?.[field.name],
      sourceChanged: sourceChanged(field.sourceFields, incoming, old),
    })
    if (decision.kind === 'preserve') return merge

    const source = buildSourceContent(field.sourceFields, incoming, old)
    const sourceValues = resolveSourceValues(field.sourceFields, incoming, old)
    return { ...merge, [field.name]: computeFieldBaseline(field, source, sourceValues) }
  }, {})
}
