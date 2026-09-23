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
 * The formula references other field names via `{{fieldName}}` template syntax.
 */
export const CalculationFieldSchema = Schema.Struct({
  kind: Schema.Literal('calculation').annotate({
    description: 'Which kind of field this is. It decides which of the other keys apply.',
  }),
  name: Schema.String.annotate({
    description:
      'Identifier for this field within the form; it is the key the answer is stored and reported under.',
  }).pipe(Schema.check(Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/))),
  /** Formula expression — references other fields via {name} syntax. */
  formula: Schema.String.annotate({
    description:
      'Expression computing the value, referring to other fields of the form as `{{fieldName}}`.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
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
