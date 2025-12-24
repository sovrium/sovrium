/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Account Lockout Security
 *
 * Priority: HIGH - Production security requirement
 * Domain: api/security
 * Spec Count: 3
 *
 * Validates that user accounts are locked after repeated failed login attempts
 * to prevent brute-force attacks. Includes automatic unlock and manual admin override.
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (3 tests)
 * 2. @regression test - ONE optimized integration test
 */

test.describe('Account Lockout Security', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-SECURITY-LOCKOUT-001: should lock account after 5 failed login attempts',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with user authentication and account lockout enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          providers: ['email'],
          security: {
            accountLockout: {
              enabled: true,
              maxAttempts: 5,
              lockoutDuration: 1800, // 30 minutes in seconds
            },
          },
        },
      })

      // AND: User account exists
      await request.post('/api/auth/sign-up/email', {
        data: {
          email: 'lockout@example.com',
          password: 'CorrectPassword123!',
          name: 'Lockout Test User',
        },
      })

      // WHEN: User attempts to log in with wrong password 5 times
      for (let i = 0; i < 5; i++) {
        const response = await request.post('/api/auth/sign-in/email', {
          data: {
            email: 'lockout@example.com',
            password: 'WrongPassword123!',
          },
        })

        // THEN: Login fails for each attempt
        expect(response.status()).toBe(401)
      }

      // WHEN: User attempts to log in with CORRECT password after 5 failed attempts
      const lockedResponse = await request.post('/api/auth/sign-in/email', {
        data: {
          email: 'lockout@example.com',
          password: 'CorrectPassword123!', // Correct password
        },
      })

      // THEN: Account is locked, login fails even with correct password
      expect(lockedResponse.status()).toBe(403)
      const lockedData = await lockedResponse.json()
      expect(lockedData.error).toMatch(/account.*locked/i)
      expect(lockedData.lockedUntil).toBeDefined()
    }
  )

  test.fixme(
    'API-SECURITY-LOCKOUT-002: should unlock after 30 minutes automatically',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, advanceTime }) => {
      // GIVEN: Application with user authentication and account lockout enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          providers: ['email'],
          security: {
            accountLockout: {
              enabled: true,
              maxAttempts: 5,
              lockoutDuration: 1800, // 30 minutes in seconds
            },
          },
        },
      })

      // AND: User account exists
      await request.post('/api/auth/sign-up/email', {
        data: {
          email: 'autounlock@example.com',
          password: 'CorrectPassword123!',
          name: 'Auto Unlock User',
        },
      })

      // WHEN: User triggers account lockout (5 failed attempts)
      for (let i = 0; i < 5; i++) {
        await request.post('/api/auth/sign-in/email', {
          data: {
            email: 'autounlock@example.com',
            password: 'WrongPassword123!',
          },
        })
      }

      // THEN: Account is locked
      const lockedResponse = await request.post('/api/auth/sign-in/email', {
        data: {
          email: 'autounlock@example.com',
          password: 'CorrectPassword123!',
        },
      })
      expect(lockedResponse.status()).toBe(403)

      // WHEN: 30 minutes have passed
      await advanceTime(1800 * 1000) // 30 minutes in milliseconds

      // AND: User attempts to log in with correct password
      const unlockedResponse = await request.post('/api/auth/sign-in/email', {
        data: {
          email: 'autounlock@example.com',
          password: 'CorrectPassword123!',
        },
      })

      // THEN: Account is automatically unlocked, login succeeds
      expect(unlockedResponse.ok()).toBe(true)
      const unlockedData = await unlockedResponse.json()
      expect(unlockedData.session).toBeDefined()
      expect(unlockedData.user.email).toBe('autounlock@example.com')
    }
  )

  test.fixme(
    'API-SECURITY-LOCKOUT-003: should allow admin manual unlock',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with user authentication and admin account
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          providers: ['email'],
          security: {
            accountLockout: {
              enabled: true,
              maxAttempts: 5,
              lockoutDuration: 1800,
            },
          },
        },
      })

      // AND: Regular user account exists
      await request.post('/api/auth/sign-up/email', {
        data: {
          email: 'locked@example.com',
          password: 'CorrectPassword123!',
          name: 'Locked User',
        },
      })

      // AND: Admin account exists
      const adminResponse = await request.post('/api/auth/sign-up/email', {
        data: {
          email: 'admin@example.com',
          password: 'AdminPassword123!',
          name: 'Admin User',
          role: 'admin',
        },
      })
      const adminData = await adminResponse.json()
      const adminToken = adminData.session.token

      // WHEN: Regular user triggers account lockout
      for (let i = 0; i < 5; i++) {
        await request.post('/api/auth/sign-in/email', {
          data: {
            email: 'locked@example.com',
            password: 'WrongPassword123!',
          },
        })
      }

      // THEN: Account is locked
      const lockedResponse = await request.post('/api/auth/sign-in/email', {
        data: {
          email: 'locked@example.com',
          password: 'CorrectPassword123!',
        },
      })
      expect(lockedResponse.status()).toBe(403)

      // WHEN: Admin unlocks the account manually
      const unlockResponse = await request.post('/api/admin/users/unlock', {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        data: {
          email: 'locked@example.com',
        },
      })

      // THEN: Unlock succeeds
      expect(unlockResponse.ok()).toBe(true)

      // WHEN: User attempts to log in with correct password
      const loginResponse = await request.post('/api/auth/sign-in/email', {
        data: {
          email: 'locked@example.com',
          password: 'CorrectPassword123!',
        },
      })

      // THEN: Login succeeds (account manually unlocked)
      expect(loginResponse.ok()).toBe(true)
      const loginData = await loginResponse.json()
      expect(loginData.session).toBeDefined()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-SECURITY-LOCKOUT-004: user can complete full account lockout workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, advanceTime }) => {
      // GIVEN: Application with authentication and lockout enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          providers: ['email'],
          security: {
            accountLockout: {
              enabled: true,
              maxAttempts: 5,
              lockoutDuration: 1800,
            },
          },
        },
      })

      // AND: User account exists
      await request.post('/api/auth/sign-up/email', {
        data: {
          email: 'workflow@example.com',
          password: 'CorrectPassword123!',
          name: 'Workflow User',
        },
      })

      // WHEN: User triggers lockout with 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request.post('/api/auth/sign-in/email', {
          data: { email: 'workflow@example.com', password: 'WrongPassword123!' },
        })
      }

      // THEN: Account is locked (correct password fails)
      const lockedResponse = await request.post('/api/auth/sign-in/email', {
        data: { email: 'workflow@example.com', password: 'CorrectPassword123!' },
      })
      expect(lockedResponse.status()).toBe(403)

      // WHEN: 30 minutes pass
      await advanceTime(1800 * 1000)

      // THEN: Account auto-unlocks and login succeeds
      const unlockedResponse = await request.post('/api/auth/sign-in/email', {
        data: { email: 'workflow@example.com', password: 'CorrectPassword123!' },
      })
      expect(unlockedResponse.ok()).toBe(true)
      const finalData = await unlockedResponse.json()
      expect(finalData.session).toBeDefined()
    }
  )
})
