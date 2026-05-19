/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { VisibleWhenSchema } from '../../shared/visible-when'

export const FormFieldGroupSchema = Schema.Struct({
  label: Schema.String.pipe(Schema.minLength(1)).annotations({
    description: 'Group label displayed as a section divider above the fields',
  }),
  fields: Schema.Array(Schema.String).pipe(Schema.minItems(1)).annotations({
    description: 'Array of field names belonging to this group',
  }),
  visibleWhen: Schema.optional(VisibleWhenSchema),
}).annotations({
  identifier: 'FormFieldGroup',
  title: 'Form Field Group',
  description: 'Groups form fields under a labeled section divider',
})

export type FormFieldGroup = Schema.Schema.Type<typeof FormFieldGroupSchema>
