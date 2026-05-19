/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import { evaluateRecordTriggerCondition } from './record-trigger-filters'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements } from './run-automation'
import type { App } from '@/domain/models/app'

export interface TriggerRecordEventInput {
  readonly app: App
  readonly tableName: string
  readonly event: 'create' | 'update' | 'delete'
  readonly record: Record<string, unknown>
  readonly previousRecord?: Record<string, unknown>
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly userId?: string
}

const watchFieldsChanged = (
  watchFields: readonly string[],
  record: Record<string, unknown>,
  previousRecord: Record<string, unknown> | undefined
): boolean => {
  if (previousRecord === undefined) return true
  return watchFields.some((field) => {
    const before = previousRecord[field]
    const after = record[field]
    if (before === after) return false
    return JSON.stringify(before) !== JSON.stringify(after)
  })
}

interface RecordEventMatchInput {
  readonly app: App
  readonly tableName: string
  readonly event: 'create' | 'update' | 'delete'
  readonly record: Record<string, unknown>
  readonly previousRecord: Record<string, unknown> | undefined
}

const findMatchingRecordAutomations = (
  input: RecordEventMatchInput
): readonly NonNullable<App['automations']>[number][] => {
  const { app, tableName, event, record, previousRecord } = input
  return (app.automations ?? []).filter((automation) => {
    if (automation.enabled === false) return false
    const { trigger } = automation
    if (trigger.type !== 'record') return false
    if (trigger.table !== tableName) return false
    if (!trigger.events.includes(event)) return false
    if (
      event === 'update' &&
      trigger.watchFields !== undefined &&
      !watchFieldsChanged(trigger.watchFields, record, previousRecord)
    ) {
      return false
    }
    if (
      trigger.condition !== undefined &&
      !evaluateRecordTriggerCondition(trigger.condition, record)
    ) {
      return false
    }
    return true
  })
}

export const triggerRecordEventAutomations = (
  input: TriggerRecordEventInput
): Effect.Effect<void, never, ExecuteAutomationRunRequirements> =>
  Effect.gen(function* () {
    const { app, tableName, event, record, previousRecord, processEnv, userId } = input
    const matching = findMatchingRecordAutomations({
      app,
      tableName,
      event,
      record,
      previousRecord,
    })
    if (matching.length === 0) return

    yield* Effect.forEach(
      matching,
      (automation) =>
        dispatchAutomationOnce({
          automation,
          app,
          processEnv,
          triggerData: { record } as unknown as TriggerData,
          userId,
        }),
      { concurrency: 1, discard: true }
    )
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.sync(() => {
        console.error('[automation:record-event] dispatch failure', cause)
      })
    )
  )
