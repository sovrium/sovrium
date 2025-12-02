/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Change password
 *
 * Source: specs/api/paths/auth/change-password/post.json
 * Domain: api
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks via auth fixtures
 *
 * Note: Better Auth's change-password endpoint may not be publicly exposed.
 * These tests verify the behavior when calling the endpoint.
 */

test.describe('Change password', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: These tests are marked .fixme() because the /api/auth/change-password
  // endpoint is not yet implemented (returns 404)
  // ============================================================================

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-001: should return 200 OK and password is updated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user with valid current password
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create user and sign in via API
      await signUp({
        email: 'test@example.com',
        password: 'CurrentPass123!',
        name: 'Test User',
      })
      await signIn({
        email: 'test@example.com',
        password: 'CurrentPass123!',
      })

      // WHEN: User submits correct current password and valid new password
      const response = await page.request.post('/api/auth/change-password', {
        data: {
          currentPassword: 'CurrentPass123!',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 200 OK and password is updated
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('success', true)

      // Verify new password works
      await page.request.post('/api/auth/sign-out')
      const newSignIn = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'test@example.com',
          password: 'NewSecurePass123!',
        },
      })
      expect(newSignIn.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-002: should return 200 OK with new token and revoke other sessions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user with multiple active sessions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create user and sign in multiple times
      await signUp({
        email: 'test@example.com',
        password: 'CurrentPass123!',
        name: 'Test User',
      })
      await signIn({
        email: 'test@example.com',
        password: 'CurrentPass123!',
      })
      await signIn({
        email: 'test@example.com',
        password: 'CurrentPass123!',
      })

      // Verify multiple sessions
      const sessionsBefore = await page.request.get('/api/auth/list-sessions')
      const sessionsBeforeData = await sessionsBefore.json()
      expect(sessionsBeforeData.length).toBeGreaterThanOrEqual(2)

      // WHEN: User changes password with revokeOtherSessions enabled
      const response = await page.request.post('/api/auth/change-password', {
        data: {
          currentPassword: 'CurrentPass123!',
          newPassword: 'NewSecurePass123!',
          revokeOtherSessions: true,
        },
      })

      // THEN: Returns 200 OK with new token and revokes all other sessions
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('success', true)

      // Verify only one session remains
      const sessionsAfter = await page.request.get('/api/auth/list-sessions')
      const sessionsAfterData = await sessionsAfter.json()
      expect(sessionsAfterData.length).toBe(1)
    }
  )

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-003: should return 400 Bad Request without newPassword',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'CurrentPass123!',
        name: 'Test User',
      })
      await signIn({
        email: 'test@example.com',
        password: 'CurrentPass123!',
      })

      // WHEN: User submits request without newPassword field
      const response = await page.request.post('/api/auth/change-password', {
        data: {
          currentPassword: 'CurrentPass123!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-004: should return 400 Bad Request without currentPassword',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'CurrentPass123!',
        name: 'Test User',
      })
      await signIn({
        email: 'test@example.com',
        password: 'CurrentPass123!',
      })

      // WHEN: User submits request without currentPassword field
      const response = await page.request.post('/api/auth/change-password', {
        data: {
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-005: should return 400 Bad Request with short password',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'CurrentPass123!',
        name: 'Test User',
      })
      await signIn({
        email: 'test@example.com',
        password: 'CurrentPass123!',
      })

      // WHEN: User submits new password shorter than minimum length (8 characters)
      const response = await page.request.post('/api/auth/change-password', {
        data: {
          currentPassword: 'CurrentPass123!',
          newPassword: 'Short1!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-006: should return 401 Unauthorized without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: Unauthenticated user attempts to change password
      const response = await page.request.post('/api/auth/change-password', {
        data: {
          currentPassword: 'CurrentPass123!',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-007: should return 401 Unauthorized with wrong current password',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'CurrentPass123!',
        name: 'Test User',
      })
      await signIn({
        email: 'test@example.com',
        password: 'CurrentPass123!',
      })

      // WHEN: User submits incorrect current password
      const response = await page.request.post('/api/auth/change-password', {
        data: {
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-008: should handle same password attempt',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'CurrentPass123!',
        name: 'Test User',
      })
      await signIn({
        email: 'test@example.com',
        password: 'CurrentPass123!',
      })

      // WHEN: User attempts to change password to the same password
      const response = await page.request.post('/api/auth/change-password', {
        data: {
          currentPassword: 'CurrentPass123!',
          newPassword: 'CurrentPass123!',
        },
      })

      // THEN: Returns 200 OK (same password allowed) or 400 (rejected)
      // Behavior is implementation-dependent
      expect([200, 400]).toContain(response.status())
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-CHANGE-PASSWORD-009: user can complete full change-password workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Test 1: Change password fails without auth
      const noAuthResponse = await page.request.post('/api/auth/change-password', {
        data: {
          currentPassword: 'Current123!',
          newPassword: 'NewPass123!',
        },
      })
      expect(noAuthResponse.status()).toBe(401)

      // Create user and sign in
      await signUp({
        email: 'workflow@example.com',
        password: 'WorkflowPass123!',
        name: 'Workflow User',
      })
      await signIn({
        email: 'workflow@example.com',
        password: 'WorkflowPass123!',
      })

      // Test 2: Change password fails with wrong current password
      const wrongPassResponse = await page.request.post('/api/auth/change-password', {
        data: {
          currentPassword: 'WrongPassword!',
          newPassword: 'NewWorkflow123!',
        },
      })
      expect(wrongPassResponse.status()).toBe(401)

      // Test 3: Change password succeeds with correct current password
      const successResponse = await page.request.post('/api/auth/change-password', {
        data: {
          currentPassword: 'WorkflowPass123!',
          newPassword: 'NewWorkflow123!',
        },
      })
      expect(successResponse.status()).toBe(200)

      // Test 4: Verify new password works
      await page.request.post('/api/auth/sign-out')
      const newSignIn = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'workflow@example.com',
          password: 'NewWorkflow123!',
        },
      })
      expect(newSignIn.status()).toBe(200)
    }
  )
})
