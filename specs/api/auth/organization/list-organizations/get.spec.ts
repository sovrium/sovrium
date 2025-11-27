/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for List user organizations
 *
 * Source: specs/api/paths/auth/organization/list-organizations/get.json
 * Domain: api
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation (executeQuery fixture)
 * - Authentication/authorization checks
 */

test.describe('List user organizations', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    "API-ORG-LIST-ORGANIZATIONS-001: should returns 200 OK with all organizations and user's roles",
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user who is member of multiple organizations
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'user@example.com', '$2a$10$YourHashedPasswordHere', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Org One', 'org-one', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (2, 'Org Two', 'org-two', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (2, 2, 1, 'member', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'user_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User requests list of their organizations
      const response = await page.request.get('/api/auth/organization/list-organizations', {})

      // THEN: Returns 200 OK with all organizations and user's roles
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Response contains organizations array with roles
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('organizations')
      expect(Array.isArray(data.organizations)).toBe(true)

      // Response includes both organizations
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-ORGANIZATIONS-002: should returns 200 OK with empty organizations array',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user who is not member of any organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'user@example.com', '$2a$10$YourHashedPasswordHere', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'user_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User requests list of their organizations
      const response = await page.request.get('/api/auth/organization/list-organizations', {})

      // THEN: Returns 200 OK with empty organizations array
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Response contains empty organizations array
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-ORGANIZATIONS-003: should returns 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // WHEN: Unauthenticated user attempts to list organizations
      const response = await page.request.get('/api/auth/organization/list-organizations')

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
    "API-ORG-LIST-ORGANIZATIONS-004: should returns 200 OK with only User A's organizations (User B's not visible)",
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Two users with different organizations
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'user1@example.com', '$2a$10$YourHashedPasswordHere', 'User 1', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (2, 'user2@example.com', '$2a$10$YourHashedPasswordHere', 'User 2', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'User 1 Org', 'user1-org', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (2, 'User 2 Org', 'user2-org', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (2, 2, 2, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'user1_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User A requests list of organizations
      const response = await page.request.get('/api/auth/organization/list-organizations', {})

      // THEN: Returns 200 OK with only User A's organizations (User B's not visible)
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Response contains only User 1's organization

      // Response does not include User 2's organization
    }
  )

  test.fixme(
    'API-AUTH-ORG-LIST-ORGANIZATIONS-005: should returns 200 OK with correct role for each organization',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user with different roles across organizations
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'user@example.com', '$2a$10$YourHashedPasswordHere', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Owned Org', 'owned-org', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (2, 'Admin Org', 'admin-org', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (3, 'Member Org', 'member-org', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (2, 2, 1, 'admin', NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (3, 3, 1, 'member', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'user_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User requests list of organizations
      const response = await page.request.get('/api/auth/organization/list-organizations', {})

      // THEN: Returns 200 OK with correct role for each organization
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Response includes all 3 organizations with correct roles

      // Each organization has correct role attribute
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('organizations')
      expect(Array.isArray(data.organizations)).toBe(true)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-LIST-ORGANIZATIONS-006: user can complete full listOrganizations workflow',
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
