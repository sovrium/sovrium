/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'

const ALLOWED_TRIGGER_KEYS: Readonly<Record<string, ReadonlySet<string>>> = {
  webhook: new Set([
    'type',
    'method',
    'secret',
    'respondImmediately',
    'auth',
    'response',
    'requestSchema',
    'querySchema',
    'rateLimit',
    'deduplicationKey',
    'deduplicationWindow',
  ]),
  cron: new Set(['type', 'expression', 'timezone']),
  record: new Set(['type', 'table', 'events', 'watchFields', 'condition']),
  auth: new Set(['type', 'events']),
  form: new Set(['type', 'form']),
  manual: new Set(['type', 'label', 'inputSchema', 'requiredRole']),
  'automation-call': new Set(['type', 'inputSchema']),
  'automation-failure': new Set(['type', 'automations']),
  comment: new Set(['type', 'table', 'events', 'when', 'filter', 'respectReadPermissions']),
}

interface RawTrigger {
  readonly type?: unknown
  readonly [key: string]: unknown
}

interface RawAutomation {
  readonly name?: unknown
  readonly trigger?: RawTrigger
  readonly [key: string]: unknown
}

interface RawApp {
  readonly automations?: ReadonlyArray<RawAutomation>
  readonly [key: string]: unknown
}

export const validateTriggerConfigs = (app: unknown): Effect.Effect<void, string> => {
  if (typeof app !== 'object' || app === null) return Effect.void
  const { automations } = app as RawApp
  if (!Array.isArray(automations)) return Effect.void

  const errors = automations
    .filter(
      (a): a is RawAutomation & { readonly trigger: RawTrigger } =>
        typeof a === 'object' && a !== null && typeof a.trigger === 'object' && a.trigger !== null
    )
    .flatMap((automation) => {
      const { trigger } = automation
      const triggerType = typeof trigger.type === 'string' ? trigger.type : undefined
      if (triggerType === undefined) return []
      const allowed = ALLOWED_TRIGGER_KEYS[triggerType]
      if (allowed === undefined) return []
      const automationName = typeof automation.name === 'string' ? automation.name : '<unnamed>'
      return Object.keys(trigger)
        .filter((key) => !allowed.has(key))
        .map(
          (unknownKey) =>
            `Automation '${automationName}' ${triggerType} trigger has unknown property '${unknownKey}'. Allowed properties: ${Array.from(allowed).toSorted().join(', ')}`
        )
    })

  const firstError = errors.at(0)
  return firstError === undefined ? Effect.void : Effect.fail(firstError)
}
