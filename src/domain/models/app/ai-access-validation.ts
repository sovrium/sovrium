/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isReservedInternalPrefix } from '../shared/internal-tables'

/**
 * AI/MCP-related cross-validation for AppSchema.
 *
 * **Bundled into a single `validateAllAiAccessRules` helper** to keep the
 * AppSchema `.pipe()` chain short (TypeScript's deep-instantiation depth
 * limit is hit when too many `Schema.filter` calls stack on top of
 * `Schema.Struct`). Same pattern as `validateAllFormsReferences` and
 * `validateAllRoleReferences`.
 *
 * The helpers also use loose-typed parameters (rather than the App type)
 * to prevent Schema.filter from narrowing the App type to `never` via
 * predicate type-guard inference.
 *
 * Each individual rule short-circuits with a string error message when
 * violated; returns `true` when all rules pass.
 */

/**
 * AiAccess can be `boolean | { ... }` per the Union schema. Helpers below
 * accept either form and short-circuit on the boolean variant.
 */
type LooseAiAccess =
  | boolean
  | {
      readonly fieldExposure?: string
      readonly whitelistFields?: ReadonlyArray<string>
    }

type LooseAutomation = {
  readonly name: string
  readonly trigger: { readonly type: string }
  readonly aiAccess?: LooseAiAccess
}

type LooseTable = {
  readonly name: string
  readonly aiAccess?: LooseAiAccess
}

type LooseAction = LooseTable

type LooseApp = {
  readonly tables?: ReadonlyArray<LooseTable>
  readonly automations?: ReadonlyArray<LooseAutomation>
  readonly actions?: ReadonlyArray<LooseAction>
}

/**
 * Internal helper: returns true when aiAccess declares the entity as enabled.
 * Boolean `true` and any object form both count; boolean `false` and
 * `undefined` do not.
 */
const aiAccessIsDeclared = (access: LooseAiAccess | undefined): boolean => {
  if (access === undefined) return false
  if (typeof access === 'boolean') return access
  return true
}

/**
 * Internal helper: extracts the rich-config object form of aiAccess, or
 * `undefined` if the value is boolean / undefined. Used by rules that only
 * apply to the config form (e.g. whitelist consistency).
 */
const aiAccessConfig = (
  access: LooseAiAccess | undefined
):
  | { readonly fieldExposure?: string; readonly whitelistFields?: ReadonlyArray<string> }
  | undefined => {
  if (access === undefined || typeof access === 'boolean') return undefined
  return access
}

/**
 * Rule 1: Only manual-trigger automations may have aiAccess.
 *
 * Record / cron / webhook triggers fire on their own and cannot be invoked
 * by an AI client; setting aiAccess on them would silently misrepresent the
 * MCP surface to clients.
 */
const checkManualTriggerOnly = (app: LooseApp): true | string => {
  if (!app.automations) return true

  const violator = app.automations.find(
    (a) => aiAccessIsDeclared(a.aiAccess) && a.trigger.type !== 'manual'
  )
  if (violator) {
    return `Automation '${violator.name}' has aiAccess but trigger type is '${violator.trigger.type}'; only manual-trigger automations can be AI-exposed`
  }
  return true
}

/**
 * Rule 2: aiAccess.fieldExposure='whitelist' requires non-empty whitelistFields.
 *
 * Caught at decode time so schema authors get an immediate error rather than
 * a silently-empty exposed field set at runtime.
 */
const isWhitelistMissingFields = (access: LooseAiAccess | undefined): boolean => {
  const config = aiAccessConfig(access)
  if (!config) return false
  if (config.fieldExposure !== 'whitelist') return false
  return config.whitelistFields === undefined || config.whitelistFields.length === 0
}

const checkWhitelistConsistency = (app: LooseApp): true | string => {
  const tableViolator = app.tables?.find((t) => isWhitelistMissingFields(t.aiAccess))
  if (tableViolator) {
    return `Table '${tableViolator.name}' has aiAccess.fieldExposure='whitelist' but no whitelistFields are listed`
  }

  const automationViolator = app.automations?.find((a) => isWhitelistMissingFields(a.aiAccess))
  if (automationViolator) {
    return `Automation '${automationViolator.name}' has aiAccess.fieldExposure='whitelist' but no whitelistFields are listed`
  }

  const actionViolator = app.actions?.find((a) => isWhitelistMissingFields(a.aiAccess))
  if (actionViolator) {
    return `Action template '${actionViolator.name}' has aiAccess.fieldExposure='whitelist' but no whitelistFields are listed`
  }

  return true
}

/**
 * Rule 3: User-defined tables must not use reserved 'auth_' / 'system_'
 * prefixes.
 *
 * These prefixes are claimed by auto-generated admin-only internal tools
 * (e.g. {appName}_auth_user_list, {appName}_system_audit_log_list); a
 * collision would silently shadow the internal tool with a user-defined one.
 */
const checkNoReservedTablePrefixes = (app: LooseApp): true | string => {
  if (!app.tables) return true

  const violator = app.tables.find((t) => isReservedInternalPrefix(t.name))
  if (violator) {
    return `Table '${violator.name}' uses a reserved prefix ('auth_' or 'system_'); rename to avoid collision with admin internals MCP tools`
  }
  return true
}

/**
 * Bundled AI/MCP validator. Runs all 3 rules in order; returns the first
 * error message encountered, or `true` if all pass.
 *
 * Called from a single `Schema.filter` in AppSchema to avoid blowing
 * TypeScript's deep-instantiation depth limit.
 */
export const validateAllAiAccessRules = (app: LooseApp): true | string => {
  const r1 = checkManualTriggerOnly(app)
  if (r1 !== true) return r1

  const r2 = checkWhitelistConsistency(app)
  if (r2 !== true) return r2

  const r3 = checkNoReservedTablePrefixes(app)
  if (r3 !== true) return r3

  return true
}
