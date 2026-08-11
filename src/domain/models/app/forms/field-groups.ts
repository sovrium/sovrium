/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { VisibleWhenSchema } from '../../shared/visible-when'

/**
 * Form Field Group
 *
 * Groups form fields under a labeled section divider in single-page layouts.
 * Both the top-level forms (`forms[]`) and the legacy in-page form component
 * use this primitive.
 */
export const FormFieldGroupSchema = Schema.Struct({
  /** Group label displayed as a section divider above the fields. */
  label: Schema.String.pipe(Schema.minLength(1)).annotations({
    description: 'Group label displayed as a section divider above the fields',
  }),
  /** Field names belonging to this group. */
  fields: Schema.Array(Schema.String).pipe(Schema.minItems(1)).annotations({
    description: 'Array of field names belonging to this group',
  }),
  /**
   * Optional visibility rule. When set and the rule evaluates false, the entire
   * group (label + every field listed under it) is hidden at render time.
   * Mirrors `FormStepSchema.visibleWhen` so that authors can use the same
   * condition primitive in single-page (groups) and multi-step (steps) layouts.
   */
  visibleWhen: Schema.optional(VisibleWhenSchema),
}).annotations({
  identifier: 'FormFieldGroup',
  title: 'Form Field Group',
  description: 'Groups form fields under a labeled section divider',
})

/** @public */
export type FormFieldGroup = Schema.Schema.Type<typeof FormFieldGroupSchema>
