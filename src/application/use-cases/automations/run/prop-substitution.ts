/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { resolveEnvInValue } from '../resolve-env-vars'
import { resolveTriggerInValue } from '../resolve-trigger-data'
import type { RuntimeActionTemplate, StepContext } from './types'
import type { App } from '@/domain/models/app'

export const findTemplate = (app: App, name: string): RuntimeActionTemplate | undefined =>
  (app.actions as unknown as ReadonlyArray<RuntimeActionTemplate> | undefined)?.find(
    (t) => t.name === name
  )

export const resolveActionPropsForDispatch = (
  action: Readonly<Record<string, unknown>>,
  ctx: StepContext
): Record<string, unknown> => {
  const isCode = String(action['type'] ?? '') === 'code'
  const subProps = (action['props'] as Record<string, unknown> | undefined) ?? {}
  const subWithTriggers = isCode
    ? subProps
    : (resolveTriggerInValue(subProps, ctx.templateContext) as Record<string, unknown>)
  return resolveEnvInValue(subWithTriggers, ctx.envLookup) as Record<string, unknown>
}
