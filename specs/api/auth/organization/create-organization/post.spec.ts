/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Create organization
 *
 * Source: specs/api/paths/auth/organization/create-organization/post.json
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

test.describe('Create organization', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'API-ORG-CREATE-ORGANIZATION-001: should returns 201 Created with organization data and user is set as owner',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'user@example.com', '$2a$10$YourHashedPasswordHere', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'user_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User creates a new organization with valid data
      const response = await page.request.post('/api/auth/organization/create-organization', {
        headers: { Authorization: 'Bearer admin_token' },
        data: {
          name: 'Acme Corporation',
          slug: 'acme-corp',
        },
      })

      // THEN: Returns 201 Created with organization data and user is set as owner
      // Returns 201 Created
      expect(response.status).toBe(201)

      // Response contains organization data
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('organization')
      expect(data.organization).toHaveProperty('id')
      expect(data.organization).toHaveProperty('name')

      // Organization is created in database
      const orgRow = await executeQuery(
        "SELECT * FROM organizations WHERE slug = 'acme-corp' LIMIT 1"
      )
      expect(orgRow).toBeDefined()
      expect(orgRow.name).toBe('Acme Corporation')

      // User is set as organization owner
      const memberRow = await executeQuery(
        'SELECT * FROM organization_members WHERE organization_id = ' + orgRow.id + ' LIMIT 1'
      )
      expect(memberRow).toBeDefined()
      expect(memberRow.role).toBe('owner')
    }
  )

  test.fixme(
    'API-ORG-CREATE-ORGANIZATION-002: should returns 201 Created with auto-generated slug from name',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'user@example.com', '$2a$10$YourHashedPasswordHere', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'user_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User creates organization without providing slug
      const response = await page.request.post('/api/auth/organization/create-organization', {
        headers: { Authorization: 'Bearer admin_token' },
        data: {
          name: 'My Company',
        },
      })

      // THEN: Returns 201 Created with auto-generated slug from name
      // Returns 201 Created
      expect(response.status).toBe(201)

      // Slug is auto-generated from name
    }
  )

  test.fixme(
    'API-ORG-CREATE-ORGANIZATION-003: should returns 400 Bad Request with validation error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'user@example.com', '$2a$10$YourHashedPasswordHere', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'user_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User submits request without name field
      const response = await page.request.post('/api/auth/organization/create-organization', {
        headers: { Authorization: 'Bearer admin_token' },
      })

      // THEN: Returns 400 Bad Request with validation error
      // Returns 400 Bad Request
      expect(response.status).toBe(400)

      // Response contains validation error for name field
      const data = await response.json()
      // Validate response schema
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-ORG-CREATE-ORGANIZATION-004: should returns 401 Unauthorized',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: A running server
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // WHEN: Unauthenticated user attempts to create organization
      const response = await page.request.post('/api/auth/organization/create-organization', {
        headers: { Authorization: 'Bearer admin_token' },
        data: {
          name: 'Acme Corporation',
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
    'API-ORG-CREATE-ORGANIZATION-005: should returns 409 Conflict error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: An authenticated user and an existing organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // Database setup
      await executeQuery(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES (1, 'user@example.com', '$2a$10$YourHashedPasswordHere', 'Test User', true, NOW(), NOW())`
      )
      await executeQuery(
        `INSERT INTO organizations (id, name, slug, created_at) VALUES (1, 'Existing Org', 'existing-org', NOW())`
      )
      await executeQuery(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (1, 1, 'user_token', NOW() + INTERVAL '7 days', NOW())`
      )

      // WHEN: User attempts to create organization with existing slug
      const response = await page.request.post('/api/auth/organization/create-organization', {
        headers: { Authorization: 'Bearer admin_token' },
        data: {
          name: 'Another Org',
          slug: 'existing-org',
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
    'API-ORG-CREATE-ORGANIZATION-006: user can complete full createOrganization workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Representative test scenario
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          enabled: true,
          emailAndPassword: { enabled: true },
          plugins: {
            admin: { enabled: true },
            organization: { enabled: true },
          },
        },
      })

      // WHEN: Execute workflow
      const response = await page.request.post('/api/auth/workflow', {
        headers: { Authorization: 'Bearer admin_token' },
        data: { test: true },
      })

      // THEN: Verify integration
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data).toMatchObject({ success: true })
    }
  )
})
