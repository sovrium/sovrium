/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether what a run read stays within what one reader may read — the
 * judgement behind every road a reader who does not read every run takes to a
 * run (`run-step-output-reach.ts`): its detail, its lists, and the requests it
 * asks her to sign.
 *
 * A step's output holds what that step read under the run's authority, not
 * hers, so a step is within her reach only when what it read does not exceed
 * what she may read through the records API:
 *
 *  - an `ai` `agent` step reads under its agent's declared role: every table
 *    that role may read must be one she may read too, with every column the
 *    agent reads and every row (no row-level rule narrowing her);
 *  - a `record` step reads its table: she must read every column and every
 *    related value its columns carry, and either every row — no row-level rule
 *    narrowing her on it or on a table a lookup of it reads through — or, for a
 *    step whose output holds the records it read, every one of them whole
 *    (`run-record-reach.ts`);
 *  - a loop or a branch reads what its nested actions read (a record step
 *    among them judged on its whole table);
 *  - a script reads what the actions it called read, each recorded at the
 *    sandbox's dispatch as it ran; a script recorded before that, or one that
 *    called an action no reach judges, is beyond her;
 *  - a synchronous call reads what the run it started actually read, step by
 *    step; one whose run was not recorded reads what the called automation's
 *    steps declare;
 *  - a step reading stored data no reach judges — a stored file, another
 *    run's state or digest — is beyond her (fail closed).
 *
 * A run's trigger data is within her reach when it carries no record its
 * trigger captured (a webhook's request, a form's answers), or every record it
 * captured whole. A run another run started — a call, a failure handler — is
 * judged by the run that fed it (its relay): that run's own trigger data and
 * every step it had run before handing it on, followed back through every run
 * that fed it, at most {@link RELAY_MAX_HOPS} runs and
 * {@link RELAY_MAX_RECORDS} records. Such a run recorded before relays were,
 * one fed by a run whose values were erased with an account, and the run data
 * of an automation the config no longer declares, are beyond her.
 */

import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import { buildSyntheticSession } from '@/application/use-cases/automations/build-guest-session'
import { callerReadScope } from '@/application/use-cases/tables/permissions/caller-read-authority'
import {
  isRelayedTriggerType,
  parseRelay,
  RELAY_MAX_HOPS,
  RELAY_MAX_RECORDS,
} from '@/domain/models/app/automations/run-relay-service'
import {
  classifyStepRead,
  flattenActions,
  readOfCalls,
  recordedReadsOf,
  type StepAction,
  type StepRead,
} from '@/domain/models/app/automations/step-read-service'
import { rowRuledTablesBehind } from '@/domain/models/app/tables/lookup-link-service'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import {
  readableColumns,
  readsColumns,
  readsTable,
  recordsReadWhole,
  refusedTo,
  type AppTable,
  type Reader,
} from './run-record-reach'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** A step as the judgement reads it. */
export interface JudgedStep {
  readonly name: string
  readonly status: string
  readonly output: unknown
  /** What the step recorded reading as it ran, raw (`recordedReadsOf`). */
  readonly reads?: unknown
}

/** A run as the judgement reads it. */
export interface JudgedRun {
  readonly automationName: string
  readonly triggerData?: unknown
  /** The run that handed this one its trigger data, raw (`parseRelay`). */
  readonly relay?: unknown
  /** When its values were erased with an account: it then judges nothing it fed. */
  readonly valuesErasedAt?: string | null
  readonly steps: ReadonlyArray<JudgedStep>
}

/** True when a run's values were erased with an account. */
const isErased = (run: JudgedRun): boolean =>
  run.valuesErasedAt !== undefined && run.valuesErasedAt !== null

/** Who is judged, and how far the judgement has followed runs into other runs. */
interface Judge {
  readonly c: Context
  readonly app: App
  readonly reader: Reader
  /** How many runs away from the run being read this judgement is. */
  readonly hops: number
}

/**
 * True when no row-level rule narrows the signed-in reader on `table`. A scope
 * that cannot be read counts as narrowing her (fail closed).
 */
