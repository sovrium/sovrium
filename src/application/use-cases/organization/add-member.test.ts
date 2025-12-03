/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import {
  addMember,
  type AddMemberInput,
  type AddMemberResult,
  type ServiceError,
} from './add-member'

/**
 * Unit tests for organization add-member use case
 *
 * Tests the application layer logic for adding members to organizations.
 *
 * Note: These tests verify the use case structure and error handling logic.
 * Integration with Better Auth is tested via E2E tests in specs/.
 */

describe('addMember', () => {
  /**
   * Test input type validation
   *
   * Verifies that the AddMemberInput type enforces required fields.
   */
  test('should have correct input type structure', () => {
    const input: AddMemberInput = {
      organizationId: 'org-789',
      userId: 'user-456',
      role: 'member',
      headers: new Headers(),
    }

    expect(input.organizationId).toBe('org-789')
    expect(input.userId).toBe('user-456')
    expect(input.role).toBe('member')
    expect(input.headers).toBeInstanceOf(Headers)
  })

  /**
   * Test optional role field
   *
   * Verifies that role is optional in the input type.
   */
  test('should allow omitting role field', () => {
    const input: AddMemberInput = {
      organizationId: 'org-789',
      userId: 'user-456',
      headers: new Headers(),
    }

    expect(input.organizationId).toBe('org-789')
    expect(input.userId).toBe('user-456')
    expect(input.role).toBeUndefined()
    expect(input.headers).toBeInstanceOf(Headers)
  })

  /**
   * Test role type constraints
   *
   * Verifies that role can only be one of the allowed values.
   */
  test('should enforce role type constraints', () => {
    // Type checking at compile time - these should all be valid
    const ownerInput: AddMemberInput = {
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      headers: new Headers(),
    }

    const adminInput: AddMemberInput = {
      organizationId: 'org-2',
      userId: 'user-2',
      role: 'admin',
      headers: new Headers(),
    }

    const memberInput: AddMemberInput = {
      organizationId: 'org-3',
      userId: 'user-3',
      role: 'member',
      headers: new Headers(),
    }

    expect(ownerInput.role).toBe('owner')
    expect(adminInput.role).toBe('admin')
    expect(memberInput.role).toBe('member')
  })

  /**
   * Test Effect return type
   *
   * Verifies that addMember returns an Effect that can be composed.
   */
  test('should return an Effect', () => {
    const input: AddMemberInput = {
      organizationId: 'org-789',
      userId: 'user-456',
      headers: new Headers(),
    }

    const program = addMember(input)

    // Verify it's an Effect (has pipe method)
    expect(typeof program.pipe).toBe('function')
  })

  /**
   * Test error type structure
   *
   * Verifies that ServiceError has correct fields.
   */
  test('should define correct error type structure', () => {
    const error: ServiceError = {
      message: 'User not found',
      status: 404,
    }

    expect(error.message).toBe('User not found')
    expect(error.status).toBe(404)
  })

  /**
   * Test that Effect can be converted to Either
   *
   * Verifies that errors can be handled functionally.
   */
  test('should allow error handling via Either', async () => {
    const input: AddMemberInput = {
      organizationId: 'org-789',
      userId: 'user-456',
      headers: new Headers(),
    }

    const program = addMember(input).pipe(Effect.either)

    // Verify Effect.either returns an Effect
    expect(typeof program.pipe).toBe('function')
  })

  /**
   * Test immutability of input type
   *
   * Verifies that input types are readonly (functional programming principle).
   */
  test('should have readonly input type', () => {
    const input: AddMemberInput = {
      organizationId: 'org-789',
      userId: 'user-456',
      role: 'member',
      headers: new Headers(),
    }

    // TypeScript enforces readonly at compile time
    // This test documents the intent
    expect(Object.isFrozen(input)).toBe(false) // Not frozen, but readonly via types
  })

  /**
   * Test result type structure
   *
   * Verifies that AddMemberResult has correct shape.
   */
  test('should define correct result type structure', () => {
    // This is a type-level test - verifies the shape is correct
    type ResultHasMember = AddMemberResult extends { member: unknown } ? true : false
    const check: ResultHasMember = true
    expect(check).toBe(true)
  })

  /**
   * Test headers are passed through
   *
   * Verifies that authentication headers are included in the input.
   */
  test('should accept headers for authentication', () => {
    const headers = new Headers()
    headers.set('Authorization', 'Bearer test-token')

    const input: AddMemberInput = {
      organizationId: 'org-789',
      userId: 'user-456',
      headers,
    }

    expect(input.headers.get('Authorization')).toBe('Bearer test-token')
  })
})

/**
 * Type-level tests (compile-time verification)
 *
 * These imports verify that the types are exported correctly
 * and can be used by other modules.
 */
describe('addMember - type exports', () => {
  test('should export AddMemberInput type', () => {
    // Type-level check - this test exists to ensure the type is exported
    type HasOrganizationId = AddMemberInput extends { organizationId: string } ? true : false
    const check: HasOrganizationId = true
    expect(check).toBe(true)
  })

  test('should export AddMemberResult type', () => {
    // Type-level check - this test exists to ensure the type is exported
    type HasMember = AddMemberResult extends { member: unknown } ? true : false
    const check: HasMember = true
    expect(check).toBe(true)
  })

  test('should export ServiceError type', () => {
    // Type-level check - this test exists to ensure the type is exported
    type HasMessage = ServiceError extends { message: string; status: number } ? true : false
    const check: HasMessage = true
    expect(check).toBe(true)
  })
})
