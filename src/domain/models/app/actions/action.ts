/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, SchemaGetter } from 'effect'
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

/**
 * Strip the injected placeholder on the way back out.
 *
 * Typed on the shape it actually READS (a `name` string) rather than on
 * `Action`, because v4 hands the encode direction the ENCODED action, not the
 * decoded one — see the note on `ActionSchema` below. The body only ever
 * inspected `.name` and spread the rest, so it is representation-agnostic.
 */
const stripPlaceholderName = (action: { readonly name?: unknown }): unknown => {
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
/*
 * EFFECT 4 — `Schema.transform` becomes `Schema.decodeTo` + a
 * `SchemaTransformation` (migration/v3-to-v4.md:14284), and the ENCODE side
 * changes shape in a way worth stating: v3's `encode` received BOTH the encoded
 * and the decoded value `(toI, toA)` and this site used the DECODED one; v4's
 * receives only the encoded value. That is not a loss here — `stripPlaceholderName`
 * reads nothing but `.name`, and returning the encoded action from an encode
 * step is the more correct of the two (v3's form fed decoded values into an
 * `unknown` encoded slot).
 */
export const ActionSchema: Schema.Codec<Action, unknown> = Schema.Unknown.pipe(
  Schema.decodeTo(AutomationActionSchema, {
    decode: SchemaGetter.transform((value: unknown) => withPlaceholderName(value)),
    encode: SchemaGetter.transform((encoded: unknown) =>
      stripPlaceholderName(encoded as { readonly name?: unknown })
    ),
  }),
  Schema.annotate({
    identifier: 'ActionTemplateAction',
    title: 'Action Template Action',
    description:
      'An action configuration embedded in a reusable template. Same shape as an automation action minus the step name (supplied at the $ref call site).',
  })
) as Schema.Codec<Action, unknown>
