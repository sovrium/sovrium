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

/**
 * Synthetic step name injected into a template's `action` body during
 * validation. Action variant schemas require a `name` field (from
 * `ActionBaseFields`) since within an automation the step name is how
 * outputs are referenced. A reusable template, by contrast, is nameless —
 * the step name comes from the `$ref` call site
 * (`{ name: 'alert', $ref: 'notify-admin' }`). To validate the template's
 * action body against the canonical `ActionSchema` union we inject this
 * placeholder when absent, then strip it on encode.
 */
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

/**
 * Action property for ActionTemplate.
 *
 * Accepts any action type from the automation action union (code, http,
 * record, email, etc.) but does NOT require a `name` field — the step name
 * is supplied at the `$ref` call site, not in the template definition.
 *
 * @see {@link AutomationActionSchema} from `@/domain/models/app/automations/actions`
 */
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
