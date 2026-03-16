/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { MultipleAttachmentsFieldSchema } from './multiple-attachments-field'

describe('MultipleAttachmentsFieldSchema', () => {
  test('should accept valid multiple-attachments field', () => {
    // Given: A valid input
    const field = {
      id: 1,
      name: 'documents',
      type: 'multiple-attachments' as const,
      maxFiles: 5,
    }

    // When: The value is validated against the schema
    const result = Schema.decodeSync(MultipleAttachmentsFieldSchema)(field)

    // Then: Validation succeeds and the value is accepted
    expect(result).toEqual(field)
  })
})
