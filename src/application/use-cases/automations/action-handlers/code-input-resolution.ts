/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTriggerInString, resolveTriggerInValue } from '../resolve-trigger-data'

const PURE_TEMPLATE_PATTERN = /^\s*\{\{[\s\S]+?\}\}\s*$/

const coerceTrimmedScalar = (trimmed: string): unknown => {
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed)
    if (Number.isFinite(n) && String(n) === trimmed) return n
    return undefined
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as unknown
    } catch {
      return undefined
    }
  }
  return undefined
}

const reTypeRenderedValue = (original: string, rendered: string): unknown => {
  if (!PURE_TEMPLATE_PATTERN.test(original)) return rendered
  const trimmed = rendered.trim()
  if (trimmed === '') return rendered
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  const coerced = coerceTrimmedScalar(trimmed)
  return coerced !== undefined ? coerced : rendered
}

export const resolveCodeInputData = (
  rawInputData: Readonly<Record<string, unknown>>,
  context: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(rawInputData).map(([key, value]) => {
      if (typeof value === 'string') {
        const rendered = resolveTriggerInString(value, context)
        return [key, reTypeRenderedValue(value, rendered)] as const
      }
      return [key, resolveTriggerInValue(value, context)] as const
    })
  )
