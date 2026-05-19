/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const PageIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.annotations({
    identifier: 'PageId',
    title: 'Page ID',
    description: 'Unique identifier for the page',
    examples: ['homepage', 'about-us', 'contact-form-123', '550e8400-e29b-41d4-a716-446655440000'],
  })
)

export type PageId = typeof PageIdSchema.Type
