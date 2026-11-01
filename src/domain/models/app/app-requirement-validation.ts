/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { validateAllRoleReferences, validateTableRoleReferences } from './auth/role-validation'
import { flattenActions } from './automations/step-read-service'
import { validateWebhookTriggersAgainstApp } from './automations/trigger/webhook-app-validation'
import { hasTriggerOfType } from './automations/trigger-entries-service'
import { validateBusinessRuleAppReferences } from './tables/business-rule-validation'
import { tablesHoldingPersonField } from './tables/fields/field-types/user/user-directory-need-service'
import { validateRowRuleGrantRoles } from './tables/row-rule-grant-role-validation'
import type { ActionTemplates } from './actions'
import type { Action, Automations } from './automations'
import type { Tables } from './tables'

/**
 * The config blocks a feature REQUIRES: user fields and auth or approval steps
 * need `auth`, analytics steps need `analytics`; and every role a declaration
 * names must exist. Each function is the body of one `AppSchema` filter, with
 * the same messages, kept beside `app.ts` so the schema reads as a list.
 */

/**
 * A user, created-by or updated-by field names a person, so it needs `auth`.
 *
 * Pure; `AppSchema` runs it as one of its `Schema.check` filters, so its
 * message is the decode error a refused config prints.
 */
export const validateUserFieldsRequireAuth = (app: {
  readonly tables?: Tables | undefined
  readonly auth?: unknown
}): true | string => {
  const hasUserFields = tablesHoldingPersonField(app).length > 0

  if (hasUserFields && !app.auth) {
    return 'User fields (user, created-by, updated-by) require auth configuration'
  }
  return true
}

/**
 * Every role a table permission, a row rule, a business rule, a bucket or a
 * trigger names exists. Table permissions accept the built-in and custom roles as
 * soon as `auth` exists; bucket and trigger permissions stay format-only until
 * `auth.roles` (`validateAllRoleReferences`).
 *
 * Pure; `AppSchema` runs it as one of its `Schema.check` filters, so its
 * message is the decode error a refused config prints.
 */
export const validateAppRoleReferences = (
  app: Parameters<typeof validateBusinessRuleAppReferences>[0] &
    Parameters<typeof validateTableRoleReferences>[0] &
    Parameters<typeof validateRowRuleGrantRoles>[0] &
    Parameters<typeof validateAllRoleReferences>[0]
): true | string => {
  if (!app.auth) return validateBusinessRuleAppReferences(app) ?? true // roles: once auth exists
  // Table permissions: built-in + custom roles as soon as auth exists; bucket/trigger
  // permissions stay format-only until `auth.roles` (validateAllRoleReferences).
  const tableError = validateTableRoleReferences(app)
  if (tableError !== true) return tableError
  const ruleError = validateRowRuleGrantRoles(app) ?? validateBusinessRuleAppReferences(app)
  return ruleError ?? validateAllRoleReferences(app)
}

/**
 * Auth triggers and auth actions need `auth`; session webhooks are checked against
 * the app by `validateWebhookTriggersAgainstApp`.
 *
 * Pure; `AppSchema` runs it as one of its `Schema.check` filters, so its
 * message is the decode error a refused config prints.
 */
export const validateAutomationAuthRequirements = (
  app: {
    readonly automations?: Automations | undefined
    readonly auth?: unknown
  } & Parameters<typeof validateWebhookTriggersAgainstApp>[0]
): true | string => {
  if (!app.automations) return true
  const hasAuthTrigger = app.automations.some((a) => hasTriggerOfType(a, 'auth'))
  if (hasAuthTrigger && !app.auth) {
    return 'Auth triggers require auth configuration to be enabled'
  }

  const hasAuthAction = app.automations.some((a) =>
    a.actions.some((action) => action.type === 'auth')
  )
  if (hasAuthAction && !app.auth) {
    return 'Auth actions require auth configuration to be enabled'
  }
  return validateWebhookTriggersAgainstApp(app)
}

/**
 * An analytics action needs `analytics`.
 *
 * Pure; `AppSchema` runs it as one of its `Schema.check` filters, so its
 * message is the decode error a refused config prints.
 */
export const validateAnalyticsActionRequirement = (app: {
  readonly automations?: Automations | undefined
  readonly analytics?: unknown
}): true | string => {
  if (!app.automations) return true

  const hasAnalyticsAction = app.automations.some((a) =>
    a.actions.some((action) => action.type === 'analytics')
  )
  if (hasAnalyticsAction && !app.analytics) {
    return 'Analytics actions require analytics configuration to be enabled'
  }
  return true
}

/**
 * An approval step waits on a signed-in approver, so it needs `auth` — wherever
 * a run can reach it: inside a `loop` or a `path`, or in an `app.actions[]` template.
 *
 * Pure; `AppSchema` runs it as one of its `Schema.check` filters, so its
 * message is the decode error a refused config prints.
 */
export const validateApprovalActionRequirement = (app: {
  readonly automations?: Automations | undefined
  readonly actions?: ActionTemplates | undefined
  readonly auth?: unknown
}): true | string => {
  // Every step a run can reach: an approval inside a `loop` body or a
  // `path` branch waits on a signed-in approver exactly like a top-level one,
  // and so does one declared as an `app.actions[]` template — a `$ref` is
  // rewritten to its template before the run dispatches anything, and a
  // template exposed through `aiAccess` runs with no automation at all.
  const declared: ReadonlyArray<Action> = [
    ...(app.automations ?? []).flatMap((a) => a.actions),
    ...(app.actions ?? []).map((template) => template.action),
  ]
  const hasApprovalAction = flattenActions(declared).some((action) => action.type === 'approval')
  if (hasApprovalAction && !app.auth) {
    return 'Approval actions require auth configuration to be enabled'
  }
  return true
}
