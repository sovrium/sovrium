/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { VisibleWhenSchema } from '../../../shared/visible-when'

/**
 * Section field — visual divider with an optional label and description.
 * Renders no input; used to break long forms into themed groups.
 */
export const SectionFieldSchema = Schema.Struct({
  kind: Schema.Literal('section'),
  /** Section heading. */
  heading: Schema.optional(Schema.String),
  /** Section description / intro paragraph. */
  description: Schema.optional(Schema.String),
  /** Visibility rule for the entire section. */
  visibleWhen: Schema.optional(VisibleWhenSchema),
}).annotations({
  identifier: 'SectionField',
  title: 'Section Divider',
  description: 'Visual section divider with an optional heading and description',
})

/** @public */
export type SectionField = Schema.Schema.Type<typeof SectionFieldSchema>
