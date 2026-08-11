/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { CalculationFieldSchema } from './calculation'
import { SectionFieldSchema } from './section'
import { SignatureFieldSchema } from './signature'
import { StandaloneFieldSchema } from './standalone'
import { TableBoundFieldSchema } from './table-bound'

/**
 * Form Field — discriminated union of all field kinds.
 *
 * Each kind lives in its own file:
 * - `kind: 'table-field'`   → `./table-bound.ts`
 * - `kind: 'standalone'`    → `./standalone.ts`
 * - `kind: 'calculation'`   → `./calculation.ts`
 * - `kind: 'section'`       → `./section.ts`
 * - `kind: 'signature'`     → `./signature.ts`
 */
export const FormFieldSchema = Schema.Union(
  TableBoundFieldSchema,
  StandaloneFieldSchema,
  CalculationFieldSchema,
  SectionFieldSchema,
  SignatureFieldSchema
).annotations({
  identifier: 'FormField',
  title: 'Form Field',
  description:
    'A single form field. Discriminated by `kind`: table-field, standalone, calculation, section, or signature.',
})

export type FormField = Schema.Schema.Type<typeof FormFieldSchema>

export * from './calculation'
export * from './section'
export * from './signature'
export * from './standalone'
export * from './table-bound'