const readsEveryRow = async (
  c: Context,
  app: App,
  table: AppTable,
  userId: string
): Promise<boolean> => {
  const scope = await runDomainPromise(
    c,
    callerReadScope(app, buildSyntheticSession(userId), table.name)
  ).catch(() => undefined)
  return scope !== undefined && scope.clause === undefined
}

/** Sequentially: each item may cost reads on the shared pool. */
const everyInTurn = <T>(
  items: ReadonlyArray<T>,
  judge: (item: T) => Promise<boolean>
): Promise<boolean> =>
  items.reduce<Promise<boolean>>(
    async (verdict, item) => (await verdict) && judge(item),
    Promise.resolve(true)
  )

/**
 * True when `reader` may read every row and every listed column of `table` —
 * and every related value those columns carry, and every row of every table
 * with a row-level rule a lookup among them reads through, at any hop
 * ({@link rowRuledTablesBehind}).
 */
const readsWhole = async (input: {
  readonly c: Context
  readonly app: App
  readonly table: AppTable
  readonly columns: ReadonlySet<string>
  readonly reader: Reader
}): Promise<boolean> => {
  const { c, app, table, columns, reader } = input
  if (!readsColumns(app, table, columns, reader)) return false
  const { userId } = reader
  if (userId === undefined) return false
  const behind = rowRuledTablesBehind(app, table.name, columns) as ReadonlyArray<AppTable>
  return everyInTurn([table, ...behind], (each) => readsEveryRow(c, app, each, userId))
}

/** The tables an agent declared with `role` reads, with the columns it reads in each. */
const agentReach = (
  app: App,
  role: string
): ReadonlyArray<{ readonly table: AppTable; readonly columns: ReadonlySet<string> }> => {
  const agent: Reader = { role, groups: [], accessRoles: [] }
  // A related value the agent may not read is not in what it read.
  return (app.tables ?? [])
    .filter((table) => readsTable(app, table, agent))
    .map((table) => {
      const refused = refusedTo(app, table, agent)
      const columns = [...readableColumns(app, table, agent)].filter((name) => !refused.has(name))
      return { table, columns: new Set(columns) }
    })
}

/** The declared table named `name`. */
const tableNamed = (app: App, name: string): AppTable | undefined =>
  app.tables?.find((candidate) => candidate.name === name)

/**
 * True when `reader` may read every column and row of the table a record step
 * read — or, for a step whose output holds the records it read, each of them
 * whole.
 */
const readsTableRead = async (
  judge: Judge,
  read: Extract<StepRead, { readonly kind: 'table' | 'records' }>
): Promise<boolean> => {
  const { c, app, reader } = judge
  const table = tableNamed(app, read.table)
  if (table === undefined) return false
  const columns = new Set(table.fields.map((field) => field.name))
  const whole = await readsWhole({ c, app, table, columns, reader })
  if (whole || read.kind === 'table' || read.records === undefined) return whole
  return recordsReadWhole({ c, app, table, records: read.records, reader })
}

/** A run and its steps as the store holds them, or `undefined` when it cannot be read. */
const loadRun = (c: Context, runId: string): Promise<JudgedRun | undefined> =>
  runDomainPromise(
    c,
    Effect.gen(function* () {
      const repo = yield* AutomationRunRepository
      const run = yield* repo.findById(runId)
      if (run === undefined) return undefined
      const steps = yield* repo.findStepsByRunId(runId)
      return {
        automationName: run.automationName,
        triggerData: run.triggerData,
        relay: run.relay,
        valuesErasedAt: run.valuesErasedAt,
        steps: steps.map((step) => ({
          name: step.actionName,
          status: step.status,
          output: step.output,
          reads: step.reads,
        })),
      }
    })
  ).catch(() => undefined)

