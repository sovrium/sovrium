/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { commonFieldProps } from '../form-field-props'

/**
 * Calculation field — read-only computed value derived from other fields.
 *
 * The formula is ONE template expression in the same `{{...}}` grammar the
 * automation templates use — a bare field name (`{{quantity}}`) or a helper
 * call over sibling field names (`{{round (multiply quantity unit_price) 2}}`).
 * There is no separate formula language. The browser recomputes the value as
 * its inputs change; the server recomputes it from the submitted inputs and
 * refuses a submission whose value disagrees.
 */
const SINGLE_TEMPLATE_EXPRESSION = /^\s*\{\{[^{}]+\}\}\s*$/
export const CalculationFieldSchema = Schema.Struct({
  kind: Schema.Literal('calculation').annotate({
    description: 'Which kind of field this is. It decides which of the other keys apply.',
  }),
  name: Schema.String.annotate({
    description:
      'Identifier for this field within the form; it is the key the answer is stored and reported under.',
  }).pipe(Schema.check(Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/))),
  /** Formula — one `{{...}}` template expression over sibling field names. */
  formula: Schema.String.annotate({
    description:
      'One template expression computing the value from other fields of the form, written in the `{{...}}` template grammar: a field name such as `{{quantity}}`, or a helper applied to field names such as `{{multiply quantity unit_price}}` or `{{round (divide total guests) 2}}`. Only the number helpers are available.',
  }).pipe(Schema.check(Schema.isMinLength(1), Schema.isPattern(SINGLE_TEMPLATE_EXPRESSION))),
  /** Output format hint for the renderer. */
  format: Schema.optional(
    Schema.Literals(['number', 'currency', 'percent', 'text']).annotate({
      description:
        'How the computed value is displayed: a plain number, a currency amount, a percentage, or text.',
    })
  ),
  ...commonFieldProps,
}).annotate({
  identifier: 'CalculationField',
  title: 'Calculation Field',
  description: 'Read-only computed field derived from other fields via a formula',
})

/** @public */
export type CalculationField = Schema.Schema.Type<typeof CalculationFieldSchema>
