/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import {
  mayRunManualAutomation,
  mayStartAutomationByName,
  requiredManualTriggerRole,
} from '@/domain/models/app/automations/manual-trigger-role-service'
import { defaultActionHandlers, type ActionHandler, type ActionKey } from './action-handlers'
import { loadPausedAutomationNames } from './paused-automation-names'
import {
  executeAutomationRun,
  resolveAutomationId,
  type ExecuteAutomationRunRequirements,
  type RunAutomationError,
  type RunAutomationResult,
} from './run-automation'
import type { TriggerData } from './resolve-trigger-data'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { App } from '@/domain/models/app'

/**
 * Locate a manual-triggered automation by name and reject states that
 * should not produce a run (missing, operationally OFF, or non-manual trigger).
 *
 * Off (config-disabled OR operationally paused) and non-existent automations
 * all 404 to prevent enumeration, matching the convention
 * `resolveWebhookAutomation` already established.
 */
const resolveManualAutomation = (
  app: App,
  name: string,
  pausedNames: ReadonlySet<string>
): Effect.Effect<NonNullable<App['automations']>[number], RunAutomationError> => {
  const automation = app.automations?.find((a) => a.name === name)
  if (!automation) return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  if (!isAutomationOperationallyEnabled(automation, pausedNames))
    return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  if (automation.trigger.type !== 'manual') {
    return Effect.fail({ _tag: 'AutomationNotManualTriggered' as const, name })
  }
  return Effect.succeed(automation)
}

/**
 * Options bag for {@link runManualAutomation}. Mirrors the webhook entry
 * point but adds `userRole` for permission gating against the trigger's
 * `requiredRole` (default `'admin'`).
 */
export interface RunManualAutomationOptions {
  readonly name: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /**
   * Caller's role from the auth.users table — used to enforce the manual
   * trigger's `requiredRole` constraint. The route must call
   * `getUserRole(session.userId)` BEFORE invoking this program; passing
   * undefined means the caller is anonymous and the request will be
   * rejected unless the trigger explicitly allows that role.
   */
  readonly userRole: string | undefined
  /** Optional input payload from the manual-trigger request body. */
  readonly triggerData?: TriggerData
  readonly handlers?: ReadonlyMap<ActionKey, ActionHandler>
  readonly userId?: string
  /**
   * The caller names the automation — the direct trigger route, the MCP tool,
   * the AI chat — rather than pressing a control bound to it. A declared
   * `permissions.trigger` then narrows who may start it, on top of the role rule.
   */
  readonly byName?: boolean
}

/**
 * Execute a manual-triggered automation by name. Distinct from the webhook
 * entry point because:
 *
 *  1. Trigger type must be `'manual'` — webhook-only automations cannot be
 *     invoked through this route (and vice versa).
 *  2. Caller must satisfy the trigger's `requiredRole` (default: `'admin'`).
 *
 * Same persistence + run-history contract as the webhook variant — both
 * funnel through `executeAutomationRun`.
 */
export const runManualAutomation = ({
  name,
  app,
  processEnv,
  userRole,
  triggerData = {},
  handlers = defaultActionHandlers,
  userId,
  byName = false,
}: RunManualAutomationOptions): Effect.Effect<
  RunAutomationResult,
  RunAutomationError,
  ExecuteAutomationRunRequirements | AutomationPauseRepository
> =>
  Effect.gen(function* () {
    // Entry point: one read of the operational pauses, threaded into the gate.
    const pausedNames = yield* loadPausedAutomationNames
    const automation = yield* resolveManualAutomation(app, name, pausedNames)

    // The role decision is the one `tools/list` uses to decide which manual
    // automations an MCP caller is offered, so what is listed is what runs.
    const requiredRole = requiredManualTriggerRole(automation, app)
    const admitted = byName
      ? mayStartAutomationByName(automation, app, userRole)
      : mayRunManualAutomation(automation, app, userRole)
    if (!admitted) {
      return yield* Effect.fail({
        _tag: 'AutomationManualRoleRequired' as const,
        name,
        required: requiredRole,
      } satisfies RunAutomationError)
    }

    const automationId = yield* resolveAutomationId(name, automation)
    return yield* executeAutomationRun({
      name,
      automation,
      automationId,
      app,
      processEnv,
      triggerData,
      handlers,
      userId,
      // A manual trigger is always a person's gesture: its record actions write as them.
      startedByHand: true,
    })
  }).pipe(Effect.withSpan('automations.run-manual-automation'))
