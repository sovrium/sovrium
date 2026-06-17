/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'


const isCloudModeEnabled = (env: Readonly<NodeJS.ProcessEnv>): boolean => {
  const flag = env.SOVRIUM_CLOUD_MODE
  return typeof flag === 'string' && flag.trim().length > 0
}

const collectCloudActionNames = (actions: unknown): readonly string[] => {
  if (!Array.isArray(actions)) return []
  return actions.flatMap((action: unknown): readonly string[] => {
    if (typeof action !== 'object' || action === null) return []
    const a = action as Record<string, unknown>
    const self = a.type === 'cloud' ? [typeof a.name === 'string' ? a.name : '<unnamed>'] : []

    const props = a.props as Record<string, unknown> | undefined
    const loopNested = props ? collectCloudActionNames(props.actions) : []
    const pathNested = Array.isArray(props?.paths)
      ? props.paths.flatMap((branch: unknown) =>
          typeof branch === 'object' && branch !== null
            ? collectCloudActionNames((branch as Record<string, unknown>).actions)
            : []
        )
      : []

    return [...self, ...loopNested, ...pathNested]
  })
}

const detectGatedCloudActions = (
  parsed: unknown,
  env: Readonly<NodeJS.ProcessEnv>
): readonly string[] => {
  if (isCloudModeEnabled(env)) return []

  const { automations } = (parsed ?? {}) as Record<string, unknown>
  if (!Array.isArray(automations)) return []

  return automations.flatMap((automation: unknown): readonly string[] => {
    if (typeof automation !== 'object' || automation === null) return []
    const auto = automation as Record<string, unknown>
    const automationName = typeof auto.name === 'string' ? auto.name : '<unnamed>'
    return collectCloudActionNames(auto.actions).map(
      (actionName) =>
        `Action "${actionName}" in automation "${automationName}" uses "type: cloud", which requires the Sovrium Cloud host gate (SOVRIUM_CLOUD_MODE). This config is not running in cloud mode.`
    )
  })
}

export const validateCloudGate = (
  parsed: unknown,
  env: Readonly<NodeJS.ProcessEnv> = process.env
): Effect.Effect<void, AppValidationError, never> => {
  const errors = detectGatedCloudActions(parsed, env)
  if (errors.length === 0) return Effect.void
  return Effect.fail(new AppValidationError(errors.join('\n')))
}
