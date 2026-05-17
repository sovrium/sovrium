/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationRepository } from '@/application/ports/repositories/automation-repository'
import { defaultActionHandlers } from './action-handlers'
import {
  executeAutomationRun,
  type ExecuteAutomationRunRequirements,
  type RunAutomationResult,
} from './run-automation'
import type { TriggerData } from './resolve-trigger-data'
import type { App } from '@/domain/models/app'

/**
 * Resolve the `automation_definitions.id` lazily for an automation by name,
 * silencing seed errors. If the row already exists (seeded by a previous
 * trigger), return its id; if not, create it idempotently. Returns
 * `undefined` when seeding fails so trigger callers can absorb the failure
 * — a downstream automation seed error must never roll back the upstream
 * write that fired the trigger.
 *
 * The strict variant `resolveAutomationId` in `run-automation.ts` raises
 * `AutomationRegistrySeedError`; trigger entry points (record-event, form,
 * future event types) need this swallow-errors version.
 */
export const resolveAutomationIdSilent = (
  name: string,
  automation: NonNullable<App['automations']>[number]
): Effect.Effect<string | undefined, never, AutomationRepository> =>
  Effect.gen(function* () {
    const repo = yield* AutomationRepository
    const findResult = yield* Effect.either(repo.findByName(name))
    if (
      findResult._tag === 'Right' &&
      findResult.right !== undefined &&
      typeof findResult.right['id'] === 'string'
    ) {
      return findResult.right['id']
    }
    const createResult = yield* Effect.either(
      repo.create({
        name,
        trigger: automation.trigger as unknown as Record<string, unknown>,
        actions: automation.actions as unknown as readonly Record<string, unknown>[],
        enabled: automation.enabled ?? true,
      })
    )
    if (createResult._tag !== 'Right') return undefined
    const created = createResult.right
    if (typeof created['id'] !== 'string') return undefined
    return created['id']
  })

/**
 * Dispatch a single automation through the shared engine loop given a
 * pre-built `TriggerData` envelope. Returns the {@link RunAutomationResult}
 * (engine status, errors, action outputs) when the automation could be
 * dispatched, or `undefined` when the lazy seed of
 * `system.automation_definitions` failed — trigger entry points cannot
 * fail the upstream write that produced the event, so seed/dispatch
 * errors are absorbed by `executeAutomationRun`.
 *
 * Callers that need void semantics can simply `yield*` the program and
 * ignore the result; the form-submission trigger uses the result to
 * advance the submission ledger's lifecycle status (`processing → done`
 * on success, `processing → failed` on terminal failure).
 *
 * Used by every trigger entry point that maps a domain event onto a list
 * of matching automations (record-event, form-submission, future event
 * types) to keep the per-automation seed-then-execute step identical
 * across families.
 */
export const dispatchAutomationOnce = (input: {
  readonly automation: NonNullable<App['automations']>[number]
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly triggerData: TriggerData
  readonly userId: string | undefined
}): Effect.Effect<RunAutomationResult | undefined, never, ExecuteAutomationRunRequirements> =>
  Effect.gen(function* () {
    const { automation, app, processEnv, triggerData, userId } = input
    const automationId = yield* resolveAutomationIdSilent(automation.name, automation)
    if (automationId === undefined) return undefined

    return yield* executeAutomationRun({
      name: automation.name,
      automation,
      automationId,
      app,
      processEnv,
      triggerData,
      handlers: defaultActionHandlers,
      userId,
    })
  })
