/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record-event channel of one run.
 *
 * A record an automation step writes is a record like any other: it starts
 * the record automations of its table, exactly as the same write through the
 * records API does, and a later run can read it. What keeps a chain of such
 * writes from running away is the record-event loop rule:
 *
 *   - a loop the config SHOWS — an automation whose write re-fires its own
 *     trigger — is refused at validation (`record-loop-validation.ts`);
 *   - a cycle it cannot show — two automations re-writing each other's
 *     tables — stops here, at {@link MAX_RECORD_EVENT_DEPTH}: the step that
 *     would start a run one level deeper fails, naming the limit, instead of
 *     writing. Its run is failed and says why in run history.
 *
 * The dispatch runs in the BACKGROUND, like an asynchronous `automation:call`:
 * a run waiting on its own children would hold its concurrency slot while a
 * child of the same automation waited for one, which deadlocks the moment an
 * automation declares `concurrency.limit: 1`. Background is not unowned: the
 * run is tracked (`background-runs.ts`), and a shutdown finishes it or records
 * it as stopped rather than exiting under it.
 *
 * Built by the orchestrator (`run-automation.ts`) and handed to every step.
 */

import { AutomationFiberBridge } from '@/application/ports/services/automation-fiber-bridge'
import { isReadonlyComputedFieldType } from '@/domain/models/app/tables/fields/field'
import { logError } from '@/infrastructure/logging/logger'
import { triggerRecordEventAutomations } from '../trigger-record-event'
import type { StepContext } from './types'
import type { RecordEventChannel, RecordWriteEvent } from '../action-handlers/shared'
import type { App } from '@/domain/models/app'

/**
 * How many automation writes a chain of record events may cross. A run started
 * by a person's write is at depth 0; a step of a run at this depth may not
 * write into a table whose record automations it would start.
 */
export const MAX_RECORD_EVENT_DEPTH = 4

/** Fields the engine stamps on a write, whatever the step names. */
const SYSTEM_STAMPED_TYPES: ReadonlySet<string> = new Set([
  'updated-at',
  'updated-by',
  'created-at',
  'created-by',
  'deleted-at',
  'deleted-by',
])

/**
 * Whether an update naming `fields` may change `watched` in `tableName`: it
 * names it, or the field is not one a step writes directly — a formula, a
 * lookup, a rollup, a count or an autonumber derives from other fields, an
 * authorship or timestamp field is stamped by the engine, and an undeclared
 * name cannot be judged. Erring towards "may change" keeps the depth limit a
 * limit: a watched field a write changes without naming it still stops the loop.
 */
const mayChange = (
  app: App,
  tableName: string,
  fields: readonly string[],
  watched: string
): boolean => {
  if (fields.includes(watched)) return true
  const declared = app.tables
    ?.find((table) => table.name === tableName)
    ?.fields.find((field) => field.name === watched)
  if (declared === undefined) return true
  return isReadonlyComputedFieldType(declared.type) || SYSTEM_STAMPED_TYPES.has(declared.type)
}

/**
 * True when some record automation of `app` fires on `event` in `tableName`.
 *
 * `fields` narrows an update to the fields it writes: an update trigger
 * declaring `watchFields` fires only when one of them may change (see
 * {@link mayChange}), and one with no `watchFields` watches every field.
 * Omitted, any update is watched.
 */
const isWatched = (
  app: App,
  tableName: string,
  event: RecordWriteEvent['event'],
  fields?: readonly string[]
): boolean =>
  (app.automations ?? []).some(({ trigger }) => {
    if (trigger.type !== 'record' || trigger.table !== tableName) return false
    if (!trigger.events.includes(event)) return false
    const { watchFields } = trigger
    if (event !== 'update' || fields === undefined || watchFields === undefined) return true
    return watchFields.some((field) => mayChange(app, tableName, fields, field))
  })

/** What the channel reads from the run it belongs to. */
type ChannelContext = Pick<
  StepContext,
  'app' | 'processEnv' | 'automation' | 'recordEventDepth' | 'runProgram'
>

/** Build the record-event channel for one run. */
export const buildRecordEventChannel = (ctx: ChannelContext): RecordEventChannel => ({
  watches: (tableName, event) => isWatched(ctx.app, tableName, event),
  refusal: (tableName, event, fields) =>
    ctx.recordEventDepth >= MAX_RECORD_EVENT_DEPTH && isWatched(ctx.app, tableName, event, fields)
      ? `Stopped a record-event loop: this ${event} in '${tableName}' would start its record automations ${String(ctx.recordEventDepth + 1)} automation writes deep, past the depth limit of ${String(MAX_RECORD_EVENT_DEPTH)}.`
      : undefined,
  dispatch: (write) => {
    if (!isWatched(ctx.app, write.tableName, write.event)) return
    const program = triggerRecordEventAutomations({
      app: ctx.app,
      tableName: write.tableName,
      event: write.event,
      record: { ...write.record },
      ...(write.previousRecord === undefined
        ? {}
        : { previousRecord: { ...write.previousRecord } }),
      processEnv: ctx.processEnv,
      ...(ctx.automation.userId === undefined ? {} : { userId: ctx.automation.userId }),
      depth: ctx.recordEventDepth + 1,
    })
    // eslint-disable-next-line functional/no-expression-statements -- background dispatch; see the module doc for why the step does not wait
    ctx.runProgram(AutomationFiberBridge.use((bridge) => bridge.trackBackground(program))).then(
      () => undefined,
      (error: unknown) => {
        logError('[automation:record-event] background dispatch from a step rejected', error)
      }
    )
  },
})
