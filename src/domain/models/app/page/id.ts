/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Page ID (unique identifier for the page)
 *
 * Unlike database entity IDs which are auto-incrementing integers, page IDs are
 * user-defined strings for human-readable identification and routing purposes.
 *
 * Valid formats:
 * - Kebab-case: 'home-page', 'about-us'
 * - Simple: 'homepage', 'contact'
 * - UUIDs: '550e8400-e29b-41d4-a716-446655440000'
 * - Numeric strings: '12345'
 *
 * Page IDs must be unique within the pages array.
 *
 * @example
 * ```typescript
 * const pageId1 = 'homepage'
 * const pageId2 = 'about-us'
 * const pageId3 = 'contact-form-123'
 * const pageId4 = '550e8400-e29b-41d4-a716-446655440000' // UUID
 * ```
 *
 * @see specs/app/pages/id/id.schema.json
 */
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
