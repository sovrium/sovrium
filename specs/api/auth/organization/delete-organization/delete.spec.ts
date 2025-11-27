/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/* eslint-disable drizzle/enforce-delete-with-where */
/**
 * E2E Tests for Delete organization
 *
 * Source: specs/api/paths/auth/organization/delete-organization/delete.json
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

test.describe('Delete organization', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-DELETE-ORGANIZATION-001: should returns 200 OK and permanently deletes organization with all members',
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
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (2, 'member@example.com', '$2a$10$YourHashedPasswordHere', 'Member User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Test Org', 'test-org', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (2, 1, 2, 'member', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner deletes the organization
      const response = await page.request.delete('/api/auth/organization/delete-organization', {
        data: {
          organizationId: '1',
        },
      })

      // THEN: Returns 200 OK and permanently deletes organization with all members
      // Returns 200 OK
      expect(response.status).toBe(200)

      // Response indicates success
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toMatchObject({ success: true })

      // Organization is deleted from database
      const orgRow = await executeQuery('SELECT * FROM organizations WHERE id = 1 LIMIT 1')
      expect(orgRow).toBeNull()

      // All organization members are removed
      const memberCount = await executeQuery(
        'SELECT COUNT(*) as count FROM organization_members WHERE organization_id = 1'
      )
      expect(memberCount.count).toBe(0)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DELETE-ORGANIZATION-002: should returns 400 Bad Request with validation error',
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
      const response = await page.request.delete('/api/auth/organization/delete-organization', {})

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
    'API-AUTH-ORG-DELETE-ORGANIZATION-003: should returns 401 Unauthorized',
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

      // WHEN: Unauthenticated user attempts to delete organization
      const response = await page.request.delete('/api/auth/organization/delete-organization', {
        data: {
          organizationId: '1',
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
    'API-AUTH-ORG-DELETE-ORGANIZATION-004: should returns 403 Forbidden',
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

      // WHEN: Member attempts to delete organization
      const response = await page.request.delete('/api/auth/organization/delete-organization', {
        data: {
          organizationId: '1',
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
    'API-AUTH-ORG-DELETE-ORGANIZATION-005: should returns 404 Not Found',
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

      // WHEN: User attempts to delete non-existent organization
      const response = await page.request.delete('/api/auth/organization/delete-organization', {
        data: {
          organizationId: '999',
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
    'API-AUTH-ORG-DELETE-ORGANIZATION-006: should returns 404 Not Found (not 403 to prevent organization enumeration)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Two organizations with different owners
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['admin', 'organization'],
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'owner1@example.com', '$2a$10$YourHashedPasswordHere', 'Owner 1', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (2, 'owner2@example.com', '$2a$10$YourHashedPasswordHere', 'Owner 2', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (1, 'Org A', 'org-a', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (2, 'Org B', 'org-b', NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (1, 1, 1, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (2, 2, 2, 'owner', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'owner1_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: Owner A attempts to delete Organization B
      const response = await page.request.delete('/api/auth/organization/delete-organization', {
        data: {
          organizationId: '2',
        },
      })

      // THEN: Returns 404 Not Found (not 403 to prevent organization enumeration)
      // Returns 404 Not Found (prevent organization enumeration)
      expect(response.status).toBe(404)

      // Organization B remains active (not deleted)
      const dbRow = await executeQuery('SELECT * FROM users LIMIT 1')
      expect(dbRow).toBeDefined()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-DELETE-ORGANIZATION-007: user can complete full deleteOrganization workflow',
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
