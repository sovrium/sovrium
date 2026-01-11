/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Create Custom Role at Runtime
 *
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('Create Custom Role', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-CREATE-001: should return 201 Created with custom role data when owner creates role',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      // WHEN: Owner creates a custom role with permissions
      const response = await page.request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: organization.id,
          name: 'Project Manager',
          description: 'Can manage projects and view analytics',
          permission: ['project:read', 'project:write', 'analytics:read'],
        },
      })

      // THEN: Returns 201 Created with role data
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('name', 'Project Manager')
      expect(data).toHaveProperty('description', 'Can manage projects and view analytics')
      expect(data).toHaveProperty('permission')
      expect(data.permission).toEqual(['project:read', 'project:write', 'analytics:read'])
      expect(data).toHaveProperty('organizationId', organization.id)
      expect(data).toHaveProperty('createdAt')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-CREATE-002: should return 201 Created with role containing resource:action permissions',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      // WHEN: Owner creates role with resource:action format permissions
      const response = await page.request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: organization.id,
          name: 'Content Editor',
          permission: [
            'posts:create',
            'posts:read',
            'posts:update',
            'posts:delete',
            'media:upload',
            'media:read',
          ],
        },
      })

      // THEN: Returns 201 Created with properly formatted permissions
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data.permission).toHaveLength(6)
      expect(data.permission).toContain('posts:create')
      expect(data.permission).toContain('media:upload')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-CREATE-003: should return 403 Forbidden when non-owner tries to create role',
    { tag: '@spec' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      // GIVEN: Organization with owner and a member
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      const { invitation } = await inviteMember({
        organizationId: organization.id,
        email: 'member@example.com',
        role: 'member',
      })

      await signUp({
        email: 'member@example.com',
        password: 'MemberPass123!',
        name: 'Member User',
      })

      await acceptInvitation(invitation.id)

      // WHEN: Member tries to create a custom role
      const response = await page.request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: organization.id,
          name: 'Unauthorized Role',
          permission: ['some:permission'],
        },
      })

      // THEN: Returns 403 Forbidden (only owner/admin can create roles)
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('permission')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-CREATE-004: should return 400 Bad Request when role name is missing',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: An authenticated organization owner
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      // WHEN: Owner tries to create role without name
      const response = await page.request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: organization.id,
          permission: ['some:permission'],
        },
      })

      // THEN: Returns 400 Bad Request (name is required)
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('name')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-CREATE-005: should return 409 Conflict when role name already exists',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createOrganization, page }) => {
      // GIVEN: Organization with an existing custom role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })

      await signUp({
        email: 'owner@example.com',
        password: 'OwnerPass123!',
        name: 'Owner User',
      })

      const { organization } = await createOrganization({
        name: 'Test Company',
        slug: 'test-company',
      })

      await page.request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: organization.id,
          name: 'Project Manager',
          permission: ['project:read'],
        },
      })

      // WHEN: Owner tries to create another role with same name
      const response = await page.request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: organization.id,
          name: 'Project Manager',
          permission: ['project:write'],
        },
      })

      // THEN: Returns 409 Conflict (role names must be unique within organization)
      expect(response.status()).toBe(409)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('already exists')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-CREATE-006: should return 401 Unauthorized when user is not authenticated',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: Server running without authenticated user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: {
            dynamicRoles: true,
          },
        },
      })

      // WHEN: Unauthenticated user tries to create role
      const response = await page.request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: 'org-123',
          name: 'Some Role',
          permission: ['some:permission'],
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('Unauthorized')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-CREATE-REGRESSION: owner can create multiple custom roles with different permissions',
    { tag: '@regression' },
    async ({
      startServerWithSchema,
      signUp,
      createOrganization,
      inviteMember,
      acceptInvitation,
      page,
    }) => {
      let organization: { id: string }

      await test.step('Setup: Start server with comprehensive configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            organization: {
              dynamicRoles: true,
            },
          },
        })
      })

      await test.step('API-AUTH-ORG-DYNAMIC-ROLE-CREATE-006: Returns 401 Unauthorized when not authenticated', async () => {
        // WHEN: Unauthenticated user tries to create role
        const response = await page.request.post('/api/auth/organization/create-role', {
          data: {
            organizationId: 'org-123',
            name: 'Some Role',
            permission: ['some:permission'],
          },
        })

        // THEN: Returns 401 Unauthorized
        expect(response.status()).toBe(401)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('Unauthorized')
      })

      await test.step('Setup: Create owner and organization', async () => {
        await signUp({
          email: 'owner@example.com',
          password: 'OwnerPass123!',
          name: 'Owner User',
        })

        const result = await createOrganization({
          name: 'Test Company',
          slug: 'test-company',
        })
        organization = result.organization
      })

      await test.step('API-AUTH-ORG-DYNAMIC-ROLE-CREATE-004: Returns 400 Bad Request when name missing', async () => {
        // WHEN: Owner tries to create role without name
        const response = await page.request.post('/api/auth/organization/create-role', {
          data: {
            organizationId: organization.id,
            permission: ['some:permission'],
          },
        })

        // THEN: Returns 400 Bad Request (name is required)
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('name')
      })

      await test.step('API-AUTH-ORG-DYNAMIC-ROLE-CREATE-001: Returns 201 Created with custom role data', async () => {
        // WHEN: Owner creates a custom role with permissions
        const response = await page.request.post('/api/auth/organization/create-role', {
          data: {
            organizationId: organization.id,
            name: 'Project Manager',
            description: 'Can manage projects and view analytics',
            permission: ['project:read', 'project:write', 'analytics:read'],
          },
        })

        // THEN: Returns 201 Created with role data
        expect(response.status()).toBe(201)

        const data = await response.json()
        expect(data).toHaveProperty('id')
        expect(data).toHaveProperty('name', 'Project Manager')
        expect(data).toHaveProperty('description', 'Can manage projects and view analytics')
        expect(data).toHaveProperty('permission')
        expect(data.permission).toEqual(['project:read', 'project:write', 'analytics:read'])
        expect(data).toHaveProperty('organizationId', organization.id)
        expect(data).toHaveProperty('createdAt')
      })

      await test.step('API-AUTH-ORG-DYNAMIC-ROLE-CREATE-002: Returns 201 Created with resource:action permissions', async () => {
        // WHEN: Owner creates role with resource:action format permissions
        const response = await page.request.post('/api/auth/organization/create-role', {
          data: {
            organizationId: organization.id,
            name: 'Content Editor',
            permission: [
              'posts:create',
              'posts:read',
              'posts:update',
              'posts:delete',
              'media:upload',
              'media:read',
            ],
          },
        })

        // THEN: Returns 201 Created with properly formatted permissions
        expect(response.status()).toBe(201)

        const data = await response.json()
        expect(data.permission).toHaveLength(6)
        expect(data.permission).toContain('posts:create')
        expect(data.permission).toContain('media:upload')
      })

      await test.step('API-AUTH-ORG-DYNAMIC-ROLE-CREATE-005: Returns 409 Conflict when name exists', async () => {
        // WHEN: Owner tries to create another role with same name
        const response = await page.request.post('/api/auth/organization/create-role', {
          data: {
            organizationId: organization.id,
            name: 'Project Manager',
            permission: ['project:write'],
          },
        })

        // THEN: Returns 409 Conflict (role names must be unique within organization)
        expect(response.status()).toBe(409)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('already exists')
      })

      await test.step('Setup: Create member user for permission test', async () => {
        const { invitation } = await inviteMember({
          organizationId: organization.id,
          email: 'member@example.com',
          role: 'member',
        })

        await signUp({
          email: 'member@example.com',
          password: 'MemberPass123!',
          name: 'Member User',
        })

        await acceptInvitation(invitation.id)
      })

      await test.step('API-AUTH-ORG-DYNAMIC-ROLE-CREATE-003: Returns 403 Forbidden when non-owner creates role', async () => {
        // WHEN: Member tries to create a custom role
        const response = await page.request.post('/api/auth/organization/create-role', {
          data: {
            organizationId: organization.id,
            name: 'Unauthorized Role',
            permission: ['some:permission'],
          },
        })

        // THEN: Returns 403 Forbidden (only owner/admin can create roles)
        expect(response.status()).toBe(403)

        const data = await response.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('permission')
      })
    }
  )
})
