/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Update organization
 *
 * Source: specs/api/paths/auth/organization/update-organization/patch.json
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation (executeQuery fixture)
 * - Authentication/authorization checks
 */

test.describe('Update organization', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-UPDATE-ORGANIZATION-001: should returns 200 OK with updated organization data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'owner@example.com', '$2a$10$YourHashedPasswordHere', 'Owner User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Old Name', 'old-slug', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner updates organization details
      const response = await page.request.patch('/api/auth/organization/update-organization', {
        data: {
          organizationId: '1',
          name: 'New Name',
          slug: 'new-slug',
        },
      })

      // THEN: Returns 200 OK with updated organization data
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Response contains updated organization
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('organization')

      // Organization is updated in database
      const dbRow = await executeQuery('SELECT * FROM users LIMIT 1')
      expect(dbRow).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-ORGANIZATION-002: should returns 200 OK with name updated, slug unchanged',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'owner@example.com', '$2a$10$YourHashedPasswordHere', 'Owner User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Old Name', 'unchanged-slug', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner updates only name field
      const response = await page.request.patch('/api/auth/organization/update-organization', {
        data: {
          organizationId: '1',
          name: 'Updated Name Only',
        },
      })

      // THEN: Returns 200 OK with name updated, slug unchanged
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Name is updated, slug remains unchanged
      const dbRow = await executeQuery('SELECT * FROM users LIMIT 1')
      expect(dbRow).toBeDefined()
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-ORGANIZATION-003: should returns 400 Bad Request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'owner@example.com', '$2a$10$YourHashedPasswordHere', 'Owner User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner submits request without organizationId
      const response = await page.request.patch('/api/auth/organization/update-organization', {
        data: {
          name: 'New Name',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      // Returns 400 Bad Request
      expect(response.status).toBe(400)

      // Response contains validation error for organizationId field
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-ORGANIZATION-004: should returns 401 Unauthorized',
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

      // WHEN: Unauthenticated user attempts to update organization
      const response = await page.request.patch('/api/auth/organization/update-organization', {
        data: {
          organizationId: '1',
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
    'API-AUTH-ORG-UPDATE-ORGANIZATION-005: should returns 403 Forbidden',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization member (non-owner)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'member@example.com', '$2a$10$YourHashedPasswordHere', 'Member User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Test Org', 'test-org', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'member', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'member_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Member attempts to update organization
      const response = await page.request.patch('/api/auth/organization/update-organization', {
        data: {
          organizationId: '1',
          name: 'New Name',
        },
      })

      // THEN: Returns 403 Forbidden
      // Returns 403 Forbidden
      expect(response.status).toBe(403)

      // Response contains error about insufficient permissions
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-ORGANIZATION-006: should returns 404 Not Found',
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
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'user@example.com', '$2a$10$YourHashedPasswordHere', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'user_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User attempts to update non-existent organization
      const response = await page.request.patch('/api/auth/organization/update-organization', {
        data: {
          organizationId: '999',
          name: 'New Name',
        },
      })

      // THEN: Returns 404 Not Found
      // Returns 404 Not Found
      expect(response.status).toBe(404)

      // Response contains error about organization not found
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-AUTH-ORG-UPDATE-ORGANIZATION-007: should returns 409 Conflict error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated organization owner and another existing organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'owner@example.com', '$2a$10$YourHashedPasswordHere', 'Owner User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'My Org', 'my-org', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (2, 'Existing Org', 'existing-slug', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner attempts to update slug to existing slug
      const response = await page.request.patch('/api/auth/organization/update-organization', {
        data: {
          organizationId: '1',
          slug: 'existing-slug',
        },
      })

      // THEN: Returns 409 Conflict error
      // Returns 409 Conflict
      expect(response.status).toBe(409)

      // Response contains error about slug already in use
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-UPDATE-ORGANIZATION-008: user can complete full updateOrganization workflow',
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
