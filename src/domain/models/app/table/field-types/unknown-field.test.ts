/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'
import { UnknownFieldSchema } from './unknown-field'

describe('UnknownFieldSchema', () => {
  it('should accept any string as field type', () => {
    const result = Schema.decodeUnknownSync(UnknownFieldSchema)({
      id: 1,
      name: 'test_field',
      type: 'INVALID_TYPE',
    })

    expect(result).toEqual({
      id: 1,
      name: 'test_field',
      type: 'INVALID_TYPE',
    })
  })

  it('should accept standard field types', () => {
    const result = Schema.decodeUnknownSync(UnknownFieldSchema)({
      id: 2,
      name: 'email',
      type: 'email',
    })

    expect(result).toEqual({
      id: 2,
      name: 'email',
      type: 'email',
    })
  })

  it('should require id, name, and type', () => {
    expect(() =>
      Schema.decodeUnknownSync(UnknownFieldSchema)({
        name: 'test',
        type: 'unknown',
      })
    ).toThrow()

    expect(() =>
      Schema.decodeUnknownSync(UnknownFieldSchema)({
        id: 1,
        type: 'unknown',
      })
    ).toThrow()

    expect(() =>
      Schema.decodeUnknownSync(UnknownFieldSchema)({
        id: 1,
        name: 'test',
      })
    ).toThrow()
  })

  it('should support optional base field properties', () => {
    const result = Schema.decodeUnknownSync(UnknownFieldSchema)({
      id: 3,
      name: 'custom_field',
      type: 'CUSTOM_TYPE',
      required: true,
      unique: true,
      indexed: true,
    })

    expect(result).toEqual({
      id: 3,
      name: 'custom_field',
      type: 'CUSTOM_TYPE',
      required: true,
      unique: true,
      indexed: true,
    })
  })
})
