/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Organization Slug Handling
 *
 * Domain: api
 * Spec Count: 7
 */

test.describe('Organization Slug Handling', () => {
  test.fixme(
    'API-AUTH-ORG-OPT-SLUG-001: should auto-generate slug from organization name',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: User creates organization with name
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          name: 'Acme Corporation',
        },
      })

      // WHEN: Fetch organization details
      const response = await request.get('/api/auth/organization/get-details', {
        params: { organizationId: owner.organizationId },
      })

      // THEN: Slug should be auto-generated from name
      expect(response.status()).toBe(200)
      const org = await response.json()
      expect(org.slug).toBeDefined()
      expect(org.slug).toBe('acme-corporation')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-SLUG-002: should accept custom slug on creation',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: User creates organization with custom slug
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // WHEN: Update organization with custom slug
      const response = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          name: 'Acme Corporation',
          slug: 'acme-corp',
        },
      })

      // THEN: Custom slug should be used
      expect(response.status()).toBe(200)
      const org = await response.json()
      expect(org.slug).toBe('acme-corp')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-SLUG-003: should return 400 when slug conflicts with existing',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with existing slug
      await startServerWithSchema({ name: 'test-app' })
      const owner1 = await createAuthenticatedUser({
        email: 'owner1@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner1.organizationId,
          slug: 'acme-corp',
        },
      })

      const owner2 = await createAuthenticatedUser({
        email: 'owner2@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // WHEN: Try to use same slug for different organization
      const response = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner2.organizationId,
          slug: 'acme-corp',
        },
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('slug')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-SLUG-004: should validate slug format (alphanumeric-dash)',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Authenticated organization owner
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // WHEN: Try to set invalid slug formats
      const invalidSlugs = [
        'invalid slug', // Contains space
        'invalid_slug', // Contains underscore
        'Invalid-Slug', // Contains uppercase
        'invalid@slug', // Contains special char
        'invalid.slug', // Contains dot
      ]

      for (const invalidSlug of invalidSlugs) {
        const response = await request.patch('/api/auth/organization/update', {
          data: {
            organizationId: owner.organizationId,
            slug: invalidSlug,
          },
        })

        // THEN: Should return 400 for invalid format
        expect(response.status()).toBe(400)
        const error = await response.json()
        expect(error.message).toContain('slug')
      }

      // WHEN: Set valid slug
      const validResponse = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          slug: 'valid-slug-123',
        },
      })

      // THEN: Valid slug should succeed
      expect(validResponse.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-SLUG-005: should prevent slug update after creation',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Organization with initial slug
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          slug: 'initial-slug',
        },
      })

      // WHEN: Try to update slug
      const response = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          slug: 'new-slug',
        },
      })

      // THEN: Should return 400 if slug updates are prevented
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('slug')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-SLUG-006: should allow slug update with owner permission',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      // GIVEN: Organization with owner and admin
      await startServerWithSchema({ name: 'test-app' })
      const owner = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          slug: 'initial-slug',
        },
      })

      const admin = await signUp({
        email: 'admin@example.com',
        password: 'Password123!',
        name: 'Admin User',
      })

      await addMember({
        organizationId: owner.organizationId!,
        userId: admin.user.id,
        role: 'admin',
      })

      // WHEN: Admin tries to update slug
      const adminResponse = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: owner.organizationId,
          slug: 'admin-new-slug',
        },
        headers: {
          Authorization: `Bearer ${admin.session.token}`,
        },
      })

      // THEN: Should be rejected (admin cannot update slug)
      expect(adminResponse.status()).toBe(403)

      // WHEN: Owner updates slug
      const ownerResponse = await request.patch('/api/auth/organization/update-slug', {
        data: {
          organizationId: owner.organizationId,
          slug: 'owner-new-slug',
        },
      })

      // THEN: Owner should succeed
      expect(ownerResponse.status()).toBe(200)
      const org = await ownerResponse.json()
      expect(org.slug).toBe('owner-new-slug')
    }
  )

  test.fixme(
    'API-AUTH-ORG-OPT-SLUG-007: system can manage slug uniqueness across organizations',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, request }) => {
      // GIVEN: Multiple organizations
      await startServerWithSchema({ name: 'test-app' })

      const org1 = await createAuthenticatedUser({
        email: 'org1@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      const org2 = await createAuthenticatedUser({
        email: 'org2@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // WHEN/THEN: Set unique slugs
      const slug1Response = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: org1.organizationId,
          slug: 'company-one',
        },
      })
      expect(slug1Response.status()).toBe(200)

      const slug2Response = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: org2.organizationId,
          slug: 'company-two',
        },
      })
      expect(slug2Response.status()).toBe(200)

      // WHEN/THEN: Attempt duplicate slug
      const duplicateResponse = await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: org2.organizationId,
          slug: 'company-one',
        },
      })
      expect(duplicateResponse.status()).toBe(400)

      // WHEN/THEN: Auto-generation creates unique slugs
      const org3 = await createAuthenticatedUser({
        email: 'org3@example.com',
        password: 'Password123!',
        createOrganization: true,
      })

      await request.patch('/api/auth/organization/update', {
        data: {
          organizationId: org3.organizationId,
          name: 'Company One', // Same name as org1
        },
      })

      const org3Details = await request
        .get('/api/auth/organization/get-details', {
          params: { organizationId: org3.organizationId },
        })
        .then((r) => r.json())

      // Should generate unique slug (e.g., company-one-1 or similar)
      expect(org3Details.slug).not.toBe('company-one')
      expect(org3Details.slug).toContain('company')

      // WHEN/THEN: Verify all slugs are unique
      const allOrgs = await request.get('/api/auth/organization/list').then((r) => r.json())

      const slugs = allOrgs.map((org: any) => org.slug)
      const uniqueSlugs = new Set(slugs)
      expect(slugs.length).toBe(uniqueSlugs.size)
    }
  )
})
