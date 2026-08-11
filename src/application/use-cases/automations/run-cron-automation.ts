/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isAdminRole } from '@/domain/models/shared/permission-evaluation'
import { defaultActionHandlers, type ActionHandler, type ActionKey } from './action-handlers'
import {
  executeAutomationRun,
  resolveAutomationId,
  type ExecuteAutomationRunRequirements,
  type RunAutomationError,
  type RunAutomationResult,
} from './run-automation'
import type { TriggerData } from './resolve-trigger-data'
import type { App } from '@/domain/models/app'

/**
 * Locate a cron-triggered automation by name and reject states that should
 * not produce a run (missing, disabled, or non-cron trigger). Mirrors the
 * webhook/manual variants so cron-bound entries get the same defensive
 * filtering before execution.
 */
const resolveCronAutomation = (
  app: App,
  name: string
): Effect.Effect<NonNullable<App['automations']>[number], RunAutomationError> => {
  const automation = app.automations?.find((a) => a.name === name)
  if (!automation) return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  if (automation.enabled === false) {
    return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  }
  if (automation.trigger.type !== 'cron') {
    // Re-use the webhook-shaped error tag — the cron runner is internal,
    // not exposed to HTTP, and the run-history persistence path doesn't
    // distinguish per-trigger error kinds.
    return Effect.fail({ _tag: 'AutomationNotWebhookTriggered' as const, name })
  }
  return Effect.succeed(automation)
}

/**
 * Options bag for {@link runCronAutomation}. Mirrors the webhook entry
 * point's shape (no `userRole` since cron-fired runs are system-triggered).
 */
export interface RunCronAutomationOptions {
  readonly name: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /**
   * Trigger data exposed to actions through `{{trigger.X}}`. Cron runs have
   * no upstream payload so this defaults to a synthetic envelope describing
   * the schedule (`type`, `firedAt`).
   */
  readonly triggerData?: TriggerData
  readonly handlers?: ReadonlyMap<ActionKey, ActionHandler>
}

/**
 * Execute a cron-triggered automation by name.
 *
 * Distinct from the webhook entry point because cron-fired runs:
 *  1. Bypass HTTP — the live `CronScheduler` adapter calls this directly
 *     when a timer fires.
 *  2. Are system-triggered (no `userId`).
 *  3. Synthesise an empty trigger envelope (the schedule produced no
 *     external payload).
 *
 * Same persistence + run-history contract as the other entry points — both
 * funnel through `executeAutomationRun`.
 */
export const runCronAutomation = ({
  name,
  app,
  processEnv,
  triggerData = { type: 'cron', firedAt: new Date().toISOString() },
  handlers = defaultActionHandlers,
}: RunCronAutomationOptions): Effect.Effect<
  RunAutomationResult,
  RunAutomationError,
  ExecuteAutomationRunRequirements
> =>
  Effect.gen(function* () {
    const automation = yield* resolveCronAutomation(app, name)
    const automationId = yield* resolveAutomationId(name, automation)
    return yield* executeAutomationRun({
      name,
      automation,
      automationId,
      app,
      processEnv,
      triggerData,
      handlers,
      userId: undefined,
    })
  })

/**
 * Options bag for {@link runCronAutomationOnDemand}. Adds `userRole` for the
 * operator gate — the manual "run now" path is authorized-operator-only.
 */
export interface RunCronAutomationOnDemandOptions {
  readonly name: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /**
   * Caller's role resolved from auth.users. `undefined` for anonymous callers,
   * which are rejected — the on-demand cron run touches a system-triggered
   * workflow, so it is gated to authorized operators (default `'admin'`,
   * matching the manual trigger gate).
   */
  readonly userRole: string | undefined
  readonly triggerData?: TriggerData
  readonly handlers?: ReadonlyMap<ActionKey, ActionHandler>
  readonly userId?: string
}

/**
 * Invoke a CRON-triggered automation ON DEMAND ("run now") for an authorized
 * operator, executing its action chain once immediately WITHOUT touching the
 * background schedule (no reschedule). Mirrors the manual-trigger auth gate so
 * the HTTP surface for "run now" shares one authorization convention:
 *
 *  1. Trigger type must be `'cron'` — non-cron automations are rejected with
 *     `AutomationNotManualTriggered` (the manual route already serves manual
 *     triggers; this entry point only handles the cron case).
 *  2. The caller must satisfy the operator gate. Cron triggers have no
 *     `requiredRole` field, so the required role is `'admin'`; an `admin`
 *     caller always satisfies it. Anonymous / under-privileged callers are
 *     rejected with `AutomationManualRoleRequired`, which the route maps to a
 *     404 (anti-enumeration), keeping the gate identical to the manual path.
 *
 * Execution reuses {@link runCronAutomation} verbatim — the on-demand run is
 * indistinguishable from a scheduled fire at the engine level (same
 * persistence + run-history contract). The synthetic trigger envelope marks
 * the run as on-demand (`invokedOnDemand: true`) so callers can tell it apart
 * from background scheduled runs.
 *
 * Spec: [internal ref] (authorized run) / -015 (anonymous
 * caller rejected).
 */
export const runCronAutomationOnDemand = ({
  name,
  app,
  processEnv,
  userRole,
  triggerData,
  handlers = defaultActionHandlers,
}: RunCronAutomationOnDemandOptions): Effect.Effect<
  RunAutomationResult,
  RunAutomationError,
  ExecuteAutomationRunRequirements
> =>
  Effect.gen(function* () {
    // Re-resolve to reject non-cron triggers up front with the manual error
    // tag (→ 404 at the route) before any side effect runs.
    const automation = app.automations?.find((a) => a.name === name)
    if (!automation || automation.enabled === false) {
      return yield* Effect.fail({ _tag: 'AutomationNotFound' as const, name })
    }
    if (automation.trigger.type !== 'cron') {
      return yield* Effect.fail({ _tag: 'AutomationNotManualTriggered' as const, name })
    }

    // Operator gate — cron triggers carry no `requiredRole`, so the implicit
    // requirement is 'admin'. An 'admin' caller always satisfies it.
    const requiredRole = 'admin'
    const callerSatisfiesRole = userRole === requiredRole || isAdminRole(userRole)
    if (!callerSatisfiesRole) {
      return yield* Effect.fail({
        _tag: 'AutomationManualRoleRequired' as const,
        name,
        required: requiredRole,
      } satisfies RunAutomationError)
    }

    return yield* runCronAutomation({
      name,
      app,
      processEnv,
      triggerData: triggerData ?? {
        type: 'cron',
        firedAt: new Date().toISOString(),
        invokedOnDemand: true,
      },
      handlers,
    })
  })
