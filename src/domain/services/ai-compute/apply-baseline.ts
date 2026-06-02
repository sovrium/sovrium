/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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
} from './baseline'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

const AI_COMPUTE_KINDS: ReadonlySet<string> = new Set<AiComputeKind>([
  'ai-summary',
  'ai-categorize',
  'ai-tag',
  'ai-translate',
  'ai-extract',
  'ai-sentiment',
  'ai-generate',
])

const isAiComputeField = (
  field: Fields[number]
): field is Extract<Fields[number], { readonly type: AiComputeKind }> =>
  AI_COMPUTE_KINDS.has(field.type)

const firesFor = (field: { readonly computeOn?: string }, op: 'insert' | 'update'): boolean => {
  const computeOn = field.computeOn ?? 'create'
  if (computeOn === 'manual') return false
  if (op === 'insert') return computeOn === 'create' || computeOn === 'both'
  return computeOn === 'update' || computeOn === 'both'
}

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

const resolveSourceValues = (
  sourceFields: readonly string[],
  incoming: Readonly<Record<string, unknown>>,
  old: Readonly<Record<string, unknown>> | undefined
): Record<string, unknown> =>
  Object.fromEntries(sourceFields.map((sf) => [sf, sf in incoming ? incoming[sf] : old?.[sf]]))

const STRING_KINDS: ReadonlySet<AiComputeKind> = new Set([
  'ai-summary',
  'ai-translate',
  'ai-generate',
])

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

const computeFieldBaseline = (
  field: Extract<Fields[number], { readonly type: AiComputeKind }>,
  source: string,
  sourceValues: Readonly<Record<string, unknown>>
): unknown => {
  if (STRING_KINDS.has(field.type) && isSourceEmpty(source)) return null
  const compute = BASELINE_DISPATCH[field.type] as (
    field: Extract<Fields[number], { readonly type: AiComputeKind }>,
    source: string,
    sourceValues: Readonly<Record<string, unknown>>
  ) => unknown
  return compute(field, source, sourceValues)
}

const sourceChanged = (
  sourceFields: readonly string[],
  incoming: Readonly<Record<string, unknown>>,
  old: Readonly<Record<string, unknown>> | undefined
): boolean => sourceFields.some((sf) => sf in incoming && incoming[sf] !== old?.[sf])

export const applyAiComputeBaseline = (params: {
  readonly table: Table
  readonly op: 'insert' | 'update'
  readonly incoming: Readonly<Record<string, unknown>>
  readonly old?: Readonly<Record<string, unknown>>
}): Record<string, unknown> => {
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