/** True when every step of the run a synchronous call started stays within reach. */
const calledRunWithinReach = async (judge: Judge, runId: string): Promise<boolean> => {
  if (judge.hops >= RELAY_MAX_HOPS) return false
  const run = await loadRun(judge.c, runId)
  // A run scrubbed with an account no longer shows what it read.
  if (run === undefined || isErased(run)) return false
  return stepsWithinReach({ ...judge, hops: judge.hops + 1 }, run, run.steps)
}

/**
 * True when what a step read stays within what the reader may read. What no
 * reach judges is beyond her (fail closed).
 */
const readWithinReach = (judge: Judge, read: StepRead): Promise<boolean> => {
  switch (read.kind) {
    case 'none':
      return Promise.resolve(true)
    case 'unknown':
      return Promise.resolve(false)
    case 'agent':
      return everyInTurn(agentReach(judge.app, read.role), ({ table, columns }) =>
        readsWhole({ c: judge.c, app: judge.app, table, columns, reader: judge.reader })
      )
    case 'run':
      return readWithinReach(judge, read.reads)
    case 'calledRun':
      return calledRunWithinReach(judge, read.runId)
    case 'nested':
      return everyInTurn(read.reads, (nested) => readWithinReach(judge, nested))
    case 'table':
    case 'records':
      return readsTableRead(judge, read)
  }
}

/** The steps whose reads are recorded as they run rather than classified from their declaration. */
const RECORDED_READ_KEYS: ReadonlySet<string> = new Set(['code/runTypescript', 'automation/call'])

/**
 * What a step read: what it recorded as it ran, for a script or a synchronous
 * call that recorded it, else what its declaration and its output say.
 */
const stepRead = (app: App, action: StepAction, step: JudgedStep): StepRead => {
  const recorded = recordedReadsOf(step.reads) ?? []
  const key = `${action.type ?? ''}/${action.operator ?? ''}`
  // A script that recorded no call read nothing; a call that recorded no run
  // started none, and is judged by its declaration.
  const usesRecorded =
    RECORDED_READ_KEYS.has(key) &&
    Array.isArray(step.reads) &&
    (key !== 'automation/call' || recorded.length > 0)
  return usesRecorded ? readOfCalls(recorded) : classifyStepRead(app, action, step.output)
}

/** The declared actions of an automation, nested ones included, or none when it is gone. */
const actionsOf = (app: App, automationName: string): ReadonlyArray<StepAction> | undefined => {
  const automation = app.automations?.find((candidate) => candidate.name === automationName)
  return automation === undefined
    ? undefined
    : flattenActions((automation.actions ?? []) as ReadonlyArray<StepAction>)
}

/** True when one step of `run` stays within reach. A step that never ran read nothing. */
const stepWithinReach = (
  judge: Judge,
  actions: ReadonlyArray<StepAction>,
  step: JudgedStep
): Promise<boolean> => {
  if (step.status === 'skipped') return Promise.resolve(true)
  const action = actions.find((candidate) => candidate.name === step.name)
  if (action === undefined) return Promise.resolve(false)
  return readWithinReach(judge, stepRead(judge.app, action, step))
}

/** True when every one of `steps` of `run` stays within reach. */
const stepsWithinReach = (
  judge: Judge,
  run: JudgedRun,
  steps: ReadonlyArray<JudgedStep>
): Promise<boolean> => {
  const actions = actionsOf(judge.app, run.automationName)
  if (actions === undefined) return Promise.resolve(steps.length === 0)
  return everyInTurn(steps, (step) => stepWithinReach(judge, actions, step))
}

/** The records a run's trigger captured with the engine's authority. */
export const capturedRecordsOf = (
  triggerData: unknown
): readonly Readonly<Record<string, unknown>>[] => {
  if (triggerData === null || typeof triggerData !== 'object') return []
  const data = triggerData as Readonly<Record<string, unknown>>
  return ['record', 'previousRecord'].flatMap((key) => {
    const value = data[key]
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? [value as Readonly<Record<string, unknown>>]
      : []
  })
}

/**
 * True when the trigger data a run's own trigger captured stays within reach:
 * no record its trigger's table holds (a webhook's request, a form's answers),
 * or every such record whole — its related rows captured whole included.
 */
