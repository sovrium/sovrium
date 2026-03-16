/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { SingleAttachmentFieldSchema } from './single-attachment-field'

describe('SingleAttachmentFieldSchema', () => {
  test('should accept valid single-attachment field', () => {
    // Given: A valid input
    const field = { id: 1, name: 'profile_pic', type: 'single-attachment' as const }

    // When: The value is validated against the schema
    const result = Schema.decodeSync(SingleAttachmentFieldSchema)(field)

    // Then: Validation succeeds and the value is accepted
    expect(result).toEqual(field)
  })
})
