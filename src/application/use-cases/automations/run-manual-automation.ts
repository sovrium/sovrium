/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
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

const connectionScope = (conn: Readonly<Record<string, unknown>>): 'user' | 'app' => {
  if (conn['type'] !== 'oauth2') return 'app'
  const props = conn['props'] as Record<string, unknown> | undefined
  return props !== undefined && props['scope'] === 'user' ? 'user' : 'app'
}

const referencedConnectionName = (
  action: Readonly<Record<string, unknown>>
): string | undefined => {
  const { props } = action as { props?: Record<string, unknown> }
  if (props === undefined) return undefined
  const connName = props['connection']
  return typeof connName === 'string' && connName !== '' ? connName : undefined
}

export const usesUserScopedConnection = (
  automation: NonNullable<App['automations']>[number],
  app: App
): boolean => {
  const { connections } = app as { connections?: readonly Record<string, unknown>[] }
  if (connections === undefined || connections.length === 0) return false

  const scopeByName = new Map<string, 'user' | 'app'>(
    connections
      .filter((conn) => String(conn['name'] ?? '') !== '')
      .map((conn) => [String(conn['name']), connectionScope(conn)] as const)
  )

  const connectionRefs = (
    automation.actions as readonly unknown[] as readonly Readonly<Record<string, unknown>>[]
  )
    .map(referencedConnectionName)
    .filter((name): name is string => name !== undefined)
    .map((name) => scopeByName.get(name) ?? 'app')

  if (connectionRefs.some((scope) => scope === 'app')) return false
  return connectionRefs.some((scope) => scope === 'user')
}

const resolveManualAutomation = (
  app: App,
  name: string
): Effect.Effect<NonNullable<App['automations']>[number], RunAutomationError> => {
  const automation = app.automations?.find((a) => a.name === name)
  if (!automation) return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  if (automation.enabled === false)
    return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  if (automation.trigger.type !== 'manual') {
    return Effect.fail({ _tag: 'AutomationNotManualTriggered' as const, name })
  }
  return Effect.succeed(automation)
}

export interface RunManualAutomationOptions {
  readonly name: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly userRole: string | undefined
  readonly triggerData?: TriggerData
  readonly handlers?: ReadonlyMap<ActionKey, ActionHandler>
  readonly userId?: string
}

export const runManualAutomation = ({
  name,
  app,
  processEnv,
  userRole,
  triggerData = {},
  handlers = defaultActionHandlers,
  userId,
}: RunManualAutomationOptions): Effect.Effect<
  RunAutomationResult,
  RunAutomationError,
  ExecuteAutomationRunRequirements
> =>
  Effect.gen(function* () {
    const automation = yield* resolveManualAutomation(app, name)

    const explicitRole =
      automation.trigger.type === 'manual' ? automation.trigger.requiredRole : undefined
    const defaultRole = usesUserScopedConnection(automation, app) ? 'member' : 'admin'
    const requiredRole = explicitRole ?? defaultRole
    const callerSatisfiesRole = userRole === requiredRole || userRole === 'admin'
    if (!callerSatisfiesRole) {
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
    })
  })
