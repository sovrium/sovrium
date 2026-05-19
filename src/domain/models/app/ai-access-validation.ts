/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isReservedInternalPrefix } from '../shared/internal-tables'


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

const aiAccessIsDeclared = (access: LooseAiAccess | undefined): boolean => {
  if (access === undefined) return false
  if (typeof access === 'boolean') return access
  return true
}

const aiAccessConfig = (
  access: LooseAiAccess | undefined
):
  | { readonly fieldExposure?: string; readonly whitelistFields?: ReadonlyArray<string> }
  | undefined => {
  if (access === undefined || typeof access === 'boolean') return undefined
  return access
}

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

const checkNoReservedTablePrefixes = (app: LooseApp): true | string => {
  if (!app.tables) return true

  const violator = app.tables.find((t) => isReservedInternalPrefix(t.name))
  if (violator) {
    return `Table '${violator.name}' uses a reserved prefix ('auth_' or 'system_'); rename to avoid collision with admin internals MCP tools`
  }
  return true
}

export const validateAllAiAccessRules = (app: LooseApp): true | string => {
  const r1 = checkManualTriggerOnly(app)
  if (r1 !== true) return r1

  const r2 = checkWhitelistConsistency(app)
  if (r2 !== true) return r2

  const r3 = checkNoReservedTablePrefixes(app)
  if (r3 !== true) return r3

  return true
}
