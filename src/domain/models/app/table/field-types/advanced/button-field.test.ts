/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { ButtonFieldSchema } from './button-field'

describe('ButtonFieldSchema', () => {
  test('should accept valid button field with automation action', () => {
    // Given: A valid input
    const field = {
      id: 1,
      name: 'approve',
      type: 'button' as const,
      label: 'Approve',
      action: 'automation',
      automation: 'approve_request',

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }
    const result = Schema.decodeSync(ButtonFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should accept valid button field with url action', () => {
    const field = {
      id: 2,
      name: 'open_link',
      type: 'button' as const,
      label: 'Open',
      action: 'url',
      url: 'https://example.com',
    }
    const result = Schema.decodeSync(ButtonFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should accept valid button field with custom action', () => {
    const field = {
      id: 3,
      name: 'custom_action',
      type: 'button' as const,
      label: 'Custom',
      action: 'customAction',
    }
    const result = Schema.decodeSync(ButtonFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should reject button field with url action but missing url', () => {
    const field = {
      id: 4,
      name: 'broken_link',
      type: 'button' as const,
      label: 'Open',
      action: 'url',
    }
    expect(() => Schema.decodeSync(ButtonFieldSchema)(field)).toThrow(
      /url is required when action is url/i
    )
  })

  test('should reject button field with automation action but missing automation', () => {
    const field = {
      id: 5,
      name: 'broken_automation',
      type: 'button' as const,
      label: 'Run',
      action: 'automation',
    }
    expect(() => Schema.decodeSync(ButtonFieldSchema)(field)).toThrow(
      /automation is required when action is automation/i
    )
  })
})
