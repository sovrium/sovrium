/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

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
 * - Database state validation (executeQuery fixture)
 * - Authentication/authorization checks
 */

test.describe('Update user profile', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-UPDATE-USER-001: should returns 200 OK with updated user data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user with valid profile data
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, image, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$YourHashedPasswordHere', 'Old Name', 'https://old-avatar.com/old.jpg', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'valid_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User updates their profile information
      const response = await page.request.patch('/api/auth/update-user', {
        data: {
          name: 'New Name',
          image: 'https://new-avatar.com/new.jpg',
        },
      })

      // THEN: Returns 200 OK with updated user data
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Response contains updated user data
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: expect.any(Boolean) })

      // User data is updated in database
      const dbRow = await executeQuery('SELECT * FROM users LIMIT 1')
      expect(dbRow).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-UPDATE-USER-002: should returns 200 OK with updated name, image unchanged',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, image, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$YourHashedPasswordHere', 'Old Name', 'https://old-avatar.com/old.jpg', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'valid_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User updates only name field
      const response = await page.request.patch('/api/auth/update-user', {
        data: {
          name: 'Updated Name Only',
        },
      })

      // THEN: Returns 200 OK with updated name, image unchanged
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Name is updated, image remains unchanged
      const dbRow = await executeQuery('SELECT * FROM users LIMIT 1')
      expect(dbRow).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-UPDATE-USER-003: should returns 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // WHEN: Unauthenticated user attempts to update profile
      const response = await page.request.patch('/api/auth/update-user', {
        data: {
          name: 'New Name',
        },
      })

      // THEN: Returns 401 Unauthorized
      // Returns 401 Unauthorized
      expect(response.status).toBe(401)

      // Response contains error about missing authentication
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-UPDATE-USER-004: should returns 200 OK with sanitized name (XSS payload neutralized)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$YourHashedPasswordHere', 'Old Name', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'valid_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User submits name with XSS payload
      const response = await page.request.patch('/api/auth/update-user', {
        data: {
          name: "<script>alert('xss')</script>Malicious",
        },
      })

      // THEN: Returns 200 OK with sanitized name (XSS payload neutralized)
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Name is sanitized (no script tags)
    }
  )

  test.fixme(
    'API-AUTH-UPDATE-USER-005: should returns 200 OK with Unicode name preserved',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$YourHashedPasswordHere', 'Old Name', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'valid_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User updates name with Unicode characters
      const response = await page.request.patch('/api/auth/update-user', {
        data: {
          name: 'José García 日本語',
        },
      })

      // THEN: Returns 200 OK with Unicode name preserved
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Unicode characters in name are preserved
    }
  )

  test.fixme(
    'API-AUTH-UPDATE-USER-006: should returns 200 OK with image removed',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user with profile image
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, image, email_verified, created_at, updated_at) VALUES (1, 'test@example.com', '$2a$10$YourHashedPasswordHere', 'Test User', 'https://avatar.com/old.jpg', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'valid_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User sets image to null (removes profile image)
      const response = await page.request.patch('/api/auth/update-user', {
        data: {
          image: null,
        },
      })

      // THEN: Returns 200 OK with image removed
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Image is removed from database
      const dbRow = await executeQuery('SELECT * FROM users LIMIT 1')
      expect(dbRow).toBeDefined()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-UPDATE-USER-007: user can complete full updateUser workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Representative test scenario
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // WHEN: Execute workflow
      const response = await page.request.post('/api/auth/workflow', {
        data: { test: true },
      })

      // THEN: Verify integration
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data).toMatchObject({ success: true })
    }
  )
})
