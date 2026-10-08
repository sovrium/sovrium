/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The single-record write roads every door but an automation step takes: the
 * records API's routes, the MCP tools, a hosted form, a form edit link and the
 * AI chat. Each is its operation's orchestration (`record-*-orchestration.ts`)
 * with the record automations started by the records API's own dispatch.
 *
 * An automation step takes the same orchestrations with its run's record-event
 * channel instead (`action-handlers/record-events.ts`). The binding lives here,
 * apart from the orchestrations, because the records API's dispatch imports the
 * automation run loop — which imports the step handlers, which import the
 * orchestrations: binding it there would close that cycle.
 */

import { Effect } from 'effect'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import { createRecordVia, type RecordCreateInput } from './record-create-orchestration'
import { deleteRecordVia, type RecordDeleteInput } from './record-delete-orchestration'
import { updateRecordVia, type RecordUpdateInput } from './record-update-orchestration'

/** Create one record and run every side effect the create carries. */
export const createRecordWithSideEffects = (input: RecordCreateInput) =>
  createRecordVia(input, triggerRecordEventAutomations).pipe(
    Effect.withSpan('tables.create-record-road', { attributes: { tableName: input.tableName } })
  )

/** Update one record and run every side effect the update carries. */
export const updateRecordWithSideEffects = (input: RecordUpdateInput) =>
  updateRecordVia(input, triggerRecordEventAutomations).pipe(
    Effect.withSpan('tables.update-record-road', { attributes: { tableName: input.tableName } })
  )

/** Delete one record and run every side effect the delete carries. */
export const deleteRecordWithSideEffects = (input: RecordDeleteInput) =>
  deleteRecordVia(input, triggerRecordEventAutomations).pipe(
    Effect.withSpan('tables.delete-record-road', { attributes: { tableName: input.tableName } })
  )
