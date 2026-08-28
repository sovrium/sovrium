/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prop-substitution glue for the automation run loop.
 *
 * Extracted from `run-automation.ts` (P1.2 decomposition). Resolves
 * `{{trigger.X}}` and `$env.X` references in an action's props before the
 * action handler sees them, and looks up named templates from `app.actions[]`.
 */

import { resolveEnvInValue } from '../resolve-env-vars'
import { resolveTriggerInValue } from '../resolve-trigger-data'
import type { RuntimeActionTemplate, StepContext } from './types'
import type { App } from '@/domain/models/app'

/**
 * Locate a named template entry in `app.actions[]`. Returns undefined when
 * no template by that name is declared.
 */
export const findTemplate = (app: App, name: string): RuntimeActionTemplate | undefined =>
  (app.actions as unknown as ReadonlyArray<RuntimeActionTemplate> | undefined)?.find(
    (t) => t.name === name
  )

/**
 * Resolve a template-substituted action body for handler dispatch.
 * `code` actions skip the trigger-template pass — their inner sandbox
 * re-resolves `inputData` against its own context. All other action
 * types get `{{trigger.X}}` and `$env.X` resolution before the handler
 * sees them, matching top-level-step behaviour.
 */
export const resolveActionPropsForDispatch = (
  action: Readonly<Record<string, unknown>>,
  ctx: StepContext
): Readonly<Record<string, unknown>> => {
  const isCode = String(action['type'] ?? '') === 'code'
  const subProps = (action['props'] as Record<string, unknown> | undefined) ?? {}
  const subWithTriggers = isCode
    ? subProps
    : (resolveTriggerInValue(subProps, ctx.templateContext) as Record<string, unknown>)
  return resolveEnvInValue(subWithTriggers, ctx.envLookup) as Record<string, unknown>
}
