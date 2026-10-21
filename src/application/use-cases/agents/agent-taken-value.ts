/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether an agent create refused over a taken `unique` value may say so to
 * the person the turn answers.
 *
 * It asks the records API's own rule (`uniqueConflictAnswerProgram`): the
 * value may be called taken only when she could read it on every record
 * holding it — the table's read gate, her row-level read rule and the field's
 * own read. Anything else — a holder she may not read, a turn nobody started,
 * a refusal no column was attributed to — leaves the refusal as it was, which
 * reads like any other refused write.
 */

import { Effect } from 'effect'
import { buildSyntheticSession } from '@/application/use-cases/automations/build-guest-session'
import { uniqueConflictAnswerProgram } from '@/application/use-cases/tables/unique-conflict-answer-program'
import { callerLinkReader, runReadAccess } from '../automations/action-handlers/record-caller-gate'
import type { AutomationContext } from '../automations/action-handlers'
import type { StepRequirements } from '../automations/run/types'
import type { App, Table } from '@/domain/models/app'
import type { RefusedWrite } from '@/domain/models/app/agents/agent-action-failure-service'

/** The table and fields of a create refused over a taken value a column was attributed to. */
const takenCreateOf = (input: {
  readonly app: App
  readonly action: string
  readonly props: Readonly<Record<string, unknown>>
  readonly refusedWrite: RefusedWrite | undefined
}): { readonly table: Table; readonly fields: Readonly<Record<string, unknown>> } | undefined => {
  const { app, props, refusedWrite } = input
  if (input.action !== 'record.create' || refusedWrite?.unique !== true) return undefined
  if (refusedWrite.column === undefined) return undefined
  const fields = props['fields'] ?? props['data']
  if (typeof fields !== 'object' || fields === null) return undefined
  const table = app.tables?.find((candidate) => candidate.name === props['table'])
  return table === undefined
    ? undefined
    : { table, fields: fields as Readonly<Record<string, unknown>> }
}

/** The refusal of a create, marked readable when the caller could read every holder of the value. */
export const judgedTakenValue = (input: {
  readonly app: App
  readonly action: string
  readonly props: Readonly<Record<string, unknown>>
  readonly userId: string | undefined
  readonly refusedWrite: RefusedWrite | undefined
}): Effect.Effect<RefusedWrite | undefined, never, StepRequirements> =>
  Effect.gen(function* () {
    const { app, userId, refusedWrite } = input
    const taken = takenCreateOf(input)
    if (taken === undefined || userId === undefined) return refusedWrite
    const { table, fields } = taken
    const automation: AutomationContext = { name: 'agent', id: '', startedByHand: true, userId }
    const access = yield* runReadAccess(app, automation, table.name)
    const caller = yield* callerLinkReader(userId)
    const answer = yield* uniqueConflictAnswerProgram({
      session: buildSyntheticSession(userId),
      app,
      table,
      write: { written: [fields] },
      reader: {
        role: caller.role,
        groups: caller.groups ?? [],
        readsTable: access.kind !== 'refused',
        rowReadable: access.kind === 'scoped' ? (row) => access.scope.admits(row) : undefined,
      },
    })
    return answer === 'conflict'
      ? { ...refusedWrite, unique: true, holderReadable: true }
      : refusedWrite
  }).pipe(Effect.withSpan('agents.judged-taken-value'))
