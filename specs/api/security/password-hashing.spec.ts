/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Password Hashing Security
 *
 * Priority: HIGH - Production security requirement
 * Domain: api/security
 * Spec Count: 3
 *
 * Validates that passwords are hashed using industry-standard algorithms
 * with appropriate cost factors and unique salts per password.
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (3 tests)
 * 2. @regression test - ONE optimized integration test
 */

test.describe('Password Hashing Security', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-HASH-001: should use bcrypt or argon2 for password hashing',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with user authentication enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          providers: ['email'],
        },
      })

      // WHEN: User signs up with password
      const response = await request.post('/api/auth/sign-up/email', {
        data: {
          email: 'test@example.com',
          password: 'SecurePassword123!',
          name: 'Test User',
        },
      })

      // THEN: Password is hashed (not stored in plaintext)
      expect(response.ok()).toBe(true)

      // WHEN: Querying database directly
      const user = await request.get('/api/auth/user/test@example.com')
      const userData = await user.json()

      // THEN: Password hash starts with bcrypt ($2a$, $2b$) or argon2 ($argon2)
      expect(userData.password).toMatch(/^(\$2[ab]\$|\$argon2)/)
      expect(userData.password).not.toBe('SecurePassword123!')
      expect(userData.password.length).toBeGreaterThan(50) // Hashed passwords are much longer
    }
  )

  test.fixme(
    'API-SECURITY-HASH-002: should use cost factor >= 12 for bcrypt (or argon2 defaults)',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with user authentication enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          providers: ['email'],
        },
      })

      // WHEN: User signs up with password
      const response = await request.post('/api/auth/sign-up/email', {
        data: {
          email: 'secure@example.com',
          password: 'StrongPassword456!',
          name: 'Secure User',
        },
      })

      // THEN: Password is hashed successfully
      expect(response.ok()).toBe(true)

      // WHEN: Querying database for password hash
      const user = await request.get('/api/auth/user/secure@example.com')
      const userData = await user.json()

      // THEN: If bcrypt, cost factor is >= 12
      if (userData.password.startsWith('$2')) {
        const costFactor = parseInt(userData.password.split('$')[2])
        expect(costFactor).toBeGreaterThanOrEqual(12)
      }

      // THEN: If argon2, password hash format is valid
      if (userData.password.startsWith('$argon2')) {
        expect(userData.password).toMatch(/^\$argon2(id|i|d)\$/)
      }
    }
  )

  test.fixme(
    'API-SECURITY-HASH-003: should generate unique salt per password',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with user authentication enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          providers: ['email'],
        },
      })

      // WHEN: Creating two users with identical passwords
      await request.post('/api/auth/sign-up/email', {
        data: {
          email: 'user1@example.com',
          password: 'SamePassword789!',
          name: 'User One',
        },
      })

      await request.post('/api/auth/sign-up/email', {
        data: {
          email: 'user2@example.com',
          password: 'SamePassword789!',
          name: 'User Two',
        },
      })

      // WHEN: Querying both users' password hashes
      const user1Response = await request.get('/api/auth/user/user1@example.com')
      const user1 = await user1Response.json()

      const user2Response = await request.get('/api/auth/user/user2@example.com')
      const user2 = await user2Response.json()

      // THEN: Password hashes are different (unique salts)
      expect(user1.password).not.toBe(user2.password)

      // THEN: Both hashes are valid format
      expect(user1.password).toMatch(/^(\$2[ab]\$|\$argon2)/)
      expect(user2.password).toMatch(/^(\$2[ab]\$|\$argon2)/)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-SECURITY-HASH-004: user can complete full password hashing workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with authentication enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          providers: ['email'],
        },
      })

      // WHEN: User signs up with password
      const signupResponse = await request.post('/api/auth/sign-up/email', {
        data: {
          email: 'workflow@example.com',
          password: 'WorkflowTest123!',
          name: 'Workflow User',
        },
      })

      // THEN: Signup succeeds
      expect(signupResponse.ok()).toBe(true)

      // WHEN: Verifying password hash properties
      const userResponse = await request.get('/api/auth/user/workflow@example.com')
      const user = await userResponse.json()

      // THEN: Password is properly hashed with secure algorithm
      expect(user.password).toMatch(/^(\$2[ab]\$|\$argon2)/)
      expect(user.password).not.toBe('WorkflowTest123!')
      expect(user.password.length).toBeGreaterThan(50)

      // WHEN: User logs in with original password
      const loginResponse = await request.post('/api/auth/sign-in/email', {
        data: {
          email: 'workflow@example.com',
          password: 'WorkflowTest123!',
        },
      })

      // THEN: Login succeeds (hash verification works)
      expect(loginResponse.ok()).toBe(true)
      const loginData = await loginResponse.json()
      expect(loginData.session).toBeDefined()
      expect(loginData.user.email).toBe('workflow@example.com')
    }
  )
})
