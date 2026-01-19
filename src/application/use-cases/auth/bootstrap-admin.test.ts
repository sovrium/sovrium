/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { Auth, AuthError } from '@/infrastructure/auth/better-auth'
import {
  bootstrapAdmin,
  parseAdminBootstrapConfig,
  InvalidEmailError,
  WeakPasswordError,
  DatabaseError,
} from './bootstrap-admin'
import type { App } from '@/domain/models/app'

/**
 * Unit tests for bootstrap-admin use case
 *
 * Tests the application layer logic for bootstrapping admin accounts.
 * Uses mock Auth service to test use case logic without Better Auth dependencies.
 */

/**
 * Mock Auth service that simulates successful user creation
 */
const MockAuthServiceCreate = Layer.succeed(Auth, {
  api: {
    createUser: async () => ({
      status: 200,
      body: {
        user: {
          id: 'user-123',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin',
        },
      },
    }),
  } as any,
  handler: () => Promise.resolve(new Response()),
  getSession: () => Effect.succeed(null),
  requireSession: () => Effect.fail(new AuthError('Not authenticated')),
})

/**
 * Mock Auth service that simulates user already exists
 */
const MockAuthServiceExists = Layer.succeed(Auth, {
  api: {
    createUser: async () => {
      throw new Error('User already exists')
    },
  } as any,
  handler: () => Promise.resolve(new Response()),
  getSession: () => Effect.succeed(null),
  requireSession: () => Effect.fail(new AuthError('Not authenticated')),
})

/**
 * Mock Auth service that simulates database error
 */
const MockAuthServiceError = Layer.succeed(Auth, {
  api: {
    createUser: async () => {
      throw new Error('Database connection failed')
    },
  } as any,
  handler: () => Promise.resolve(new Response()),
  getSession: () => Effect.succeed(null),
  requireSession: () => Effect.fail(new AuthError('Not authenticated')),
})

/**
 * Mock app configuration with admin plugin enabled
 */
const mockAppWithAdmin: App = {
  name: 'Test App',
  auth: {
    admin: true,
  },
} as any

/**
 * Mock app configuration without admin plugin
 */
const mockAppWithoutAdmin: App = {
  name: 'Test App',
  auth: {},
} as any

describe('parseAdminBootstrapConfig', () => {
  /**
   * Test that config is returned when all env vars are set
   */
  test('should return config when email and password are set', () => {
    const originalEmail = process.env.BETTER_AUTH_ADMIN_EMAIL
    const originalPassword = process.env.BETTER_AUTH_ADMIN_PASSWORD
    const originalName = process.env.BETTER_AUTH_ADMIN_NAME

    process.env.BETTER_AUTH_ADMIN_EMAIL = 'admin@example.com'
    process.env.BETTER_AUTH_ADMIN_PASSWORD = 'securePassword123'
    process.env.BETTER_AUTH_ADMIN_NAME = 'Admin User'

    const config = parseAdminBootstrapConfig()

    expect(config).toBeDefined()
    expect(config?.email).toBe('admin@example.com')
    expect(config?.password).toBe('securePassword123')
    expect(config?.name).toBe('Admin User')

    // Restore original env vars
    process.env.BETTER_AUTH_ADMIN_EMAIL = originalEmail
    process.env.BETTER_AUTH_ADMIN_PASSWORD = originalPassword
    process.env.BETTER_AUTH_ADMIN_NAME = originalName
  })

  /**
   * Test that config uses default name when not provided
   */
  test('should use default name when BETTER_AUTH_ADMIN_NAME is not set', () => {
    const originalEmail = process.env.BETTER_AUTH_ADMIN_EMAIL
    const originalPassword = process.env.BETTER_AUTH_ADMIN_PASSWORD
    const originalName = process.env.BETTER_AUTH_ADMIN_NAME

    process.env.BETTER_AUTH_ADMIN_EMAIL = 'admin@example.com'
    process.env.BETTER_AUTH_ADMIN_PASSWORD = 'securePassword123'
    delete process.env.BETTER_AUTH_ADMIN_NAME

    const config = parseAdminBootstrapConfig()

    expect(config).toBeDefined()
    expect(config?.name).toBe('Administrator')

    // Restore original env vars
    process.env.BETTER_AUTH_ADMIN_EMAIL = originalEmail
    process.env.BETTER_AUTH_ADMIN_PASSWORD = originalPassword
    process.env.BETTER_AUTH_ADMIN_NAME = originalName
  })

  /**
   * Test that config is undefined when email is missing
   */
  test('should return undefined when email is missing', () => {
    const originalEmail = process.env.BETTER_AUTH_ADMIN_EMAIL
    const originalPassword = process.env.BETTER_AUTH_ADMIN_PASSWORD

    delete process.env.BETTER_AUTH_ADMIN_EMAIL
    process.env.BETTER_AUTH_ADMIN_PASSWORD = 'securePassword123'

    const config = parseAdminBootstrapConfig()

    expect(config).toBeUndefined()

    // Restore original env vars
    process.env.BETTER_AUTH_ADMIN_EMAIL = originalEmail
    process.env.BETTER_AUTH_ADMIN_PASSWORD = originalPassword
  })

  /**
   * Test that config is undefined when password is missing
   */
  test('should return undefined when password is missing', () => {
    const originalEmail = process.env.BETTER_AUTH_ADMIN_EMAIL
    const originalPassword = process.env.BETTER_AUTH_ADMIN_PASSWORD

    process.env.BETTER_AUTH_ADMIN_EMAIL = 'admin@example.com'
    delete process.env.BETTER_AUTH_ADMIN_PASSWORD

    const config = parseAdminBootstrapConfig()

    expect(config).toBeUndefined()

    // Restore original env vars
    process.env.BETTER_AUTH_ADMIN_EMAIL = originalEmail
    process.env.BETTER_AUTH_ADMIN_PASSWORD = originalPassword
  })
})

