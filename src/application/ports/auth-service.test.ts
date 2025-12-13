/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { AuthService, type AddMemberParams, type AuthServiceError } from './auth-service'

describe('AuthService', () => {
  test('should be a valid Context.Tag', () => {
    expect(AuthService).toBeDefined()
    expect(typeof AuthService).toBe('function')
  })

  test('should have correct tag identifier', () => {
    expect(String(AuthService)).toContain('AuthService')
  })

  test('should allow creating mock implementation via Layer', async () => {
    const mockMember = {
      id: 'mock-member-id',
      organizationId: 'org-123',
      userId: 'user-456',
      role: 'member' as const,
      createdAt: new Date().toISOString(),
    }

    const MockAuthService = Layer.succeed(AuthService, {
      addMember: (_params: AddMemberParams) => Effect.succeed({ member: mockMember }),
    })

    const program = Effect.gen(function* () {
      const authService = yield* AuthService
      return yield* authService.addMember({
        organizationId: 'org-123',
        userId: 'user-456',
        role: 'member',
        headers: new Headers(),
      })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockAuthService)))
    expect(result.member).toEqual(mockMember)
  })

  test('should propagate errors correctly', async () => {
    const MockAuthServiceFailing = Layer.succeed(AuthService, {
      addMember: () =>
        Effect.fail({
          message: 'Unauthorized',
          status: 401,
        }),
    })

    const program = Effect.gen(function* () {
      const authService = yield* AuthService
      return yield* authService.addMember({
        organizationId: 'org-123',
        userId: 'user-456',
        headers: new Headers(),
      })
    }).pipe(Effect.provide(MockAuthServiceFailing), Effect.either)

    const result = await Effect.runPromise(program)
    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left.message).toBe('Unauthorized')
      expect(result.left.status).toBe(401)
    }
  })
})

describe('AuthServiceError type', () => {
  test('should have message and status fields', () => {
    const error: AuthServiceError = {
      message: 'Test error',
      status: 500,
    }

    expect(error.message).toBe('Test error')
    expect(error.status).toBe(500)
  })
})

describe('AddMemberParams type', () => {
  test('should require organizationId and userId', () => {
    const params: AddMemberParams = {
      organizationId: 'org-123',
      userId: 'user-456',
      headers: new Headers(),
    }

    expect(params.organizationId).toBe('org-123')
    expect(params.userId).toBe('user-456')
    expect(params.role).toBeUndefined()
  })

  test('should accept optional role', () => {
    const params: AddMemberParams = {
      organizationId: 'org-123',
      userId: 'user-456',
      role: 'admin',
      headers: new Headers(),
    }

    expect(params.role).toBe('admin')
  })

  test('should enforce role type constraints', () => {
    const ownerParams: AddMemberParams = {
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      headers: new Headers(),
    }

    const adminParams: AddMemberParams = {
      organizationId: 'org-2',
      userId: 'user-2',
      role: 'admin',
      headers: new Headers(),
    }

    const memberParams: AddMemberParams = {
      organizationId: 'org-3',
      userId: 'user-3',
      role: 'member',
      headers: new Headers(),
    }

    expect(ownerParams.role).toBe('owner')
    expect(adminParams.role).toBe('admin')
    expect(memberParams.role).toBe('member')
  })
})
