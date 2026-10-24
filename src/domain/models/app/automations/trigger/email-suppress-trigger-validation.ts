/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAdminEquivalent, type AdminRoleResolvable } from '@/domain/models/app/auth/roles/role'
import { flattenActions } from '../step-read-service'

interface SuppressTriggerLike {
  readonly type: string
  readonly auth?: unknown
}

interface SuppressAppLike extends AdminRoleResolvable {
  readonly automations?: ReadonlyArray<{
    readonly name: string
    readonly triggers: ReadonlyArray<SuppressTriggerLike>
    readonly actions?: ReadonlyArray<unknown>
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
const triggerIssue = (trigger: SuppressTriggerLike, app: SuppressAppLike): string | undefined => {
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
    const steps = flattenActions(
      (automation.actions ?? []) as Parameters<typeof flattenActions>[0]
    ).filter((step) => step.type === 'email' && step.operator === 'suppress')
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
