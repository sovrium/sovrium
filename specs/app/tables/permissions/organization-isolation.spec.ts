/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Organization Data Isolation
 *
 * Domain: app/tables/permissions
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Organization Isolation Scenarios:
 * - Cross-organization data access prevention
 * - Organization-scoped queries
 * - Organization member permissions
 * - Multi-tenant data isolation
 */

test.describe('Organization Data Isolation', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-001: should prevent access to data from other organizations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Multi-organization setup with separate data
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'integer' },
            ],
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      await executeQuery([
        // Organizations
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES
         (1, 'Org A', 'org-a', NOW(), NOW()),
         (2, 'Org B', 'org-b', NOW(), NOW())`,
        // Users
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'user1@org-a.com', '$2a$10$hash', 'User 1', true, NOW(), NOW()),
         (2, 'user2@org-b.com', '$2a$10$hash', 'User 2', true, NOW(), NOW())`,
        // Organization memberships
        `INSERT INTO organization_members (id, user_id, organization_id, role, created_at) VALUES
         (1, 1, 1, 'member', NOW()),
         (2, 2, 2, 'member', NOW())`,
        // Sessions
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'org_a_user_token', NOW() + INTERVAL '7 days'),
         (2, 2, 'org_b_user_token', NOW() + INTERVAL '7 days')`,
        // Projects
        `INSERT INTO projects (id, name, organization_id) VALUES
         (1, 'Org A Project 1', 1),
         (2, 'Org A Project 2', 1),
         (3, 'Org B Project 1', 2)`,
      ])

      // WHEN: Org A user queries projects
      const response = await page.request.get('/api/tables/projects/records', {
        headers: { Authorization: 'Bearer org_a_user_token' },
      })

      // THEN: Only Org A projects returned
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records).toHaveLength(2)
      expect(data.records.every((p: { organization_id: number }) => p.organization_id === 1)).toBe(
        true
      )
    }
  )

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-002: should deny direct access to other organization records',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Multi-organization setup
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'integer' },
            ],
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      await executeQuery([
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES
         (1, 'Org A', 'org-a', NOW(), NOW()),
         (2, 'Org B', 'org-b', NOW(), NOW())`,
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'user@org-a.com', '$2a$10$hash', 'User', true, NOW(), NOW())`,
        `INSERT INTO organization_members (id, user_id, organization_id, role, created_at) VALUES
         (1, 1, 1, 'member', NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'org_a_token', NOW() + INTERVAL '7 days')`,
        `INSERT INTO documents (id, title, organization_id) VALUES
         (1, 'Org A Doc', 1),
         (2, 'Org B Confidential', 2)`,
      ])

      // WHEN: Org A user tries to access Org B document directly
      const response = await page.request.get('/api/tables/documents/records/2', {})

      // THEN: Access denied
      expect([403, 404]).toContain(response.status())
    }
  )

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-003: should prevent creating records in other organizations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Multi-organization setup
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'integer' },
            ],
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      await executeQuery([
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES
         (1, 'Org A', 'org-a', NOW(), NOW()),
         (2, 'Org B', 'org-b', NOW(), NOW())`,
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'user@org-a.com', '$2a$10$hash', 'User', true, NOW(), NOW())`,
        `INSERT INTO organization_members (id, user_id, organization_id, role, created_at) VALUES
         (1, 1, 1, 'member', NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'org_a_token', NOW() + INTERVAL '7 days')`,
      ])

      // WHEN: Org A user tries to create task in Org B
      const response = await page.request.post('/api/tables/tasks/records', {
        data: {
          title: 'Sneaky Task',
          organization_id: 2, // Trying to create in Org B
        },
      })

      // THEN: Either denied or auto-corrected to user's org
      if (response.ok()) {
        const data = await response.json()
        expect(data.record.organization_id).toBe(1) // Auto-corrected
      } else {
        expect(response.status()).toBe(403)
      }
    }
  )

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-004: should prevent updating records in other organizations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Multi-organization setup with records
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'settings',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'value', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'integer' },
            ],
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      await executeQuery([
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES
         (1, 'Org A', 'org-a', NOW(), NOW()),
         (2, 'Org B', 'org-b', NOW(), NOW())`,
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'user@org-a.com', '$2a$10$hash', 'User', true, NOW(), NOW())`,
        `INSERT INTO organization_members (id, user_id, organization_id, role, created_at) VALUES
         (1, 1, 1, 'member', NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'org_a_token', NOW() + INTERVAL '7 days')`,
        `INSERT INTO settings (id, value, organization_id) VALUES
         (1, 'Org A Setting', 1),
         (2, 'Org B Secret Setting', 2)`,
      ])

      // WHEN: Org A user tries to update Org B setting
      const response = await page.request.patch('/api/tables/settings/records/2', {
        data: { value: 'Hacked Value' },
      })

      // THEN: Update denied
      expect([403, 404]).toContain(response.status())

      // Original value unchanged
      const setting = await executeQuery(`SELECT value FROM settings WHERE id = 2`)
      expect(setting[0].value).toBe('Org B Secret Setting')
    }
  )

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-005: should prevent deleting records in other organizations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Multi-organization setup with records
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'integer' },
            ],
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      await executeQuery([
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES
         (1, 'Org A', 'org-a', NOW(), NOW()),
         (2, 'Org B', 'org-b', NOW(), NOW())`,
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'user@org-a.com', '$2a$10$hash', 'User', true, NOW(), NOW())`,
        `INSERT INTO organization_members (id, user_id, organization_id, role, created_at) VALUES
         (1, 1, 1, 'member', NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'org_a_token', NOW() + INTERVAL '7 days')`,
        `INSERT INTO items (id, name, organization_id) VALUES
         (1, 'Org A Item', 1),
         (2, 'Org B Item', 2)`,
      ])

      // WHEN: Org A user tries to delete Org B item
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- This is Playwright API call, not Drizzle
      const response = await page.request.delete('/api/tables/items/records/2', {})

      // THEN: Delete denied
      expect([403, 404]).toContain(response.status())

      // Item still exists
      const item = await executeQuery(`SELECT * FROM items WHERE id = 2`)
      expect(item).toHaveLength(1)
    }
  )

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-006: should allow organization admin to access all org data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Organization with admin and member
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'internal_docs',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
              { id: 3, name: 'organization_id', type: 'integer' },
              { id: 4, name: 'created_by', type: 'integer' },
            ],
            permissions: {
              organizationScoped: true,
              read: { type: 'roles', roles: ['admin', 'member'] },
              create: { type: 'roles', roles: ['admin'] },
              update: { type: 'roles', roles: ['admin'] },
              delete: { type: 'roles', roles: ['admin'] },
            },
          },
        ],
      })

      await executeQuery([
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES
         (1, 'Org', 'org', NOW(), NOW())`,
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'admin@org.com', '$2a$10$hash', 'Admin', true, NOW(), NOW()),
         (2, 'member@org.com', '$2a$10$hash', 'Member', true, NOW(), NOW())`,
        `INSERT INTO organization_members (id, user_id, organization_id, role, created_at) VALUES
         (1, 1, 1, 'admin', NOW()),
         (2, 2, 1, 'member', NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'admin_token', NOW() + INTERVAL '7 days'),
         (2, 2, 'member_token', NOW() + INTERVAL '7 days')`,
        `INSERT INTO internal_docs (id, content, organization_id, created_by) VALUES
         (1, 'Admin created doc', 1, 1),
         (2, 'Member created doc', 1, 2)`,
      ])

      // WHEN: Admin queries all docs
      const adminResponse = await page.request.get('/api/tables/internal_docs/records', {})

      // THEN: Admin sees all organization docs
      expect(adminResponse.status()).toBe(200)
      const adminData = await adminResponse.json()
      expect(adminData.records).toHaveLength(2)

      // WHEN: Admin deletes member's doc
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- This is Playwright API call, not Drizzle
      const deleteResponse = await page.request.delete('/api/tables/internal_docs/records/2', {})

      // THEN: Delete succeeds
      expect(deleteResponse.status()).toBe(200)
    }
  )

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-007: should support users in multiple organizations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: User belonging to multiple organizations
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'team_notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'note', type: 'long-text' },
              { id: 3, name: 'organization_id', type: 'integer' },
            ],
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      await executeQuery([
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES
         (1, 'Org A', 'org-a', NOW(), NOW()),
         (2, 'Org B', 'org-b', NOW(), NOW())`,
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'user@example.com', '$2a$10$hash', 'Multi-Org User', true, NOW(), NOW())`,
        // User is member of both orgs
        `INSERT INTO organization_members (id, user_id, organization_id, role, created_at) VALUES
         (1, 1, 1, 'member', NOW()),
         (2, 1, 2, 'member', NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'user_token', NOW() + INTERVAL '7 days')`,
        `INSERT INTO team_notes (id, note, organization_id) VALUES
         (1, 'Org A Note', 1),
         (2, 'Org B Note', 2),
         (3, 'Org C Note', 3)`, // Org C - user not a member
      ])

      // WHEN: User queries with Org A context
      const orgAResponse = await page.request.get('/api/tables/team_notes/records', {
        headers: {
          'X-Organization-Id': '1',
        },
      })

      // THEN: Only Org A notes returned
      expect(orgAResponse.status()).toBe(200)
      const orgAData = await orgAResponse.json()
      expect(orgAData.records).toHaveLength(1)
      expect(orgAData.records[0].organization_id).toBe(1)

      // WHEN: User queries with Org B context
      const orgBResponse = await page.request.get('/api/tables/team_notes/records', {
        headers: {
          'X-Organization-Id': '2',
        },
      })

      // THEN: Only Org B notes returned
      expect(orgBResponse.status()).toBe(200)
      const orgBData = await orgBResponse.json()
      expect(orgBData.records).toHaveLength(1)
      expect(orgBData.records[0].organization_id).toBe(2)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-ORG-ISOLATION-008: organization data isolation workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Two organizations with separate data
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
          features: ['organization'],
        },
        tables: [
          {
            id: 1,
            name: 'resources',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'integer' },
            ],
            permissions: {
              organizationScoped: true,
            },
          },
        ],
      })

      await executeQuery([
        `INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES
         (1, 'Org A', 'org-a', NOW(), NOW()),
         (2, 'Org B', 'org-b', NOW(), NOW())`,
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'user@org-a.com', '$2a$10$hash', 'User', true, NOW(), NOW())`,
        `INSERT INTO organization_members (id, user_id, organization_id, role, created_at) VALUES
         (1, 1, 1, 'member', NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'user_token', NOW() + INTERVAL '7 days')`,
        `INSERT INTO resources (id, name, organization_id) VALUES
         (1, 'My Resource', 1),
         (2, 'Other Org Resource', 2)`,
      ])

      // Test 1: List - only own org resources
      const listResponse = await page.request.get('/api/tables/resources/records', {})
      expect(listResponse.status()).toBe(200)
      const listData = await listResponse.json()
      expect(listData.records).toHaveLength(1)

      // Test 2: Read other org - denied
      const readResponse = await page.request.get('/api/tables/resources/records/2', {})
      expect([403, 404]).toContain(readResponse.status())

      // Test 3: Update other org - denied
      const updateResponse = await page.request.patch('/api/tables/resources/records/2', {
        data: { name: 'Hacked' },
      })
      expect([403, 404]).toContain(updateResponse.status())

      // Test 4: Delete other org - denied
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- This is Playwright API call, not Drizzle
      const deleteResponse = await page.request.delete('/api/tables/resources/records/2', {})
      expect([403, 404]).toContain(deleteResponse.status())
    }
  )
})
