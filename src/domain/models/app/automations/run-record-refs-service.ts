/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which records a run read, by id — the index erasure scrubs runs by.
 *
 * Erasing an account must reach every run that read one of the person's
 * records, a record naming her, or a record removed with hers. A search of the
 * run history for her id would miss a run that read her record without copying
 * the id, so each run records, as it finishes, the records it read: a record
 * trigger's captured record and the rows it links, each record step's records
 * and the rows they link, an agent's tool calls, a script's calls, and the
 * records the run a synchronous call started read. Ids only, never a value.
 *
 * What cannot be told precisely is recorded as the whole table (`'*'`), and so
 * is every table of a run past {@link MAX_RUN_REFS} refs: erasure then scrubs
 * the run whatever record of that table it removes.
 */

import { classifyStepRead, flattenActions, recordedReadsOf } from './step-read-service'
import { hasTriggerOfType, recordedTrigger, triggerNamedOrFirst } from './trigger-entries-service'
import type { StepAction, StepRead } from './step-read-service'
import type { App } from '@/domain/models/app'

/** One record a run read: its table and its id, or `'*'` for the whole table. */
export interface RecordRef {
  readonly table: string
  readonly record: string
}

/** The record id standing for every record of a table. */
export const WHOLE_TABLE = '*'

/** Most refs a run keeps before it counts as reading every record of its tables. */
export const MAX_RUN_REFS = 1000

/** A step as it finished: its action's name, its status, its output and what it recorded reading. */
export interface FinishedStep {
  readonly name: string
  readonly status: string
  readonly output?: unknown
  readonly reads?: unknown
}

/** What a run read: record refs, and the runs its synchronous calls started. */
export interface RunReads {
  readonly refs: readonly RecordRef[]
  readonly calledRuns: readonly string[]
}

type AppTable = NonNullable<App['tables']>[number]

const tableNamed = (app: App, name: string): AppTable | undefined =>
  app.tables?.find((candidate) => candidate.name === name)

/** The id a value names: an id itself, or an object carrying one. */
const idOf = (value: unknown): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value !== null && typeof value === 'object') {
    const { id } = value as { readonly id?: unknown }
    return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined
  }
  return undefined
}

/** Every id a relationship value names, one or many. */
const idsOf = (value: unknown): readonly string[] =>
  (Array.isArray(value) ? value : [value]).flatMap((item) => {
    const id = idOf(item)
    return id === undefined ? [] : [id]
  })

/** The record and the rows its relationships link, as refs. */
const recordAndLinked = (
  app: App,
  table: string,
  record: Readonly<Record<string, unknown>>
): readonly RecordRef[] => {
  const own = idOf(record['id'])
  const fields = (record['fields'] ?? record) as Readonly<Record<string, unknown>>
  const linked = (tableNamed(app, table)?.fields ?? [])
    .filter((field) => field.type === 'relationship')
    .flatMap((field) => {
      const related = (field as { readonly relatedTable?: unknown }).relatedTable
      if (typeof related !== 'string') return []
      return idsOf(fields[field.name] ?? record[field.name]).map((id) => ({
        table: related,
        record: id,
      }))
    })
  return [...(own === undefined ? [] : [{ table, record: own }]), ...linked]
}

/** The refs of a record step's output: the records it holds, else the one it names, else its table. */
const outputRefs = (
  app: App,
  read: Extract<StepRead, { readonly kind: 'records' }>,
  output: unknown
): readonly RecordRef[] => {
  if (read.records !== undefined) {
    return read.records.flatMap((record) => recordAndLinked(app, read.table, record))
  }
  const single = (output ?? {}) as { readonly record?: unknown; readonly id?: unknown }
  const id = idOf(single.record) ?? idOf(single.id)
  return [{ table: read.table, record: id ?? WHOLE_TABLE }]
}

/** What one read named: refs, and the runs it started. */
const readsOf = (app: App, read: StepRead, output: unknown): RunReads => {
  switch (read.kind) {
    case 'records':
      return { refs: outputRefs(app, read, output), calledRuns: [] }
    case 'table':
      return { refs: [{ table: read.table, record: WHOLE_TABLE }], calledRuns: [] }
    case 'agent':
      // An agent whose tool calls were not recorded may have read any table.
      return {
        refs: (app.tables ?? []).map((table) => ({ table: table.name, record: WHOLE_TABLE })),
        calledRuns: [],
      }
    case 'run':
      return readsOf(app, read.reads, undefined)
    case 'nested':
      return mergeReads(read.reads.map((nested) => readsOf(app, nested, undefined)))
    case 'calledRun':
      return { refs: [], calledRuns: [read.runId] }
    case 'none':
    case 'unknown':
      return { refs: [], calledRuns: [] }
  }
}

