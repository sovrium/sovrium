/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API-Level Record Permissions (Owner-Based Access)
 *
 * PURPOSE: Verify that record-level permissions (owner-based access) are enforced via API
 *
 * TESTING STRATEGY (Hybrid Approach):
 * - Database-level tests (specs/app/tables/permissions/record-permissions.spec.ts)
 *   verify RLS policies with owner_id conditions
 * - API-level tests (this file) verify:
 *   1. Owner can access their own records
 *   2. Non-owners cannot access others' records
 *   3. owner_id is auto-set on create
 *   4. Admin can override owner restrictions
 *
 * PERMISSION TYPES:
 * - { type: 'owner', field: 'owner_id' } - Only record owner can access
 * - { type: 'owner', field: 'created_by' } - Custom owner field
 * - Admin access controlled via role-based permissions on separate operations
 *
 * Domain: api
 * Spec Count: 7
 */

test.describe('API Record-Level Permissions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of owner-based access via API
  // ============================================================================

  test(
    'API-TABLES-PERMISSIONS-RECORD-001: owner can read their own records',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
      signIn,
      setActiveOrganization,
    }) => {
      // GIVEN: Table with owner-based read permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'personal_notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
              { id: 3, name: 'owner_id', type: 'user' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'owner', field: 'owner_id' }, // Only owner can read
              create: { type: 'authenticated' },
            },
          },
        ],
      })

      // Create first user and their organization (user becomes owner/member automatically)
      const user = await createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'password123',
      })
      const org = await createOrganization({ name: 'Test Org' })

      // Create second user (will be in different organization context)
      const otherUser = await createAuthenticatedUser({ email: 'otheruser@example.com' })

      // Insert records owned by both users in the FIRST user's organization
      await executeQuery(`
        INSERT INTO personal_notes (id, content, owner_id, organization_id) VALUES
          (1, 'My private note', '${user.user.id}', '${org.organization.id}'),
          (2, 'Another user note', '${otherUser.user.id}', '${org.organization.id}')
      `)

      // Sign back in as the first user (since createAuthenticatedUser for otherUser changed the session)
      await signIn({ email: 'owner@example.com', password: 'password123' })
      await setActiveOrganization(org.organization.id)

      // WHEN: Owner requests their records
      const response = await request.get('/api/tables/1/records')

      // THEN: Only owner's records are returned
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(1)
      expect(data.records[0].fields.content).toBe('My private note')
      expect(data.records[0].fields.owner_id).toBe(user.user.id)
    }
  )

  test(
    'API-TABLES-PERMISSIONS-RECORD-002: non-owner cannot read others records',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
      signIn,
      setActiveOrganization,
    }) => {
      // GIVEN: Table with owner-based read permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'personal_notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
              { id: 3, name: 'owner_id', type: 'user' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'owner', field: 'owner_id' },
            },
          },
        ],
      })

      await createAuthenticatedUser({
        email: 'user@example.com',
        password: 'password123',
      })
      const org = await createOrganization({ name: 'Test Org' })

      // Create another user who will own the record
      const otherUser = await createAuthenticatedUser({ email: 'otheruser@example.com' })

      // Record owned by someone else
      await executeQuery(`
        INSERT INTO personal_notes (id, content, owner_id, organization_id) VALUES
          (1, 'Someone else private note', '${otherUser.user.id}', '${org.organization.id}')
      `)

      // Sign back in as the first user (since createAuthenticatedUser for otherUser changed the session)
      await signIn({ email: 'user@example.com', password: 'password123' })
      await setActiveOrganization(org.organization.id)

      // WHEN: Non-owner tries to access by ID
      const response = await request.get('/api/tables/1/records/1')

      // THEN: 404 Not Found (don't leak existence)
      expect(response.status()).toBe(404)
    }
  )

  test(
    'API-TABLES-PERMISSIONS-RECORD-003: owner_id is auto-set to current user on create',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table with owner-based permissions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'personal_notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
              { id: 3, name: 'owner_id', type: 'user' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'owner', field: 'owner_id' },
              create: { type: 'authenticated' },
            },
          },
        ],
      })

      const user = await createAuthenticatedUser({ email: 'user@example.com' })
      await createOrganization({ name: 'Test Org' })

      // WHEN: User creates a note without specifying owner_id
      const response = await request.post('/api/tables/1/records', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: 'My new note',
          // Note: NOT providing owner_id
        },
      })

      // THEN: Record is created with current user as owner
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data.owner_id).toBe(user.user.id)

      // Verify in database
      const dbResult = await executeQuery(
        "SELECT owner_id FROM personal_notes WHERE content = 'My new note'"
      )
      expect(dbResult.rows[0].owner_id).toBe(user.user.id)
    }
  )

  test(
    'API-TABLES-PERMISSIONS-RECORD-004: owner can update their own records',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Owner has a record
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'personal_notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
              { id: 3, name: 'owner_id', type: 'user' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'owner', field: 'owner_id' },
              update: { type: 'owner', field: 'owner_id' },
            },
          },
        ],
      })

      const user = await createAuthenticatedUser({ email: 'owner@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      await executeQuery(`
        INSERT INTO personal_notes (id, content, owner_id, organization_id) VALUES
          (1, 'Original content', '${user.user.id}', '${org.organization.id}')
      `)

      // WHEN: Owner updates their record
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: 'Updated content',
        },
      })

      // THEN: Update succeeds
      expect(response.status()).toBe(200)

      const dbResult = await executeQuery('SELECT content FROM personal_notes WHERE id = 1')
      expect(dbResult.rows[0].content).toBe('Updated content')
    }
  )

  test.fixme(
    'API-TABLES-PERMISSIONS-RECORD-005: non-owner cannot update others records',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Record owned by someone else
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'personal_notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
              { id: 3, name: 'owner_id', type: 'single-line-text' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'authenticated' }, // Anyone can read
              update: { type: 'owner', field: 'owner_id' }, // Only owner can update
            },
          },
        ],
      })

      await createAuthenticatedUser({ email: 'attacker@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      await executeQuery(`
        INSERT INTO personal_notes (id, content, owner_id, organization_id) VALUES
          (1, 'Original content', 'other-user-id', '${org.organization.id}')
      `)

      // WHEN: Non-owner tries to update
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          content: 'Hacked content',
        },
      })

      // THEN: 403 Forbidden (user CAN read via 'authenticated' but cannot update)
      // Note: 403 because read permission is 'authenticated' (user can see the record)
      // If read permission was also 'owner', it would be 404 (can't see record at all)
      expect(response.status()).toBe(403)

      // Verify content unchanged
      const dbResult = await executeQuery('SELECT content FROM personal_notes WHERE id = 1')
      expect(dbResult.rows[0].content).toBe('Original content')
    }
  )

  test.fixme(
    'API-TABLES-PERMISSIONS-RECORD-006: admin can access all records via role-based read permission',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedAdmin,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table with role-based read (admin can read all) but owner-based update
      // This demonstrates the pattern for "admin can see, but only owner can modify"
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'support_tickets',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'subject', type: 'single-line-text' },
              { id: 3, name: 'owner_id', type: 'single-line-text' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              // Admin can read all tickets, members only their own
              read: { type: 'roles', roles: ['admin'] },
              // Only owner can update their ticket
              update: { type: 'owner', field: 'owner_id' },
            },
          },
        ],
      })

      await createAuthenticatedAdmin({ email: 'admin@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // Record owned by regular user
      await executeQuery(`
        INSERT INTO support_tickets (id, subject, owner_id, organization_id) VALUES
          (1, 'Help with billing', 'regular-user-id', '${org.organization.id}')
      `)

      // WHEN: Admin reads the ticket
      const response = await request.get('/api/tables/1/records/1')

      // THEN: Admin can see the record (role-based read)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.subject).toBe('Help with billing')
    }
  )

  test.fixme(
    'API-TABLES-PERMISSIONS-RECORD-007: custom owner field (created_by instead of owner_id)',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table using custom owner field (created_by instead of owner_id)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'created_by', type: 'single-line-text' }, // Custom owner field
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'owner', field: 'created_by' },
              update: { type: 'owner', field: 'created_by' },
              delete: { type: 'owner', field: 'created_by' },
            },
          },
        ],
      })

      const user = await createAuthenticatedUser({ email: 'creator@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      await executeQuery(`
        INSERT INTO documents (id, title, created_by, organization_id) VALUES
          (1, 'My Document', '${user.user.id}', '${org.organization.id}'),
          (2, 'Other Document', 'other-user-id', '${org.organization.id}')
      `)

      // WHEN: User lists documents
      const response = await request.get('/api/tables/1/records')

      // THEN: Only their document (matched by created_by) is returned
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(1)
      expect(data.records[0].fields.title).toBe('My Document')
    }
  )

  // ============================================================================
  // @regression test - Complete workflow validation
  // Generated from 7 @spec tests - covers owner-based record access control
  // ============================================================================

  test.fixme(
    'API-TABLES-PERMISSIONS-RECORD-REGRESSION: complete owner-based access workflow',
    { tag: '@regression' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createAuthenticatedAdmin,
      createOrganization,
      addMember,
      executeQuery,
      signOut,
    }) => {
      let org: { organization: { id: string } }
      let ownerUser: { user: { id: string } }
      let otherUser: { user: { id: string } }

      await test.step('Setup: Create schema with owner-based permissions and users', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            organization: true,
          },
          tables: [
            {
              id: 1,
              name: 'personal_notes',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'content', type: 'long-text' },
                { id: 3, name: 'owner_id', type: 'single-line-text' },
                { id: 4, name: 'organization_id', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                organizationScoped: true,
                read: { type: 'owner', field: 'owner_id' },
                create: { type: 'authenticated' },
                update: { type: 'owner', field: 'owner_id' },
                delete: { type: 'owner', field: 'owner_id' },
              },
            },
            {
              id: 2,
              name: 'support_tickets',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'subject', type: 'single-line-text' },
                { id: 3, name: 'owner_id', type: 'single-line-text' },
                { id: 4, name: 'organization_id', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                organizationScoped: true,
                read: { type: 'roles', roles: ['admin'] },
                update: { type: 'owner', field: 'owner_id' },
              },
            },
            {
              id: 3,
              name: 'documents',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text' },
                { id: 3, name: 'created_by', type: 'single-line-text' },
                { id: 4, name: 'organization_id', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                organizationScoped: true,
                read: { type: 'owner', field: 'created_by' },
                update: { type: 'owner', field: 'created_by' },
                delete: { type: 'owner', field: 'created_by' },
              },
            },
            {
              id: 4,
              name: 'public_notes',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'content', type: 'long-text' },
                { id: 3, name: 'owner_id', type: 'single-line-text' },
                { id: 4, name: 'organization_id', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                organizationScoped: true,
                read: { type: 'authenticated' },
                update: { type: 'owner', field: 'owner_id' },
              },
            },
          ],
        })

        ownerUser = await createAuthenticatedUser({ email: 'owner@example.com' })
        org = await createOrganization({ name: 'Shared Org' })

        await signOut()

        otherUser = await createAuthenticatedUser({ email: 'other@example.com' })
        await addMember({
          organizationId: org.organization.id,
          userId: otherUser.user.id,
          role: 'member',
        })
      })

      await test.step('API-TABLES-PERMISSIONS-RECORD-003: Owner_id auto-set on create', async () => {
        // WHEN: User creates a note without specifying owner_id
        await signOut()
        await createAuthenticatedUser({ email: 'owner@example.com' })

        const response = await request.post('/api/tables/1/records', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'My new note' },
        })

        // THEN: Record is created with current user as owner
        expect(response.status()).toBe(201)
        const data = await response.json()
        expect(data.owner_id).toBe(ownerUser.user.id)

        // Verify in database
        const dbResult = await executeQuery(
          "SELECT owner_id FROM personal_notes WHERE content = 'My new note'"
        )
        expect(dbResult.rows[0].owner_id).toBe(ownerUser.user.id)
      })

      await test.step('API-TABLES-PERMISSIONS-RECORD-001: Owner reads their own records', async () => {
        // Insert records owned by this user and another user
        await executeQuery(`
          INSERT INTO personal_notes (id, content, owner_id, organization_id) VALUES
            (100, 'My private note', '${ownerUser.user.id}', '${org.organization.id}'),
            (101, 'Another user note', 'other-user-id', '${org.organization.id}')
        `)

        // WHEN: Owner requests their records
        const response = await request.get('/api/tables/1/records')

        // THEN: Only owner's records are returned
        expect(response.status()).toBe(200)
        const data = await response.json()
        const privateNote = data.records.find((r: any) => r.fields.content === 'My private note')
        expect(privateNote).toBeDefined()
        expect(privateNote.fields.owner_id).toBe(ownerUser.user.id)
      })

      await test.step('API-TABLES-PERMISSIONS-RECORD-002: Non-owner cannot read others records', async () => {
        // WHEN: Non-owner tries to access record by ID
        await signOut()
        await createAuthenticatedUser({ email: 'other@example.com' })

        const response = await request.get('/api/tables/1/records/100')

        // THEN: 404 Not Found (don't leak existence)
        expect(response.status()).toBe(404)
      })

      await test.step('API-TABLES-PERMISSIONS-RECORD-004: Owner updates their own records', async () => {
        // Switch back to owner
        await signOut()
        await createAuthenticatedUser({ email: 'owner@example.com' })

        // WHEN: Owner updates their record
        const response = await request.patch('/api/tables/1/records/100', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'Updated content' },
        })

        // THEN: Update succeeds
        expect(response.status()).toBe(200)

        const dbResult = await executeQuery('SELECT content FROM personal_notes WHERE id = 100')
        expect(dbResult.rows[0].content).toBe('Updated content')
      })

      await test.step('API-TABLES-PERMISSIONS-RECORD-005: Non-owner cannot update others records', async () => {
        // Setup: Create public note owned by owner (readable by all, updatable by owner only)
        await executeQuery(`
          INSERT INTO public_notes (id, content, owner_id, organization_id) VALUES
            (200, 'Original content', 'other-owner-id', '${org.organization.id}')
        `)

        await signOut()
        await createAuthenticatedUser({ email: 'other@example.com' })

        // WHEN: Non-owner tries to update
        const response = await request.patch('/api/tables/4/records/200', {
          headers: { 'Content-Type': 'application/json' },
          data: { content: 'Hacked content' },
        })

        // THEN: 403 Forbidden (user CAN read via 'authenticated' but cannot update)
        expect(response.status()).toBe(403)

        // Verify content unchanged
        const dbResult = await executeQuery('SELECT content FROM public_notes WHERE id = 200')
        expect(dbResult.rows[0].content).toBe('Original content')
      })

      await test.step('API-TABLES-PERMISSIONS-RECORD-006: Admin accesses all records via role-based read', async () => {
        // Setup: Insert ticket owned by regular user
        await executeQuery(`
          INSERT INTO support_tickets (id, subject, owner_id, organization_id) VALUES
            (300, 'Help with billing', 'regular-user-id', '${org.organization.id}')
        `)

        await signOut()
        await createAuthenticatedAdmin({ email: 'admin@example.com' })

        // WHEN: Admin reads the ticket
        const response = await request.get('/api/tables/2/records/300')

        // THEN: Admin can see the record (role-based read)
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.subject).toBe('Help with billing')
      })

      await test.step('API-TABLES-PERMISSIONS-RECORD-007: Custom owner field works correctly', async () => {
        // Setup: Insert documents with created_by field
        await signOut()
        const creator = await createAuthenticatedUser({ email: 'creator@example.com' })
        await addMember({
          organizationId: org.organization.id,
          userId: creator.user.id,
          role: 'member',
        })

        await executeQuery(`
          INSERT INTO documents (id, title, created_by, organization_id) VALUES
            (400, 'My Document', '${creator.user.id}', '${org.organization.id}'),
            (401, 'Other Document', 'other-user-id', '${org.organization.id}')
        `)

        // WHEN: User lists documents
        const response = await request.get('/api/tables/3/records')

        // THEN: Only their document (matched by created_by) is returned
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.records).toHaveLength(1)
        expect(data.records[0].fields.title).toBe('My Document')
      })
    }
  )
})
