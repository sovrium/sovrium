/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { applyBaselineGuard, type AiComputeKind } from '@/domain/services/ai-compute/baseline'
import { fieldToRequestConfig } from '@/domain/services/ai-compute/build-request'
import { AiLive } from '@/infrastructure/ai/layer'
import { upsertAiComputeStatus } from '@/infrastructure/database/ai-compute-status-repository'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { logDebug } from '@/infrastructure/logging/logger'
import { refineAiComputeField, type RefineAiComputeFieldInput } from './refine-field'
import type { App, Table } from '@/domain/models/app'
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

type AiComputeField = Extract<Fields[number], { readonly type: AiComputeKind }>

const isAiComputeField = (field: Fields[number]): field is AiComputeField =>
  AI_COMPUTE_KINDS.has(field.type)

const firesFor = (field: { readonly computeOn?: string }, op: 'insert' | 'update'): boolean => {
  const computeOn = field.computeOn ?? 'create'
  if (computeOn === 'manual') return false
  if (op === 'insert') return computeOn === 'create' || computeOn === 'both'
  return computeOn === 'update' || computeOn === 'both'
}

const buildSource = (
  sourceFields: readonly string[],
  fields: Readonly<Record<string, unknown>>
): string =>
  sourceFields
    .map((sf) => {
      const value = fields[sf]
      return value === null || value === undefined ? '' : String(value)
    })
    .join(' ')

const sourceChanged = (
  sourceFields: readonly string[],
  incoming: Readonly<Record<string, unknown>>,
  old: Readonly<Record<string, unknown>> | undefined
): boolean => sourceFields.some((sf) => sf in incoming && incoming[sf] !== old?.[sf])

interface FieldDecision {
  readonly field: AiComputeField
  readonly preserved: boolean
}

const resolveFieldDecisions = (params: {
  readonly table: Table
  readonly op: 'insert' | 'update'
  readonly incoming: Readonly<Record<string, unknown>>
  readonly old: Readonly<Record<string, unknown>> | undefined
}): readonly FieldDecision[] => {
  const { table, op, incoming, old } = params
  return (table.fields ?? [])
    .filter(isAiComputeField)
    .filter((f) => firesFor(f, op))
    .map((field) => {
      const decision = applyBaselineGuard({
        op,
        kind: field.type,
        incoming: incoming[field.name],
        old: old?.[field.name],
        sourceChanged: sourceChanged(field.sourceFields, incoming, old),
      })
      return { field, preserved: decision.kind === 'preserve' }
    })
}

const buildRefinementInput = (params: {
  readonly app: App
  readonly table: Table
  readonly recordId: string | number
  readonly record: Readonly<Record<string, unknown>>
  readonly field: AiComputeField
}): RefineAiComputeFieldInput => {
  const { app, table, recordId, record, field } = params
  return {
    appId: app.name,
    tableName: table.name,
    recordId: String(recordId),
    fieldName: field.name,
    kind: field.type,
    source: buildSource(field.sourceFields, record),
    baselineValue: record[field.name],
    config: fieldToRequestConfig(field.type, field as Readonly<Record<string, unknown>>),
  }
}

const runDetached = (program: Effect.Effect<unknown, never, never>, label: string): void => {
  void Effect.runPromise(program).catch((error: unknown) => {
    logDebug(`[ai-compute] ${label} failed: ${String(error)}`)
  })
}

export const signalAiComputeWritePhase = (params: {
  readonly app: App
  readonly tableName: string
  readonly op: 'insert' | 'update'
  readonly recordId: string | number
  readonly incoming: Readonly<Record<string, unknown>>
  readonly old?: Readonly<Record<string, unknown>> | undefined
  readonly record: Readonly<Record<string, unknown>>
}): void => {
  const { app, tableName, op, recordId, incoming, old, record } = params
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return
  const decisions = resolveFieldDecisions({ table, op, incoming, old })
  if (decisions.length === 0) return

  const overrides = decisions.filter((d) => d.preserved)
  const computed = decisions.filter((d) => !d.preserved)

  if (overrides.length > 0) {
    const program = Effect.forEach(
      overrides,
      (d) =>
        Effect.promise(() =>
          upsertAiComputeStatus(
            { appId: app.name, tableName, recordId: String(recordId), fieldName: d.field.name },
            'skipped'
          )
        ),
      { discard: true }
    )
    runDetached(program, 'override-skipped')
  }

  if (isSqliteRuntime() && computed.length > 0) {
    const inputs = computed.map((d) =>
      buildRefinementInput({ app, table, recordId, record, field: d.field })
    )
    const program = Effect.forEach(inputs, (input) => refineAiComputeField(input), {
      discard: true,
    }).pipe(Effect.provide(AiLive), Effect.either)
    runDetached(program, 'sqlite-refinement-enqueue')
  }
}