const capturedWithinReach = async (judge: Judge, run: JudgedRun): Promise<boolean> => {
  const automation = judge.app.automations?.find(
    (candidate) => candidate.name === run.automationName
  )
  if (automation === undefined) return false
  const records = capturedRecordsOf(run.triggerData)
  if (records.length === 0) return true
  // A record or comment trigger names the table whose record it captured.
  const { table: tableName } = automation.trigger as { readonly table?: unknown }
  if (typeof tableName !== 'string') return true
  const table = tableNamed(judge.app, tableName)
  if (table === undefined) return false
  return recordsReadWhole({ c: judge.c, app: judge.app, table, records, reader: judge.reader })
}

/**
 * True when a run no other run fed keeps its trigger data within reach. A call
 * or failure run recorded before relays were cannot be judged.
 */
const ownTriggerWithinReach = (judge: Judge, run: JudgedRun): Promise<boolean> => {
  const trigger = judge.app.automations?.find(
    (candidate) => candidate.name === run.automationName
  )?.trigger
  if (isRelayedTriggerType(trigger?.type)) return Promise.resolve(false)
  return capturedWithinReach(judge, run)
}

/** How many records a run's trigger and `steps` carry, for the relay's record cap. */
const recordsCarried = (run: JudgedRun, steps: ReadonlyArray<JudgedStep>): number =>
  capturedRecordsOf(run.triggerData).length +
  steps.reduce((sum, step) => {
    const { records } = (step.output ?? {}) as { readonly records?: unknown }
    return sum + (Array.isArray(records) ? records.length : 0)
  }, 0)

/**
 * True when a run's trigger data stays within reach — through its relay when
 * another run handed it on, from what its own trigger captured otherwise.
 * `carried` counts the records the runs followed so far carried.
 */
const triggerWithinReach = async (
  judge: Judge,
  run: JudgedRun,
  carried: number
): Promise<boolean> => {
  const relay = parseRelay(run.relay)
  if (relay !== undefined && 'outside' in relay) return true
  if (relay === undefined) return ownTriggerWithinReach(judge, run)
  if (judge.hops >= RELAY_MAX_HOPS) return false
  const feeding = await loadRun(judge.c, relay.run)
  // A run scrubbed with an account no longer shows what it read: what it
  // handed on is withheld from every reader who does not read every run.
  if (feeding === undefined || isErased(feeding)) return false
  const handedOn = feeding.steps.slice(0, relay.through)
  const total = carried + recordsCarried(feeding, handedOn)
  if (total > RELAY_MAX_RECORDS) return false
  const next = { ...judge, hops: judge.hops + 1 }
  return (
    (await triggerWithinReach(next, feeding, total)) && stepsWithinReach(next, feeding, handedOn)
  )
}

/**
 * How many of a run's leading steps the reader may see the output of: none
 * when its trigger data is withheld from her — data flows forward, so every
 * step may carry it — else up to the first step whose reach exceeds hers.
 */
export const visibleStepCount = async (input: {
  readonly c: Context
  readonly app: App
  readonly reader: Reader
  readonly run: JudgedRun
}): Promise<{ readonly triggerVisible: boolean; readonly visibleSteps: number }> => {
  const judge: Judge = { c: input.c, app: input.app, reader: input.reader, hops: 0 }
  const triggerVisible = await triggerWithinReach(judge, input.run, 0)
  if (!triggerVisible) return { triggerVisible, visibleSteps: 0 }
  const actions = actionsOf(input.app, input.run.automationName) ?? []
  const visibleSteps = await input.run.steps.reduce<Promise<number>>(async (count, step, index) => {
    const sofar = await count
    // Past the first step beyond her reach everything is withheld anyway.
    if (sofar < index) return sofar
    return (await stepWithinReach(judge, actions, step)) ? sofar + 1 : sofar
  }, Promise.resolve(0))
  return { triggerVisible, visibleSteps }
}
