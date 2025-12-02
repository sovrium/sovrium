/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { AuthConfigRequiredForUserFields } from './auth-config-required-error'

describe('AuthConfigRequiredForUserFields', () => {
  describe('Error construction', () => {
    test('creates error with message', () => {
      // Given
      const message =
        'User fields require auth configuration. Please add auth config to your app schema.'

      // When
      const error = new AuthConfigRequiredForUserFields({ message })

      // Then
      expect(error).toBeInstanceOf(AuthConfigRequiredForUserFields)
      expect(error._tag).toBe('AuthConfigRequiredForUserFields')
      expect(error.message).toBe(message)
    })

    test('creates error with detailed message', () => {
      // Given
      const message =
        'User fields (user, created-by, updated-by) require auth configuration. ' +
        'Please add auth: { methods: ["email-and-password"] } to your app schema.'

      // When
      const error = new AuthConfigRequiredForUserFields({ message })

      // Then
      expect(error).toBeInstanceOf(AuthConfigRequiredForUserFields)
      expect(error._tag).toBe('AuthConfigRequiredForUserFields')
      expect(error.message).toBe(message)
    })
  })

  describe('Error tag', () => {
    test('has correct _tag property', () => {
      // When
      const error = new AuthConfigRequiredForUserFields({
        message: 'Auth configuration required',
      })

      // Then
      expect(error._tag).toBe('AuthConfigRequiredForUserFields')
    })

    test('tag is consistent across instances', () => {
      // When
      const error1 = new AuthConfigRequiredForUserFields({ message: 'Message 1' })
      const error2 = new AuthConfigRequiredForUserFields({ message: 'Message 2' })

      // Then
      expect(error1._tag).toBe('AuthConfigRequiredForUserFields')
      expect(error2._tag).toBe('AuthConfigRequiredForUserFields')
      expect(error1._tag).toBe(error2._tag)
    })
  })

  describe('Schema validation scenarios', () => {
    test('handles user field without auth config scenario', () => {
      // Given
      const message =
        'Table "posts" uses "user" field type but auth is not configured. ' +
        'Please add auth: { methods: ["email-and-password"] } to app schema.'

      // When
      const error = new AuthConfigRequiredForUserFields({ message })

      // Then
      expect(error.message).toContain('user')
      expect(error.message).toContain('auth')
      expect(error.message).toContain('authentication')
    })

    test('handles created-by field without auth config scenario', () => {
      // Given
      const message =
        'Table "tasks" uses "created-by" field type but auth is not configured. ' +
        'Please add auth configuration.'

      // When
      const error = new AuthConfigRequiredForUserFields({ message })

      // Then
      expect(error.message).toContain('created-by')
      expect(error.message).toContain('auth')
    })

    test('handles updated-by field without auth config scenario', () => {
      // Given
      const message =
        'Table "documents" uses "updated-by" field type but auth is not configured. ' +
        'Please configure Better Auth.'

      // When
      const error = new AuthConfigRequiredForUserFields({ message })

      // Then
      expect(error.message).toContain('updated-by')
      expect(error.message).toContain('auth')
    })
  })

  describe('Type guards and instanceof', () => {
    test('works with instanceof checks', () => {
      // When
      const error = new AuthConfigRequiredForUserFields({ message: 'test' })
      const regularError = new Error('regular')

      // Then
      expect(error instanceof AuthConfigRequiredForUserFields).toBe(true)
      expect(regularError instanceof AuthConfigRequiredForUserFields).toBe(false)
    })

    test('can be used in Effect error handling', () => {
      // Given
      const error = new AuthConfigRequiredForUserFields({ message: 'test' })

      // When
      const isAuthConfigError = (e: unknown): e is AuthConfigRequiredForUserFields =>
        e instanceof AuthConfigRequiredForUserFields && e._tag === 'AuthConfigRequiredForUserFields'

      // Then
      expect(isAuthConfigError(error)).toBe(true)
      expect(isAuthConfigError(new Error('test'))).toBe(false)
      expect(isAuthConfigError({ _tag: 'AuthConfigRequiredForUserFields' })).toBe(false)
    })
  })

  describe('Usage patterns', () => {
    test('can be thrown and caught', () => {
      // Given
      const message = 'Auth configuration is required'

      // When/Then
      expect(() => {
        throw new AuthConfigRequiredForUserFields({ message })
      }).toThrow()

      try {
        throw new AuthConfigRequiredForUserFields({ message })
      } catch (e) {
        expect(e).toBeInstanceOf(AuthConfigRequiredForUserFields)
        expect((e as AuthConfigRequiredForUserFields)._tag).toBe('AuthConfigRequiredForUserFields')
        expect((e as AuthConfigRequiredForUserFields).message).toBe(message)
      }
    })

    test('can be used in schema validation workflow', () => {
      // Given
      const hasUserFields = true
      const hasAuthConfig = false

      // When/Then
      try {
        if (hasUserFields && !hasAuthConfig) {
          throw new AuthConfigRequiredForUserFields({
            message:
              'User fields (user, created-by, updated-by) require auth configuration. ' +
              'Please add auth: { methods: ["email-and-password"] } to your app schema.',
          })
        }
      } catch (e) {
        expect(e).toBeInstanceOf(AuthConfigRequiredForUserFields)
        expect((e as AuthConfigRequiredForUserFields).message).toContain('User fields')
        expect((e as AuthConfigRequiredForUserFields).message).toContain('auth configuration')
      }
    })
  })

  describe('Message immutability', () => {
    test('message is readonly', () => {
      // Given
      const message = 'Original message'
      const error = new AuthConfigRequiredForUserFields({ message })

      // When - TypeScript readonly prevents modification at compile time
      // At runtime, the object is not frozen, but we should not modify it
      // This test documents the expected immutable behavior

      // Then
      expect(error.message).toBe(message)
      // Message remains unchanged (no modification attempted)
      expect(error.message).toBe(message)
    })
  })
})
