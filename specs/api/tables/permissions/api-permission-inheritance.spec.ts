/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Permission Inheritance and Role Hierarchy
 *
 * PURPOSE: Verify that role-based permissions work correctly across the role hierarchy
 *
 * ROLE HIERARCHY (default):
 * - owner: Organization owner, highest privileges
 * - admin: Administrative access, can manage most resources
 * - member: Standard user, can read/create but limited modify
 * - viewer: Read-only access
 *
 * KEY CONCEPTS:
 * - Explicit role listing: Permissions must explicitly list each allowed role
 * - No automatic inheritance: Admin doesn't automatically get member permissions
 * - Cascading permissions: Schema must include all roles that should have access
 *
 * TESTING STRATEGY:
 * - Test that higher roles can access resources when explicitly included
 * - Test that roles NOT listed are denied access
 * - Test combined role + operation permissions
 *
 * Domain: api
 * Spec Count: 7
 */

test.describe('API Permission Inheritance and Role Hierarchy', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of role hierarchy behavior
  // ============================================================================

  test.fixme(
    'API-PERMISSION-INHERITANCE-001: owner role has access when explicitly listed',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table with owner-only read permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
        tables: [
          {
            id: 1,
            name: 'owner_secrets',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'secret', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'roles', roles: ['owner'] }, // Only owner
              create: { type: 'roles', roles: ['owner'] },
            },
          },
        ],
      })

      // Organization owner (created with owner role automatically)
      await createAuthenticatedUser({ email: 'owner@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      await executeQuery(`
        INSERT INTO owner_secrets (id, secret, organization_id) VALUES
          (1, 'Top secret data', '${org.organization.id}')
      `)

      // WHEN: Owner requests the secrets
      const response = await request.get('/api/tables/1/records', {
        headers: { 'X-Organization-Id': org.organization.id },
      })

      // THEN: Owner can access
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records).toHaveLength(1)
      expect(data.records[0].secret).toBe('Top secret data')
    }
  )

  test.fixme(
    'API-PERMISSION-INHERITANCE-002: admin cannot access owner-only resources',
    { tag: '@spec' },
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
      // GIVEN: Table with owner-only read permission
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
        tables: [
          {
            id: 1,
            name: 'owner_secrets',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'secret', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'roles', roles: ['owner'] }, // Only owner, NOT admin
            },
          },
        ],
      })

      // Create owner and org
      await createAuthenticatedUser({ email: 'owner@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      await executeQuery(`
        INSERT INTO owner_secrets (id, secret, organization_id) VALUES
          (1, 'Owner secret', '${org.organization.id}')
      `)

      // Create admin user in the same org
      await signOut()
      const admin = await createAuthenticatedAdmin({ email: 'admin@example.com' })
      await addMember({
        organizationId: org.organization.id,
        userId: admin.user.id,
        role: 'admin',
      })

      // WHEN: Admin tries to access owner-only resources
      const response = await request.get('/api/tables/1/records', {
        headers: { 'X-Organization-Id': org.organization.id },
      })

      // THEN: Admin gets empty results (no access)
      // Note: RLS filters results rather than returning 403
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records).toHaveLength(0) // No records visible to admin
    }
  )

  test.fixme(
    'API-PERMISSION-INHERITANCE-003: cascading permission includes multiple roles explicitly',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      addMember,
      executeQuery,
      signOut,
    }) => {
      // GIVEN: Table with cascading permissions (owner, admin, member all included)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
        tables: [
          {
            id: 1,
            name: 'team_resources',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              // Explicit cascading: owner, admin, AND member can all read
              read: { type: 'roles', roles: ['owner', 'admin', 'member'] },
              // Only owner and admin can create
              create: { type: 'roles', roles: ['owner', 'admin'] },
              // Only owner can delete
              delete: { type: 'roles', roles: ['owner'] },
            },
          },
        ],
      })

      // Create owner
      await createAuthenticatedUser({ email: 'owner@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      await executeQuery(`
        INSERT INTO team_resources (id, name, organization_id) VALUES
          (1, 'Shared Resource', '${org.organization.id}')
      `)

      // Create member
      await signOut()
      const member = await createAuthenticatedUser({ email: 'member@example.com' })
      await addMember({
        organizationId: org.organization.id,
        userId: member.user.id,
        role: 'member',
      })

      // WHEN: Member reads resources
      const readResponse = await request.get('/api/tables/1/records', {
        headers: { 'X-Organization-Id': org.organization.id },
      })

      // THEN: Member can read (included in roles array)
      expect(readResponse.status()).toBe(200)
      const readData = await readResponse.json()
      expect(readData.records).toHaveLength(1)

      // WHEN: Member tries to create
      const createResponse = await request.post('/api/tables/1/records', {
        headers: {
          'X-Organization-Id': org.organization.id,
          'Content-Type': 'application/json',
        },
        data: { name: 'Member Resource' },
      })

      // THEN: Member cannot create (not in create roles)
      expect(createResponse.status()).toBe(403)

      // WHEN: Member tries to delete
      const deleteResponse = await request.delete('/api/tables/1/records/1', {
        headers: { 'X-Organization-Id': org.organization.id },
      })

      // THEN: Member cannot delete (not in delete roles)
      expect(deleteResponse.status()).toBe(403)
    }
  )

  test.fixme(
    'API-PERMISSION-INHERITANCE-004: member role gets read-only access when excluded from create/update',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      addMember,
      executeQuery,
      signOut,
    }) => {
      // GIVEN: Table with member included in read but NOT in create/update/delete
      // This tests read-only permission patterns
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
        tables: [
          {
            id: 1,
            name: 'public_data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              // Member can read but NOT create/update/delete
              read: { type: 'roles', roles: ['owner', 'admin', 'member'] },
              create: { type: 'roles', roles: ['owner', 'admin'] }, // No member
              update: { type: 'roles', roles: ['owner', 'admin'] }, // No member
              delete: { type: 'roles', roles: ['owner', 'admin'] },
            },
          },
        ],
      })

      // Create owner
      await createAuthenticatedUser({ email: 'owner@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      await executeQuery(`
        INSERT INTO public_data (id, content, organization_id) VALUES
          (1, 'Viewable Content', '${org.organization.id}')
      `)

      // Create read-only member
      await signOut()
      const readOnlyMember = await createAuthenticatedUser({ email: 'readonly@example.com' })
      await addMember({
        organizationId: org.organization.id,
        userId: readOnlyMember.user.id,
        role: 'member',
      })

      // WHEN: Read-only member reads
      const readResponse = await request.get('/api/tables/1/records', {
        headers: { 'X-Organization-Id': org.organization.id },
      })

      // THEN: Member can read
      expect(readResponse.status()).toBe(200)
      const readData = await readResponse.json()
      expect(readData.records).toHaveLength(1)

      // WHEN: Read-only member tries to create
      const createResponse = await request.post('/api/tables/1/records', {
        headers: {
          'X-Organization-Id': org.organization.id,
          'Content-Type': 'application/json',
        },
        data: { content: 'Member Content' },
      })

      // THEN: Member cannot create (not in create roles)
      expect(createResponse.status()).toBe(403)

      // WHEN: Read-only member tries to update
      const updateResponse = await request.patch('/api/tables/1/records/1', {
        headers: {
          'X-Organization-Id': org.organization.id,
          'Content-Type': 'application/json',
        },
        data: { content: 'Hacked Content' },
      })

      // THEN: Member cannot update (not in update roles)
      expect(updateResponse.status()).toBe(403)
    }
  )

  test.fixme(
    'API-PERMISSION-INHERITANCE-005: role escalation attempt fails',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      addMember,
      executeQuery,
      signOut,
    }) => {
      // GIVEN: Table where different roles have different field access
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'role_field', type: 'single-line-text' }, // Stores user's role claim
              { id: 4, name: 'salary', type: 'currency', currency: 'USD' },
              { id: 5, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              read: { type: 'authenticated' },
              update: { type: 'roles', roles: ['owner', 'admin'] },
              fields: [
                {
                  field: 'salary',
                  read: { type: 'roles', roles: ['owner', 'admin'] },
                  write: { type: 'roles', roles: ['owner'] },
                },
                {
                  field: 'role_field',
                  // Role field is read-only for everyone (system-managed)
                  read: { type: 'authenticated' },
                  write: { type: 'roles', roles: ['owner'] }, // Only owner can change roles
                },
              ],
            },
          },
        ],
      })

      // Create owner
      await createAuthenticatedUser({ email: 'owner@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      // Create member
      await signOut()
      const member = await createAuthenticatedUser({ email: 'member@example.com' })
      await addMember({
        organizationId: org.organization.id,
        userId: member.user.id,
        role: 'member',
      })

      // Create employee record
      await executeQuery(`
        INSERT INTO employees (id, name, role_field, salary, organization_id) VALUES
          (1, 'Test Employee', 'member', 50000, '${org.organization.id}')
      `)

      // WHEN: Member tries to escalate their role
      const escalateResponse = await request.patch('/api/tables/1/records/1', {
        headers: {
          'X-Organization-Id': org.organization.id,
          'Content-Type': 'application/json',
        },
        data: { role_field: 'admin' }, // Attempting role escalation
      })

      // THEN: Role escalation is denied (member can't write role_field)
      expect(escalateResponse.status()).toBe(403)

      // Verify role was not changed
      const verifyResult = await executeQuery(
        'SELECT role_field FROM employees WHERE id = 1'
      )
      expect(verifyResult.rows[0].role_field).toBe('member')
    }
  )

  test.fixme(
    'API-PERMISSION-INHERITANCE-006: empty roles array denies all access',
    { tag: '@spec' },
    async ({
      request,
      startServerWithSchema,
      createAuthenticatedUser,
      createOrganization,
      executeQuery,
    }) => {
      // GIVEN: Table with empty roles array (effectively deny all)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: { organization: true },
        },
        tables: [
          {
            id: 1,
            name: 'system_logs',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'message', type: 'single-line-text' },
              { id: 3, name: 'organization_id', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              organizationScoped: true,
              // No one can delete (empty roles = deny all)
              read: { type: 'authenticated' },
              delete: { type: 'roles', roles: [] },
            },
          },
        ],
      })

      await createAuthenticatedUser({ email: 'owner@example.com' })
      const org = await createOrganization({ name: 'Test Org' })

      await executeQuery(`
        INSERT INTO system_logs (id, message, organization_id) VALUES
          (1, 'Important log', '${org.organization.id}')
      `)

      // WHEN: Owner tries to delete (even owner is denied)
      const deleteResponse = await request.delete('/api/tables/1/records/1', {
        headers: { 'X-Organization-Id': org.organization.id },
      })

      // THEN: Delete is denied
      expect(deleteResponse.status()).toBe(403)

      // Verify record still exists
      const verifyResult = await executeQuery(
        'SELECT COUNT(*) as count FROM system_logs WHERE id = 1'
      )
      expect(verifyResult.rows[0].count).toBe(1)
    }
  )

  // ============================================================================
  // @regression test - Complete workflow validation
  // ============================================================================

  test.fixme(
    'API-PERMISSION-INHERITANCE-007: complete role hierarchy workflow',
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
      let admin: { user: { id: string } }
      let member: { user: { id: string } }

      await test.step('Setup: Create schema with tiered permissions', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            plugins: { organization: true },
          },
          tables: [
            {
              id: 1,
              name: 'tiered_resources',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'tier', type: 'single-line-text' },
                { id: 4, name: 'organization_id', type: 'single-line-text' },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                organizationScoped: true,
                // Tiered permissions: all can read, fewer can create, even fewer can update/delete
                read: { type: 'roles', roles: ['owner', 'admin', 'member'] },
                create: { type: 'roles', roles: ['owner', 'admin', 'member'] },
                update: { type: 'roles', roles: ['owner', 'admin'] },
                delete: { type: 'roles', roles: ['owner'] },
              },
            },
          ],
        })
      })

      await test.step('Setup: Create all role types in organization', async () => {
        // Owner (creates org)
        await createAuthenticatedUser({ email: 'owner@example.com' })
        org = await createOrganization({ name: 'Tiered Org' })

        // Admin
        await signOut()
        admin = await createAuthenticatedAdmin({ email: 'admin@example.com' })
        await addMember({
          organizationId: org.organization.id,
          userId: admin.user.id,
          role: 'admin',
        })

        // Member
        await signOut()
        member = await createAuthenticatedUser({ email: 'member@example.com' })
        await addMember({
          organizationId: org.organization.id,
          userId: member.user.id,
          role: 'member',
        })
      })

      await test.step('Setup: Create initial resource', async () => {
        await executeQuery(`
          INSERT INTO tiered_resources (id, name, tier, organization_id) VALUES
            (1, 'Initial Resource', 'admin', '${org.organization.id}')
        `)
      })

      await test.step('Verify all roles can READ', async () => {
        for (const email of [
          'owner@example.com',
          'admin@example.com',
          'member@example.com',
        ]) {
          await signOut()
          await createAuthenticatedUser({ email })

          const response = await request.get('/api/tables/1/records', {
            headers: { 'X-Organization-Id': org.organization.id },
          })

          expect(response.status()).toBe(200)
          const data = await response.json()
          expect(data.records.length).toBeGreaterThanOrEqual(1)
        }
      })

      await test.step('Verify CREATE permissions (owner, admin, member)', async () => {
        // Member can create
        await signOut()
        await createAuthenticatedUser({ email: 'member@example.com' })

        const memberCreateResponse = await request.post('/api/tables/1/records', {
          headers: {
            'X-Organization-Id': org.organization.id,
            'Content-Type': 'application/json',
          },
          data: { name: 'Member Created', tier: 'member' },
        })
        expect(memberCreateResponse.status()).toBe(201)

        // Non-member (user not in org) cannot create
        await signOut()
        await createAuthenticatedUser({ email: 'outsider@example.com' })
        // Note: Not added to org - they're not a member

        const outsiderCreateResponse = await request.post('/api/tables/1/records', {
          headers: {
            'X-Organization-Id': org.organization.id,
            'Content-Type': 'application/json',
          },
          data: { name: 'Outsider Created', tier: 'outsider' },
        })
        // Non-member should be forbidden
        expect([401, 403]).toContain(outsiderCreateResponse.status())
      })

      await test.step('Verify UPDATE permissions (owner, admin only)', async () => {
        // Admin can update
        await signOut()
        await createAuthenticatedAdmin({ email: 'admin@example.com' })

        const adminUpdateResponse = await request.patch('/api/tables/1/records/1', {
          headers: {
            'X-Organization-Id': org.organization.id,
            'Content-Type': 'application/json',
          },
          data: { name: 'Admin Updated' },
        })
        expect(adminUpdateResponse.status()).toBe(200)

        // Member cannot update
        await signOut()
        await createAuthenticatedUser({ email: 'member@example.com' })

        const memberUpdateResponse = await request.patch('/api/tables/1/records/1', {
          headers: {
            'X-Organization-Id': org.organization.id,
            'Content-Type': 'application/json',
          },
          data: { name: 'Member Hacked' },
        })
        expect(memberUpdateResponse.status()).toBe(403)
      })

      await test.step('Verify DELETE permissions (owner only)', async () => {
        // Get the member-created resource ID
        const resourcesResponse = await request.get('/api/tables/1/records', {
          headers: { 'X-Organization-Id': org.organization.id },
        })
        const resources = await resourcesResponse.json()
        const memberResource = resources.records.find(
          (r: any) => r.name === 'Member Created'
        )

        // Admin cannot delete
        await signOut()
        await createAuthenticatedAdmin({ email: 'admin@example.com' })

        const adminDeleteResponse = await request.delete(
          `/api/tables/1/records/${memberResource.id}`,
          {
            headers: { 'X-Organization-Id': org.organization.id },
          }
        )
        expect(adminDeleteResponse.status()).toBe(403)

        // Owner can delete
        await signOut()
        await createAuthenticatedUser({ email: 'owner@example.com' })

        const ownerDeleteResponse = await request.delete(
          `/api/tables/1/records/${memberResource.id}`,
          {
            headers: { 'X-Organization-Id': org.organization.id },
          }
        )
        expect(ownerDeleteResponse.status()).toBe(204)
      })
    }
  )
})
