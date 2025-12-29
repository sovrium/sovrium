/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Complex Permission Conditions
 *
 * PURPOSE: Verify that custom SQL expressions and combined permission rules work correctly
 *
 * TESTING STRATEGY:
 * - Test the `custom` permission type with PostgreSQL expressions
 * - Test variable substitution ({userId}, {organizationId}, {roles})
 * - Test complex AND/OR conditions in custom expressions
 * - Test combined permissions across different operations
 *
 * PERMISSION TYPES TESTED:
 * - { type: 'custom', condition: '{userId} = owner_id' }
 * - { type: 'custom', condition: '{organizationId} = org_id AND status = \'active\'' }
 * - Custom conditions with role checks
 *
 * Domain: api
 * Spec Count: 7
 */

test.describe('API Complex Permission Conditions', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of custom permission conditions
  // ============================================================================

  test.fixme(
    'API-TABLES-PERMISSIONS-CONDITIONS-001: custom condition with userId variable substitution',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table with custom permission using {userId} variable
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'private_notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
              { id: 3, name: 'author_id', type: 'single-line-text' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              // Custom condition equivalent to owner-based but using raw SQL
              read: { type: 'custom', condition: '{userId} = author_id' },
              create: { type: 'authenticated' },
            },
          },
        ],
      })

      const user = await createAuthenticatedUser({ email: 'author@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // Insert notes: one by current user, one by another user
      await executeQuery(`
        INSERT INTO private_notes (id, content, author_id, organization_id) VALUES
          (1, 'My private note', '${user.user.id}', '${org.organization.id}'),
          (2, 'Someone else note', 'other-user-id', '${org.organization.id}')
      `)

      // WHEN: User requests notes via API
      const response = await request.get('/api/tables/1/records')

      // THEN: Only user's own notes are returned (custom condition evaluates {userId})
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(1)
      expect(data.records[0].content).toBe('My private note')
      expect(data.records[0].author_id).toBe(user.user.id)
    }
  )

  test(
    'API-TABLES-PERMISSIONS-CONDITIONS-002: custom condition with AND logic (status check)',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table with custom permission combining org check AND status check
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              // Custom: Only active projects visible to authenticated users
              read: {
                type: 'custom',
                condition: "{organizationId} = organization_id AND status = 'active'",
              },
            },
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // Insert projects with different statuses
      await executeQuery(`
        INSERT INTO projects (id, name, status, organization_id) VALUES
          (1, 'Active Project', 'active', '${org.organization.id}'),
          (2, 'Archived Project', 'archived', '${org.organization.id}'),
          (3, 'Draft Project', 'draft', '${org.organization.id}')
      `)

      // WHEN: User requests projects
      const response = await request.get('/api/tables/1/records')

      // THEN: Only active projects are returned
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(1)
      expect(data.records[0].fields.name).toBe('Active Project')
      expect(data.records[0].fields.status).toBe('active')
    }
  )

  test(
    'API-TABLES-PERMISSIONS-CONDITIONS-003: custom condition with OR logic using PostgreSQL syntax',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table with custom permission using OR logic
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
              { id: 3, name: 'visibility', type: 'single-line-text' },
              { id: 4, name: 'author_id', type: 'single-line-text' },
              { id: 5, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              // Custom: User can see public docs OR their own docs
              read: {
                type: 'custom',
                condition: "visibility = 'public' OR {userId} = author_id",
              },
            },
          },
        ],
      })

      const user = await createAuthenticatedUser({ email: 'user@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // Insert documents with different visibility
      await executeQuery(`
        INSERT INTO documents (id, title, visibility, author_id, organization_id) VALUES
          (1, 'Public Doc', 'public', 'other-user-id', '${org.organization.id}'),
          (2, 'My Private Doc', 'private', '${user.user.id}', '${org.organization.id}'),
          (3, 'Other Private Doc', 'private', 'other-user-id', '${org.organization.id}')
      `)

      // WHEN: User requests documents
      const response = await request.get('/api/tables/1/records')

      // THEN: User sees public docs and their own private docs
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(2)
      const titles = data.records.map((r: any) => r.fields.title)
      expect(titles).toContain('Public Doc')
      expect(titles).toContain('My Private Doc')
      expect(titles).not.toContain('Other Private Doc')
    }
  )

  test(
    'API-TABLES-PERMISSIONS-CONDITIONS-004: custom condition with numeric comparison',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table with custom permission using numeric comparison
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'description', type: 'single-line-text' },
              { id: 3, name: 'amount', type: 'decimal' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              // Custom: Only orders under $1000 visible to regular users
              // (high-value orders require admin access)
              read: { type: 'custom', condition: 'amount < 1000' },
            },
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // Insert orders with different amounts
      await executeQuery(`
        INSERT INTO orders (id, description, amount, organization_id) VALUES
          (1, 'Small Order', 500, '${org.organization.id}'),
          (2, 'Medium Order', 999, '${org.organization.id}'),
          (3, 'Large Order', 5000, '${org.organization.id}')
      `)

      // WHEN: User requests orders
      const response = await request.get('/api/tables/1/records')

      // THEN: Only orders under $1000 are returned
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(2)
      const descriptions = data.records.map((r: any) => r.fields.description)
      expect(descriptions).toContain('Small Order')
      expect(descriptions).toContain('Medium Order')
      expect(descriptions).not.toContain('Large Order')
    }
  )

  test(
    'API-TABLES-PERMISSIONS-CONDITIONS-005: different custom conditions for read vs update',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table with different custom conditions for read and update
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
              { id: 4, name: 'author_id', type: 'single-line-text' },
              { id: 5, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              // Read: See published articles OR own articles
              read: {
                type: 'custom',
                condition: "status = 'published' OR {userId} = author_id",
              },
              // Update: Only own articles that are NOT published
              update: {
                type: 'custom',
                condition: "{userId} = author_id AND status != 'published'",
              },
            },
          },
        ],
      })

      const user = await createAuthenticatedUser({ email: 'author@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // Insert articles
      await executeQuery(`
        INSERT INTO articles (id, title, status, author_id, organization_id) VALUES
          (1, 'My Draft', 'draft', '${user.user.id}', '${org.organization.id}'),
          (2, 'My Published', 'published', '${user.user.id}', '${org.organization.id}'),
          (3, 'Other Published', 'published', 'other-user-id', '${org.organization.id}')
      `)

      // WHEN: User reads articles - should see own and published
      const readResponse = await request.get('/api/tables/1/records')

      expect(readResponse.status()).toBe(200)
      const readData = await readResponse.json()
      expect(readData.records).toHaveLength(3) // All three visible

      // WHEN: User tries to update their draft - should succeed
      const updateDraftResponse = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: { title: 'My Updated Draft' },
      })
      expect(updateDraftResponse.status()).toBe(200)

      // WHEN: User tries to update their published article - should fail
      const updatePublishedResponse = await request.patch('/api/tables/1/records/2', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: { title: 'Trying to Change Published' },
      })
      // 403 because user can SEE the article but cannot UPDATE it (published)
      expect(updatePublishedResponse.status()).toBe(403)
    }
  )

  test(
    'API-TABLES-PERMISSIONS-CONDITIONS-006: custom condition with NULL handling',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table with custom permission handling NULL values
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'assigned_to', type: 'single-line-text' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              // Custom: See unassigned tasks OR tasks assigned to self
              read: {
                type: 'custom',
                condition: 'assigned_to IS NULL OR {userId} = assigned_to',
              },
            },
          },
        ],
      })

      const user = await createAuthenticatedUser({ email: 'user@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // Insert tasks with different assignments
      await executeQuery(`
        INSERT INTO tasks (id, title, assigned_to, organization_id) VALUES
          (1, 'Unassigned Task', NULL, '${org.organization.id}'),
          (2, 'My Task', '${user.user.id}', '${org.organization.id}'),
          (3, 'Other Task', 'other-user-id', '${org.organization.id}')
      `)

      // WHEN: User requests tasks
      const response = await request.get('/api/tables/1/records')

      // THEN: User sees unassigned tasks and their own tasks
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(2)
      const titles = data.records.map((r: any) => r.fields.title)
      expect(titles).toContain('Unassigned Task')
      expect(titles).toContain('My Task')
      expect(titles).not.toContain('Other Task')
    }
  )

  test(
    'API-TABLES-PERMISSIONS-CONDITIONS-007: custom condition with date comparison',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table with custom permission using date comparison
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'event_date', type: 'date' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              // Custom: Only future events visible
              read: { type: 'custom', condition: 'event_date >= CURRENT_DATE' },
            },
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // Insert events with different dates
      // Use toLocaleDateString('en-CA') for timezone-safe YYYY-MM-DD format
      const today = new Date().toLocaleDateString('en-CA')
      const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA')
      const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA')

      await executeQuery(`
        INSERT INTO events (id, name, event_date, organization_id) VALUES
          (1, 'Past Event', '${yesterday}', '${org.organization.id}'),
          (2, 'Today Event', '${today}', '${org.organization.id}'),
          (3, 'Future Event', '${tomorrow}', '${org.organization.id}')
      `)

      // WHEN: User requests events
      const response = await request.get('/api/tables/1/records')

      // THEN: Only today and future events are returned
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(2)
      const names = data.records.map((r: any) => r.fields.name)
      expect(names).toContain('Today Event')
      expect(names).toContain('Future Event')
      expect(names).not.toContain('Past Event')
    }
  )

  // ============================================================================
  // @regression test - Complete workflow validation
  // ============================================================================

  test.fixme(
    'API-TABLES-PERMISSIONS-CONDITIONS-008: complete custom permission workflow',
    { tag: '@regression' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      signOut,
    }) => {
      await test.step('Setup: Create schema with complex custom permissions', async () => {
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
                { id: 3, name: 'visibility', type: 'single-line-text' },
                { id: 4, name: 'status', type: 'single-line-text' },
                { id: 5, name: 'author_id', type: 'single-line-text' },
                { id: 6, name: 'organization_id', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                organizationScoped: true,
                // Complex read: public AND published, OR own docs
                read: {
                  type: 'custom',
                  condition:
                    "(visibility = 'public' AND status = 'published') OR {userId} = author_id",
                },
                // Complex create: can create if status is draft
                create: { type: 'authenticated' },
                // Complex update: only own docs that aren't published
                update: {
                  type: 'custom',
                  condition: "{userId} = author_id AND status != 'published'",
                },
                // Complex delete: only own draft docs
                delete: {
                  type: 'custom',
                  condition: "{userId} = author_id AND status = 'draft'",
                },
              },
            },
          ],
        })
      })

      await test.step('Setup: Create users in same organization', async () => {
        await createAuthenticatedUser({ email: 'user1@example.com' })
        await createOrganization({ name: 'Shared Org' })

        await signOut()

        await createAuthenticatedUser({ email: 'user2@example.com' })
      })

      await test.step('User1 creates documents', async () => {
        await signOut()
        await createAuthenticatedUser({ email: 'user1@example.com' })

        // Create a draft document
        const draftResponse = await request.post('/api/tables/1/records', {
          headers: {
            'Content-Type': 'application/json',
          },
          data: {
            title: 'User1 Draft',
            visibility: 'private',
            status: 'draft',
          },
        })
        expect(draftResponse.status()).toBe(201)

        // Create a published public document
        const publishedResponse = await request.post('/api/tables/1/records', {
          headers: {
            'Content-Type': 'application/json',
          },
          data: {
            title: 'User1 Published',
            visibility: 'public',
            status: 'published',
          },
        })
        expect(publishedResponse.status()).toBe(201)
      })

      await test.step('User2 can only see public published docs', async () => {
        await signOut()
        await createAuthenticatedUser({ email: 'user2@example.com' })

        const response = await request.get('/api/tables/1/records')

        expect(response.status()).toBe(200)
        const data = await response.json()

        // User2 only sees public+published (not User1's draft)
        expect(data.records).toHaveLength(1)
        expect(data.records[0].title).toBe('User1 Published')
      })

      await test.step('User1 can see all their own docs', async () => {
        await signOut()
        await createAuthenticatedUser({ email: 'user1@example.com' })

        const response = await request.get('/api/tables/1/records')

        expect(response.status()).toBe(200)
        const data = await response.json()

        // User1 sees both their docs
        expect(data.records).toHaveLength(2)
      })

      await test.step('User1 can update their draft but not published', async () => {
        // Get document IDs
        const docsResponse = await request.get('/api/tables/1/records')
        const docs = await docsResponse.json()
        const draftDoc = docs.records.find((r: any) => r.status === 'draft')
        const publishedDoc = docs.records.find((r: any) => r.status === 'published')

        // Update draft - should succeed
        const updateDraftResponse = await request.patch(`/api/tables/1/records/${draftDoc.id}`, {
          headers: {
            'Content-Type': 'application/json',
          },
          data: { title: 'Updated Draft Title' },
        })
        expect(updateDraftResponse.status()).toBe(200)

        // Update published - should fail
        const updatePublishedResponse = await request.patch(
          `/api/tables/1/records/${publishedDoc.id}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            data: { title: 'Trying to Update Published' },
          }
        )
        expect(updatePublishedResponse.status()).toBe(403)
      })

      await test.step('User1 can delete their draft but not published', async () => {
        // Get document IDs
        const docsResponse = await request.get('/api/tables/1/records')
        const docs = await docsResponse.json()
        const draftDoc = docs.records.find((r: any) => r.status === 'draft')
        const publishedDoc = docs.records.find((r: any) => r.status === 'published')

        // Delete published - should fail
        const deletePublishedResponse = await request.delete(
          `/api/tables/1/records/${publishedDoc.id}`
        )
        expect(deletePublishedResponse.status()).toBe(403)

        // Delete draft - should succeed
        const deleteDraftResponse = await request.delete(`/api/tables/1/records/${draftDoc.id}`)
        expect(deleteDraftResponse.status()).toBe(204)
      })

      await test.step('User2 cannot update or delete User1 docs', async () => {
        await signOut()
        await createAuthenticatedUser({ email: 'user2@example.com' })

        // Get the remaining published doc
        const docsResponse = await request.get('/api/tables/1/records')
        const docs = await docsResponse.json()
        const publishedDoc = docs.records[0]

        // User2 cannot update User1's doc
        const updateResponse = await request.patch(`/api/tables/1/records/${publishedDoc.id}`, {
          headers: {
            'Content-Type': 'application/json',
          },
          data: { title: 'Hacked Title' },
        })
        expect(updateResponse.status()).toBe(403)

        // User2 cannot delete User1's doc
        const deleteResponse = await request.delete(`/api/tables/1/records/${publishedDoc.id}`)
        expect(deleteResponse.status()).toBe(403)
      })
    }
  )
})
