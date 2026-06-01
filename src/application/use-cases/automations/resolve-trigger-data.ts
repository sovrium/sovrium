/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderTemplate } from '@/infrastructure/templates/template-engine'
import { mapStringsDeep } from './value-walker'

export interface TriggerData {
  readonly body?: unknown
  readonly headers?: Readonly<Record<string, unknown>>
  readonly query?: Readonly<Record<string, unknown>>
  readonly method?: string
  readonly path?: string
  readonly ip?: string
  readonly input?: unknown
  readonly caller?: string
  readonly depth?: number
  readonly type?: string
  readonly firedAt?: string
  readonly record?: Readonly<Record<string, unknown>>
  readonly previousRecord?: Readonly<Record<string, unknown>>
  readonly records?: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly comment?: Readonly<Record<string, unknown>>
  readonly threadParticipants?: readonly string[]
  readonly mentions?: readonly string[]
  readonly user?: Readonly<Record<string, unknown>>
  readonly event?: string
}

const SIMPLE_TEMPLATE_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g

export const lookupPath = (context: Readonly<Record<string, unknown>>, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, segment) => {
    if (acc === undefined || acc === null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[segment]
  }, context)

const formatValue = (value: unknown): string => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return String(value)
}

export const resolveTriggerInString = (
  input: string,
  context: Readonly<Record<string, unknown>>
): string => {
  if (!input.includes('{{')) return input
  const rendered = renderTemplate(input, context)
  if (rendered !== input) return rendered
  return input.replace(SIMPLE_TEMPLATE_PATTERN, (_match, path: string) =>
    formatValue(lookupPath(context, path))
  )
}

export const resolveTriggerInValue = (
  value: unknown,
  context: Readonly<Record<string, unknown>>
): unknown => mapStringsDeep(value, (s) => resolveTriggerInString(s, context))

export const buildAutomationContext = (
  triggerData: TriggerData
): Readonly<Record<string, unknown>> => {
  const td = triggerData as Readonly<Record<string, unknown>>
  const { body } = td
  const fromBody: Record<string, unknown> =
    body !== undefined && body !== null && typeof body === 'object'
      ? { ...(body as Record<string, unknown>) }
      : {}
  const envelopeAdditions = Object.fromEntries(
    Object.keys(td)
      .filter((key) => td[key] !== undefined && !(key in fromBody))
      .map((key) => [key, td[key]] as const)
  )
  const TOPLEVEL_KEYS = [
    'comment',
    'threadParticipants',
    'mentions',
    'input',
    'caller',
    'depth',
  ] as const
  const triggerTopLevel = Object.fromEntries(
    TOPLEVEL_KEYS.filter((key) => td[key] !== undefined).map((key) => [key, td[key]] as const)
  )
  return {
    trigger: {
      data: { ...fromBody, ...envelopeAdditions },
      ...triggerTopLevel,
    },
  }
}
