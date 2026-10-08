/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { HOST_ACTIONS_DISABLED_MESSAGE } from '@/domain/models/process-env/host-actions'

/**
 * The boot half of the `instance/*` operator gate (the other half is in every
 * handler). Two refusals, decided from the config and the switch alone:
 *
 * - the switch OFF and an `instance` step anywhere — refused with the sentence
 *   a handler answers, so the operator learns it at boot rather than at the
 *   first run;
 * - the switch ON and `code/runTypescript` anywhere — a step, an action
 *   template, or an agent granted the `code.runTypescript` tool — refused,
 *   with or without an instance step: a script reaches every handler through
 *   `context.actions`, so on a supervising host the sandbox would be the only
 *   thing between a config and the machine's process supervisor.
 *
 * "Anywhere" is every action reachable from the config: each automation's
 * actions, `app.actions` templates, and the steps nested in a `path` branch
 * (`props.paths[].actions`) or a `loop` (`props.actions`), at any depth.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A step found in the config, with where it was found. */
interface FoundStep {
  readonly where: string
  readonly key: string
}

/** Every step reachable from `value`; only the keys that nest steps are followed. */
const stepsOf = (value: unknown, where: string): readonly FoundStep[] => {
  if (Array.isArray(value)) return value.flatMap((item) => stepsOf(item, where))
  if (!isRecord(value)) return []
  const name = typeof value['name'] === 'string' ? value['name'] : '(unnamed)'
  const self =
    typeof value['type'] === 'string'
      ? [
          {
            where: `${where}, step '${name}'`,
            key: `${value['type']}/${String(value['operator'] ?? '')}`,
          },
        ]
      : []
  const props = isRecord(value['props']) ? value['props'] : {}
  const nested = [value['actions'], value['paths'], props['actions'], props['paths']].flatMap(
    (child) => stepsOf(child, where)
  )
  return [...self, ...nested]
}

const automationSteps = (app: RawRecord): readonly FoundStep[] =>
  (Array.isArray(app['automations']) ? app['automations'] : []).flatMap((automation) =>
    isRecord(automation)
      ? stepsOf(automation['actions'], `automation '${String(automation['name'] ?? '(unnamed)')}'`)
      : []
  )

const templateSteps = (app: RawRecord): readonly FoundStep[] =>
  (Array.isArray(app['actions']) ? app['actions'] : []).flatMap((template) =>
    isRecord(template)
      ? stepsOf(template, `action template '${String(template['name'] ?? '(unnamed)')}'`)
      : []
  )

/** Agents granted the code tool, as steps so one search covers every place code can run. */
const agentCodeTools = (app: RawRecord): readonly FoundStep[] =>
  (Array.isArray(app['agents']) ? app['agents'] : []).flatMap((agent) => {
    if (!isRecord(agent) || !isRecord(agent['tools'])) return []
    const { actions } = agent['tools']
    return Array.isArray(actions) && actions.includes('code.runTypescript')
      ? [
          {
            where: `agent '${String(agent['name'] ?? '(unnamed)')}', tools`,
            key: 'code/runTypescript',
          },
        ]
      : []
  })

/**
 * Why this config may not boot with the switch in this position, or
 * `undefined` when it may.
 */
export const hostActionsBootRefusal = (
  app: unknown,
  hostActionsEnabled: boolean
): string | undefined => {
  if (!isRecord(app)) return undefined
  const steps = [...automationSteps(app), ...templateSteps(app), ...agentCodeTools(app)]
  if (!hostActionsEnabled) {
    const instance = steps.find((step) => step.key.startsWith('instance/'))
    return instance === undefined
      ? undefined
      : `${HOST_ACTIONS_DISABLED_MESSAGE} (${instance.where} is ${instance.key})`
  }
  const code = steps.find((step) => step.key === 'code/runTypescript')
  return code === undefined
    ? undefined
    : `SOVRIUM_HOST_ACTIONS is on, so this app may not run code/runTypescript (${code.where}). A code step can call any action through context.actions, which on a supervising host would leave the sandbox as the only thing between a script and the host's process supervisor; run custom code in another app.`
}
