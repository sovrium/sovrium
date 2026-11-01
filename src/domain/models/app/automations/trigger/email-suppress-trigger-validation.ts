/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAdminEquivalent, type AdminRoleResolvable } from '@/domain/models/app/auth/roles/role'
import { flattenActions, type StepAction } from '../step-read-service'
import { triggerEntryName } from '../trigger-list-validation'

interface SuppressTriggerLike {
  readonly type: string
  readonly name?: string
  readonly auth?: unknown
}

interface SuppressAppLike extends AdminRoleResolvable {
  readonly automations?: ReadonlyArray<{
    readonly name: string
    readonly triggers: ReadonlyArray<SuppressTriggerLike>
    readonly actions?: ReadonlyArray<unknown>
  }>
}

/** The type and the name of the trigger entry that started a run. */
interface StartingTrigger {
  readonly type: string
  readonly name: string
}

/** The automations `emailSuppressRunIssue` looks the running one up in. */
interface SuppressRunAppLike extends AdminRoleResolvable {
  readonly automations?: ReadonlyArray<{
    readonly name: string
    readonly triggers: ReadonlyArray<SuppressTriggerLike>
  }>
}

/** `true` when `auth` is a session check any non-admin signed-in user passes. */
const isSessionWithoutAdminRole = (auth: unknown, app: SuppressAppLike): boolean => {
  if (typeof auth !== 'object' || auth === null) return false
  const { type, requiredRole } = auth as {
    readonly type?: unknown
    readonly requiredRole?: unknown
  }
  if (type !== 'session') return false
  return typeof requiredRole !== 'string' || !isAdminEquivalent(requiredRole, app)
}

/** Why a trigger may not start an `email/suppress` step, or `undefined`. */
const triggerIssue = (
  trigger: SuppressTriggerLike,
  app: AdminRoleResolvable
): string | undefined => {
  if (trigger.type === 'form') {
    return 'cannot run behind a form trigger: anyone could stop the app mailing an address'
  }
  if (trigger.type === 'webhook' && trigger.auth === undefined) {
    return 'needs a webhook with `auth` (a signed provider report): an unsigned webhook would let anyone stop the app mailing an address'
  }
  if (trigger.type === 'webhook' && isSessionWithoutAdminRole(trigger.auth, app)) {
    return "needs requiredRole set to an admin role beside auth type 'session': any signed-in user could otherwise stop the app mailing an address"
  }
  return undefined
}

/**
 * An `email/suppress` step stops the app mailing someone, so a stranger must
 * not be able to run it: it is refused in an automation a form starts, a
 * webhook without `auth`, or a session webhook whose `requiredRole` is not
 * admin-equivalent. Returns a message naming the automation, the step
 * and `email/suppress`, or `true`.
 */
export const validateEmailSuppressTriggers = (app: SuppressAppLike): true | string => {
  const found = (app.automations ?? []).flatMap((automation) => {
    const steps = flattenActions((automation.actions ?? []) as ReadonlyArray<StepAction>).filter(
      (step) => step.type === 'email' && step.operator === 'suppress'
    )
    const issue = automation.triggers
      .map((trigger) => triggerIssue(trigger, app))
      .find((text) => text !== undefined)
    return issue === undefined
      ? []
      : steps.map((step) => ({ automation: automation.name, step: String(step.name ?? ''), issue }))
  })[0]
  return found === undefined
    ? true
    : `Automation '${found.automation}': step '${found.step}' (email/suppress) ${found.issue}`
}

/**
 * Why a run of `automationName` may not run an `email/suppress` step, or
 * `undefined`: the same judgement as `validateEmailSuppressTriggers`, made on
 * the trigger entry that started the run, so a config that reached the engine
 * without passing validation still cannot let a stranger stop the app mailing
 * an address. With no starting entry to go on (none recorded, or none the
 * automation still declares), every trigger of the
 * automation is judged, as validation does. An automation the config does not
 * declare (an agent's own dispatch) starts from no trigger and is accepted.
 */
export const emailSuppressRunIssue = (
  app: SuppressRunAppLike,
  automationName: string,
  startedBy: StartingTrigger | undefined
): string | undefined => {
  const triggers =
    app.automations?.find((automation) => automation.name === automationName)?.triggers ?? []
  const matching =
    startedBy === undefined
      ? []
      : triggers.filter(
          (trigger) =>
            trigger.type === startedBy.type && triggerEntryName(trigger) === startedBy.name
        )
  return (matching.length > 0 ? matching : triggers)
    .map((trigger) => triggerIssue(trigger, app))
    .find((text) => text !== undefined)
}
