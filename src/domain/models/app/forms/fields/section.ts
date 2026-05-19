/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { VisibleWhenSchema } from '../../../shared/visible-when'

export const SectionFieldSchema = Schema.Struct({
  kind: Schema.Literal('section'),
  heading: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  visibleWhen: Schema.optional(VisibleWhenSchema),
}).annotations({
  identifier: 'SectionField',
  title: 'Section Divider',
  description: 'Visual section divider with an optional heading and description',
})

export type SectionField = Schema.Schema.Type<typeof SectionFieldSchema>
