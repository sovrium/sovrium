/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import type {
  UserMetadata,
  UserMetadataWithImage,
  UserMetadataWithOptionalImage,
} from './user-metadata'

describe('UserMetadata types', () => {
  test('UserMetadata accepts core user fields', () => {
    const user: UserMetadata = { id: '1', name: 'Alice', email: 'alice@example.com' }
    expect(user.id).toBe('1')
    expect(user.name).toBe('Alice')
    expect(user.email).toBe('alice@example.com')
  })

  test('UserMetadataWithImage extends UserMetadata with nullable image', () => {
    const withImage: UserMetadataWithImage = {
      id: '1',
      name: 'Alice',
      email: 'alice@example.com',
      image: 'https://example.com/avatar.png',
    }
    expect(withImage.image).toBe('https://example.com/avatar.png')

    const withNull: UserMetadataWithImage = {
      id: '2',
      name: 'Bob',
      email: 'bob@example.com',
      image: null,
    }
    expect(withNull.image).toBeNull()
  })

  test('UserMetadataWithOptionalImage excludes null from image', () => {
    const withUndefined: UserMetadataWithOptionalImage = {
      id: '1',
      name: 'Alice',
      email: 'alice@example.com',
      image: undefined,
    }
    expect(withUndefined.image).toBeUndefined()
  })
})
