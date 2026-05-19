/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildAutomationContext, lookupPath, resolveTriggerInString } from '../resolve-trigger-data'
import type { ActionRunContext } from './shared'


const SIMPLE_PATH = /^\{\{\s*([\w.]+)\s*\}\}$/

export const resolveRunContextValue = (
  value: unknown,
  context: Readonly<Record<string, unknown>>
): unknown => {
  if (typeof value === 'string') {
    const whole = SIMPLE_PATH.exec(value.trim())
    return whole !== null
      ? lookupPath(context, whole[1] as string)
      : resolveTriggerInString(value, context)
  }
  if (Array.isArray(value)) return value.map((v) => resolveRunContextValue(v, context))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        resolveRunContextValue(v, context),
      ])
    )
  }
  return value
}

export const rawActionProps = (runContext: ActionRunContext): Readonly<Record<string, unknown>> => {
  const ra = (runContext.rawAction ?? {}) as Readonly<Record<string, unknown>>
  return (ra['props'] ?? {}) as Readonly<Record<string, unknown>>
}

export const buildRunContextView = (
  runContext: ActionRunContext
): Readonly<Record<string, unknown>> => ({
  ...runContext.previousSteps,
  ...buildAutomationContext(runContext.triggerData as never),
  steps: runContext.previousSteps,
})

export const asArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [])
