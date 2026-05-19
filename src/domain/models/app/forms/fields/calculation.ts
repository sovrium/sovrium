/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { commonFieldProps } from '../../../shared/form-field-props'

export const CalculationFieldSchema = Schema.Struct({
  kind: Schema.Literal('calculation'),
  name: Schema.String.pipe(Schema.pattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/)),
  formula: Schema.String.pipe(Schema.minLength(1)),
  format: Schema.optional(Schema.Literal('number', 'currency', 'percent', 'text')),
  ...commonFieldProps,
}).annotations({
  identifier: 'CalculationField',
  title: 'Calculation Field',
  description: 'Read-only computed field derived from other fields via a formula',
})

export type CalculationField = Schema.Schema.Type<typeof CalculationFieldSchema>
