/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FormNameSchema } from '../../forms/name'

export const FormTriggerSchema = Schema.Struct({
  type: Schema.Literal('form'),
  form: FormNameSchema,
}).pipe(
  Schema.annotations({
    identifier: 'FormTrigger',
    title: 'Form Trigger',
    description:
      'Trigger automation when a top-level form is submitted. The `form` property references forms[].name (HARD BREAK: was a page path).',
  })
)

export type FormTrigger = Schema.Schema.Type<typeof FormTriggerSchema>