const mergeReads = (all: readonly RunReads[]): RunReads => ({
  refs: all.flatMap((reads) => reads.refs),
  calledRuns: all.flatMap((reads) => reads.calledRuns),
})

/** One step's reads: what it recorded as it ran, else what its declaration and output say. */
const stepReads = (app: App, action: StepAction | undefined, step: FinishedStep): RunReads => {
  if (step.status === 'skipped') return { refs: [], calledRuns: [] }
  const recorded = recordedReadsOf(step.reads)
  if (recorded !== undefined) {
    return mergeReads(recorded.map((read) => readsOf(app, read, undefined)))
  }
  if (action === undefined) return { refs: [], calledRuns: [] }
  return readsOf(app, classifyStepRead(app, action, step.output), step.output)
}

/** The records a run's trigger captured, with the rows they link. */
const capturedRefs = (
  app: App,
  triggerTable: unknown,
  triggerData: unknown
): readonly RecordRef[] => {
  if (typeof triggerTable !== 'string' || triggerData === null || typeof triggerData !== 'object') {
    return []
  }
  const data = triggerData as Readonly<Record<string, unknown>>
  return ['record', 'previousRecord'].flatMap((key) => {
    const record = data[key]
    return record !== null && typeof record === 'object' && !Array.isArray(record)
      ? recordAndLinked(app, triggerTable, record as Readonly<Record<string, unknown>>)
      : []
  })
}

/** Distinct refs, every table of which collapses to `'*'` past {@link MAX_RUN_REFS}. */
const capped = (refs: readonly RecordRef[]): readonly RecordRef[] => {
  const distinct = [
    ...new Map(refs.map((ref) => [`${ref.table}\u0000${ref.record}`, ref])).values(),
  ]
  if (distinct.length <= MAX_RUN_REFS) return distinct
  return [...new Set(distinct.map((ref) => ref.table))].map((table) => ({
    table,
    record: WHOLE_TABLE,
  }))
}

/**
 * The records a run read — its trigger's captured record and each step's —
 * and the runs its synchronous calls started, whose own refs it inherits.
 */
export const runRecordRefs = (input: {
  readonly app: App
  readonly automationName: string
  /** The name of the trigger entry that started the run; omitted, its first entry. */
  readonly triggerName?: string | null
  readonly triggerData: unknown
  readonly steps: readonly FinishedStep[]
}): RunReads => {
  const { app } = input
  const automation = app.automations?.find((candidate) => candidate.name === input.automationName)
  const actions = flattenActions((automation?.actions ?? []) as ReadonlyArray<StepAction>)
  const trigger =
    automation === undefined
      ? undefined
      : (triggerNamedOrFirst(automation, input.triggerName) as { readonly table?: unknown })
  const steps = mergeReads(
    input.steps.map((step) =>
      stepReads(
        app,
        actions.find((action) => action.name === step.name),
        step
      )
    )
  )
  return {
    refs: capped([...capturedRefs(app, trigger?.table, input.triggerData), ...steps.refs]),
    calledRuns: [...new Set(steps.calledRuns)],
  }
}

/**
 * True when a run recorded before runs kept refs read stored records, so the
 * upgrade scrubs it: its trigger captured a record, another run handed it its
 * trigger data (a call, a failure handler), or a step read the app's data — or
 * its automation, or a step's action, is no longer declared and cannot be told.
 */
export const readStoredRecords = (input: {
  readonly app: App
  readonly automationName: string
  readonly triggerData: unknown
  readonly steps: readonly FinishedStep[]
}): boolean => {
  const automation = input.app.automations?.find(
    (candidate) => candidate.name === input.automationName
  )
  if (automation === undefined) return true
  // Recorded before names: with several entries, which one captured what cannot be told.
  if (recordedTrigger(automation, undefined) === undefined) return true
  // A run another run may have fed: any call or failure entry.
  if (hasTriggerOfType(automation, 'automation-call')) return true
  if (hasTriggerOfType(automation, 'automation-failure')) return true
  const { refs } = runRecordRefs(input)
  if (refs.length > 0) return true
  const actions = flattenActions((automation.actions ?? []) as ReadonlyArray<StepAction>)
  return input.steps.some((step) => {
    if (step.status === 'skipped') return false
    const action = actions.find((candidate) => candidate.name === step.name)
    if (action === undefined) return true
    const read = classifyStepRead(input.app, action, step.output)
    return read.kind !== 'none'
  })
}
