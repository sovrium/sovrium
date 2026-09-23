/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { VisibleWhenSchema } from '../visible-when'

/**
 * Section field — visual divider with an optional label and description.
 * Renders no input; used to break long forms into themed groups.
 */
export const SectionFieldSchema = Schema.Struct({
  kind: Schema.Literal('section').annotate({
    description: 'Which kind of field this is. It decides which of the other keys apply.',
  }),
  /** Section heading. */
  heading: Schema.optional(
    Schema.String.annotate({ description: 'Heading announcing this group of fields.' })
  ),
  /** Section description / intro paragraph. */
  description: Schema.optional(
    Schema.String.annotate({
      description: 'Introductory paragraph shown under the section heading.',
    })
  ),
  /** Visibility rule for the entire section. */
  visibleWhen: Schema.optional(VisibleWhenSchema),
}).annotate({
  identifier: 'SectionField',
  title: 'Section Divider',
  description: 'Visual section divider with an optional heading and description',
})

/** @public */
export type SectionField = Schema.Schema.Type<typeof SectionFieldSchema>
