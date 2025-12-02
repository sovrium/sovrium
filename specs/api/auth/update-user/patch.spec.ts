/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Update user profile
 *
 * Source: specs/api/paths/auth/update-user/patch.json
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks via auth fixtures
 *
 * Note: Better Auth's update-user endpoint uses POST (not PATCH).
 */

test.describe('Update user profile', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'API-AUTH-UPDATE-USER-001: should return 200 OK with updated user data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user with valid profile data
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Create user and sign in via API
      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Old Name',
      })

      // WHEN: User updates their profile information (Better Auth uses POST)
      const response = await page.request.post('/api/auth/update-user', {
        data: {
          name: 'New Name',
          image: 'https://new-avatar.com/new.jpg',
        },
      })

      // THEN: Returns 200 OK with updated user data
      expect(response.status()).toBe(200)

      // Better Auth returns {status: true} on success
      const data = await response.json()
      expect(data.status).toBe(true)

      // Verify via get-session
      const sessionResponse = await page.request.get('/api/auth/get-session')
      const sessionData = await sessionResponse.json()
      expect(sessionData.user.name).toBe('New Name')
    }
  )

  test(
    'API-AUTH-UPDATE-USER-002: should return 200 OK with updated name only',
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
        password: 'TestPassword123!',
        name: 'Old Name',
      })

      // WHEN: User updates only name field (Better Auth uses POST)
      const response = await page.request.post('/api/auth/update-user', {
        data: {
          name: 'Updated Name Only',
        },
      })

      // THEN: Returns 200 OK with updated name
      expect(response.status()).toBe(200)

      // Better Auth returns {status: true} on success
      const data = await response.json()
      expect(data.status).toBe(true)

      // Verify via get-session
      const sessionResponse = await page.request.get('/api/auth/get-session')
      const sessionData = await sessionResponse.json()
      expect(sessionData.user.name).toBe('Updated Name Only')
    }
  )

  test(
    'API-AUTH-UPDATE-USER-003: should return 401 Unauthorized without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // WHEN: Unauthenticated user attempts to update profile (Better Auth uses POST)
      const response = await page.request.post('/api/auth/update-user', {
        data: {
          name: 'New Name',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  // Note: XSS sanitization is handled at render time (React escaping), not storage time.
  // Better Auth stores the name as-is. This is the correct approach per OWASP:
  // "Output encoding on display, not input validation for storage"
  test(
    'API-AUTH-UPDATE-USER-004: should accept name with special characters',
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
        password: 'TestPassword123!',
        name: 'Old Name',
      })

      // WHEN: User submits name with special characters (Better Auth uses POST)
      const response = await page.request.post('/api/auth/update-user', {
        data: {
          name: "Test <User> & 'Name'",
        },
      })

      // THEN: Returns 200 OK and stores the name
      expect(response.status()).toBe(200)

      // Verify name is stored (XSS protection is at render time, not storage)
      const sessionResponse = await page.request.get('/api/auth/get-session')
      const sessionData = await sessionResponse.json()
      expect(sessionData.user.name).toBe("Test <User> & 'Name'")
    }
  )

  test(
    'API-AUTH-UPDATE-USER-005: should preserve Unicode characters in name',
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
        password: 'TestPassword123!',
        name: 'Old Name',
      })

      // WHEN: User updates name with Unicode characters (Better Auth uses POST)
      const response = await page.request.post('/api/auth/update-user', {
        data: {
          name: 'José García 日本語',
        },
      })

      // THEN: Returns 200 OK with Unicode name preserved
      expect(response.status()).toBe(200)

      // Verify Unicode characters are preserved
      const sessionResponse = await page.request.get('/api/auth/get-session')
      const sessionData = await sessionResponse.json()
      expect(sessionData.user.name).toBe('José García 日本語')
    }
  )

  test(
    'API-AUTH-UPDATE-USER-006: should allow removing profile image',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated user with profile image
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      await signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      })

      // WHEN: User sets image to null (removes profile image) (Better Auth uses POST)
      const response = await page.request.post('/api/auth/update-user', {
        data: {
          image: null,
        },
      })

      // THEN: Returns 200 OK with image removed
      expect(response.status()).toBe(200)

      // Verify image is removed
      const sessionResponse = await page.request.get('/api/auth/get-session')
      const sessionData = await sessionResponse.json()
      expect(sessionData.user.image).toBeNull()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-UPDATE-USER-007: user can complete full update-user workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: A running server with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
      })

      // Test 1: Update fails without auth (Better Auth uses POST)
      const noAuthResponse = await page.request.post('/api/auth/update-user', {
        data: { name: 'New Name' },
      })
      expect(noAuthResponse.status()).toBe(401)

      // Create user and sign in
      await signUp({
        email: 'workflow@example.com',
        password: 'WorkflowPass123!',
        name: 'Original Name',
      })

      // Test 2: Update name succeeds (Better Auth uses POST)
      const updateResponse = await page.request.post('/api/auth/update-user', {
        data: { name: 'Updated Name' },
      })
      expect(updateResponse.status()).toBe(200)

      // Test 3: Verify update persisted
      const sessionResponse = await page.request.get('/api/auth/get-session')
      const sessionData = await sessionResponse.json()
      expect(sessionData.user.name).toBe('Updated Name')
    }
  )
})
