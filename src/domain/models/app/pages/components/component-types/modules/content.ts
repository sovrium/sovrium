/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ContentSchema = Schema.Union(
  Schema.String,
  Schema.Record({ key: Schema.String, value: Schema.Unknown })
).annotations({
  description:
    'Text content for text components, or structured content object (e.g., { button: { text, animation } })',
})

/**
 * Content field for components that display text or structured content.
 */
export const contentFields = {
  content: Schema.optional(ContentSchema),
} as const
