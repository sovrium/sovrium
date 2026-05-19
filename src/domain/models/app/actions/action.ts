/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  ActionSchema as AutomationActionSchema,
  type Action,
} from '@/domain/models/app/automations/actions'

export { type Action } from '@/domain/models/app/automations/actions'

const TEMPLATE_ACTION_PLACEHOLDER_NAME = 'templateAction'

const withPlaceholderName = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  const obj = value as Record<string, unknown>
  if (typeof obj['name'] === 'string' && obj['name'].length > 0) return obj
  return { ...obj, name: TEMPLATE_ACTION_PLACEHOLDER_NAME }
}

const stripPlaceholderName = (action: Action): unknown => {
  if (action.name !== TEMPLATE_ACTION_PLACEHOLDER_NAME) return action
  const { name: _name, ...rest } = action as unknown as Record<string, unknown>
  return rest
}

export const ActionSchema: Schema.Schema<Action, unknown> = Schema.transform(
  Schema.Unknown,
  AutomationActionSchema,
  {
    strict: false,
    decode: (value: unknown) => withPlaceholderName(value),
    encode: (_toI: unknown, action: Action) => stripPlaceholderName(action),
  }
).pipe(
  Schema.annotations({
    identifier: 'ActionTemplateAction',
    title: 'Action Template Action',
    description:
      'An action configuration embedded in a reusable template. Same shape as an automation action minus the step name (supplied at the $ref call site).',
  })
) as Schema.Schema<Action, unknown>