describe('bootstrapAdmin', () => {
  /**
   * Test that Effect is returned
   */
  test('should return an Effect', () => {
    const program = bootstrapAdmin(mockAppWithAdmin)

    // Verify it's an Effect (has pipe method)
    expect(typeof program.pipe).toBe('function')
  })

  /**
   * Test that bootstrap is skipped when no config is provided
   */
  test('should skip bootstrap when no config is provided', async () => {
    const originalEmail = process.env.BETTER_AUTH_ADMIN_EMAIL
    const originalPassword = process.env.BETTER_AUTH_ADMIN_PASSWORD

    delete process.env.BETTER_AUTH_ADMIN_EMAIL
    delete process.env.BETTER_AUTH_ADMIN_PASSWORD

    const program = bootstrapAdmin(mockAppWithAdmin).pipe(Effect.provide(MockAuthServiceCreate))

    const result = await Effect.runPromise(program)

    // Should succeed without errors (skipped)
    expect(result).toBeUndefined()

    // Restore original env vars
    process.env.BETTER_AUTH_ADMIN_EMAIL = originalEmail
    process.env.BETTER_AUTH_ADMIN_PASSWORD = originalPassword
  })

  /**
   * Test that bootstrap is skipped when admin plugin is disabled
   */
  test('should skip bootstrap when admin plugin is disabled', async () => {
    const originalEmail = process.env.BETTER_AUTH_ADMIN_EMAIL
    const originalPassword = process.env.BETTER_AUTH_ADMIN_PASSWORD

    process.env.BETTER_AUTH_ADMIN_EMAIL = 'admin@example.com'
    process.env.BETTER_AUTH_ADMIN_PASSWORD = 'securePassword123'

    const program = bootstrapAdmin(mockAppWithoutAdmin).pipe(Effect.provide(MockAuthServiceCreate))

    const result = await Effect.runPromise(program)

    // Should succeed without errors (skipped)
    expect(result).toBeUndefined()

    // Restore original env vars
    process.env.BETTER_AUTH_ADMIN_EMAIL = originalEmail
    process.env.BETTER_AUTH_ADMIN_PASSWORD = originalPassword
  })

  /**
   * Test that bootstrap fails with invalid email
   */
  test('should fail with InvalidEmailError for invalid email', async () => {
    const originalEmail = process.env.BETTER_AUTH_ADMIN_EMAIL
    const originalPassword = process.env.BETTER_AUTH_ADMIN_PASSWORD

    process.env.BETTER_AUTH_ADMIN_EMAIL = 'invalid-email'
    process.env.BETTER_AUTH_ADMIN_PASSWORD = 'securePassword123'

    const program = bootstrapAdmin(mockAppWithAdmin).pipe(
      Effect.provide(MockAuthServiceCreate),
      Effect.either
    )

    const result = await Effect.runPromise(program)

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(InvalidEmailError)
      if (result.left instanceof InvalidEmailError) {
        expect(result.left.email).toBe('invalid-email')
      }
    }

    // Restore original env vars
    process.env.BETTER_AUTH_ADMIN_EMAIL = originalEmail
    process.env.BETTER_AUTH_ADMIN_PASSWORD = originalPassword
  })

  /**
   * Test that bootstrap fails with weak password
   */
  test('should fail with WeakPasswordError for short password', async () => {
    const originalEmail = process.env.BETTER_AUTH_ADMIN_EMAIL
    const originalPassword = process.env.BETTER_AUTH_ADMIN_PASSWORD

    process.env.BETTER_AUTH_ADMIN_EMAIL = 'admin@example.com'
    process.env.BETTER_AUTH_ADMIN_PASSWORD = 'short'

    const program = bootstrapAdmin(mockAppWithAdmin).pipe(
      Effect.provide(MockAuthServiceCreate),
      Effect.either
    )

    const result = await Effect.runPromise(program)

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(WeakPasswordError)
      expect(result.left.message).toContain('at least 8 characters')
    }

    // Restore original env vars
    process.env.BETTER_AUTH_ADMIN_EMAIL = originalEmail
    process.env.BETTER_AUTH_ADMIN_PASSWORD = originalPassword
  })

  /**
   * Test successful admin creation
   */
  test('should successfully create admin user', async () => {
    const originalEmail = process.env.BETTER_AUTH_ADMIN_EMAIL
    const originalPassword = process.env.BETTER_AUTH_ADMIN_PASSWORD
    const originalName = process.env.BETTER_AUTH_ADMIN_NAME

    process.env.BETTER_AUTH_ADMIN_EMAIL = 'admin@example.com'
    process.env.BETTER_AUTH_ADMIN_PASSWORD = 'securePassword123'
    process.env.BETTER_AUTH_ADMIN_NAME = 'Admin User'

    const program = bootstrapAdmin(mockAppWithAdmin).pipe(Effect.provide(MockAuthServiceCreate))

    const result = await Effect.runPromise(program)

    // Should succeed without errors
    expect(result).toBeUndefined()

    // Restore original env vars
    process.env.BETTER_AUTH_ADMIN_EMAIL = originalEmail
    process.env.BETTER_AUTH_ADMIN_PASSWORD = originalPassword
    process.env.BETTER_AUTH_ADMIN_NAME = originalName
  })

  /**
   * Test idempotency when user already exists
   */
  test('should be idempotent when user already exists', async () => {
    const originalEmail = process.env.BETTER_AUTH_ADMIN_EMAIL
    const originalPassword = process.env.BETTER_AUTH_ADMIN_PASSWORD

    process.env.BETTER_AUTH_ADMIN_EMAIL = 'admin@example.com'
    process.env.BETTER_AUTH_ADMIN_PASSWORD = 'securePassword123'

    const program = bootstrapAdmin(mockAppWithAdmin).pipe(Effect.provide(MockAuthServiceExists))

    const result = await Effect.runPromise(program)

    // Should succeed without errors (idempotent)
    expect(result).toBeUndefined()

    // Restore original env vars
    process.env.BETTER_AUTH_ADMIN_EMAIL = originalEmail
    process.env.BETTER_AUTH_ADMIN_PASSWORD = originalPassword
  })

  /**
   * Test database error handling
   */
  test('should fail with DatabaseError for database errors', async () => {
    const originalEmail = process.env.BETTER_AUTH_ADMIN_EMAIL
    const originalPassword = process.env.BETTER_AUTH_ADMIN_PASSWORD

    process.env.BETTER_AUTH_ADMIN_EMAIL = 'admin@example.com'
    process.env.BETTER_AUTH_ADMIN_PASSWORD = 'securePassword123'

    const program = bootstrapAdmin(mockAppWithAdmin).pipe(
      Effect.provide(MockAuthServiceError),
      Effect.either
    )

    const result = await Effect.runPromise(program)

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(DatabaseError)
    }

    // Restore original env vars
    process.env.BETTER_AUTH_ADMIN_EMAIL = originalEmail
    process.env.BETTER_AUTH_ADMIN_PASSWORD = originalPassword
  })

  /**
   * Test error types are properly exported
   */
  test('should export InvalidEmailError type', () => {
    const error = new InvalidEmailError({ email: 'test@example.com' })
    expect(error._tag).toBe('InvalidEmailError')
    expect(error.email).toBe('test@example.com')
  })

  test('should export WeakPasswordError type', () => {
    const error = new WeakPasswordError({ message: 'Password too weak' })
    expect(error._tag).toBe('WeakPasswordError')
    expect(error.message).toBe('Password too weak')
  })

  test('should export DatabaseError type', () => {
    const cause = new Error('Connection failed')
    const error = new DatabaseError({ cause })
    expect(error._tag).toBe('DatabaseError')
    expect(error.cause).toBe(cause)
  })
})
