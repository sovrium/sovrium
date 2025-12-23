/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Assign Custom Role to Member
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Assign Custom Role', () => {
  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-ASSIGN-001: should return 200 OK when assigning custom role',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request }) => {
      // GIVEN: An organization owner with a custom role created and a member in the organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            organization: {
              dynamicRoles: true,
            },
          },
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@test.com',
        password: 'Password123!',
        name: 'Owner',
        createOrganization: true,
      })

      // Create a custom role
      const roleResponse = await request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: owner.organizationId!,
          name: 'custom-role',
          permissions: ['read:projects', 'write:projects'],
        },
      })
      const role = await roleResponse.json()

      // Add a member to assign the role to
      const memberUser = await signUp({
        email: 'member@test.com',
        password: 'Password123!',
        name: 'Member',
      })
      const inviteResponse = await request.post('/api/auth/organization/invite-member', {
        data: {
          organizationId: owner.organizationId!,
          email: 'member@test.com',
          role: 'member',
        },
      })
      const invitation = await inviteResponse.json()

      // Accept invitation as member (switch context)
      await request.post('/api/auth/sign-in/email', {
        data: { email: 'member@test.com', password: 'Password123!' },
      })
      await request.post('/api/auth/organization/accept-invitation', {
        data: { invitationId: invitation.id },
      })

      // Get member details
      const membersResponse = await request.get('/api/auth/organization/list-members', {
        params: { organizationId: owner.organizationId! },
      })
      const members = await membersResponse.json()
      const member = members.find((m: any) => m.userId === memberUser.user.id)

      // WHEN: Owner assigns the custom role to the member
      const response = await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: owner.organizationId!,
          memberId: member.id,
          roleId: role.id,
        },
      })

      // THEN: Should return 200 OK with updated member data
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.role).toBe('custom-role')
      expect(data.roleId).toBe(role.id)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-ASSIGN-002: should replace existing role with new role',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      // GIVEN: An organization with a member having a custom role already assigned
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            organization: {
              dynamicRoles: true,
            },
          },
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // Create two custom roles
      const role1Response = await request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: owner.organizationId!,
          name: 'developer',
          permissions: ['read:code'],
        },
      })
      const role1 = await role1Response.json()

      const role2Response = await request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: owner.organizationId!,
          name: 'senior-developer',
          permissions: ['read:code', 'write:code', 'deploy:production'],
        },
      })
      const role2 = await role2Response.json()

      // Add member and assign first role
      const memberUser = await signUp({
        email: 'member@test.com',
        password: 'Password123!',
        name: 'Member',
      })
      const { member } = await addMember({
        organizationId: owner.organizationId!,
        userId: memberUser.user.id,
      })

      await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: owner.organizationId!,
          memberId: member.id,
          roleId: role1.id,
        },
      })

      // WHEN: Owner assigns a different custom role to the same member
      const response = await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: owner.organizationId!,
          memberId: member.id,
          roleId: role2.id,
        },
      })

      // THEN: Should return 200 OK with the new role replacing the old one
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.role).toBe('senior-developer')
      expect(data.roleId).toBe(role2.id)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-ASSIGN-003: should return 400 when role does not exist',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      // GIVEN: An organization owner with a member but no custom role with the given ID
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            organization: {
              dynamicRoles: true,
            },
          },
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      const memberUser = await signUp({
        email: 'member@test.com',
        password: 'Password123!',
        name: 'Member',
      })
      const { member } = await addMember({
        organizationId: owner.organizationId!,
        userId: memberUser.user.id,
      })

      // WHEN: Owner tries to assign a non-existent role ID
      const response = await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: owner.organizationId!,
          memberId: member.id,
          roleId: 'nonexistent-role-id',
        },
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('role')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-ASSIGN-004: should return 403 when non-owner tries to assign',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      // GIVEN: An organization with a member (not owner) and a custom role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            organization: {
              dynamicRoles: true,
            },
          },
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      const roleResponse = await request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: owner.organizationId!,
          name: 'custom-role',
          permissions: ['read:projects'],
        },
      })
      const role = await roleResponse.json()

      // Add two members
      const member1User = await signUp({
        email: 'member1@test.com',
        password: 'Password123!',
        name: 'Member 1',
      })
      const { member: _member1 } = await addMember({
        organizationId: owner.organizationId!,
        userId: member1User.user.id,
      })

      const member2User = await signUp({
        email: 'member2@test.com',
        password: 'Password123!',
        name: 'Member 2',
      })
      const { member: member2 } = await addMember({
        organizationId: owner.organizationId!,
        userId: member2User.user.id,
      })

      // Sign in as member1 (non-owner)
      await request.post('/api/auth/sign-in/email', {
        data: { email: 'member1@test.com', password: 'Password123!' },
      })

      // WHEN: Member1 tries to assign a role to Member2
      const response = await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: owner.organizationId!,
          memberId: member2.id,
          roleId: role.id,
        },
      })

      // THEN: Should return 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-ASSIGN-005: should return 400 when member not in organization',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request }) => {
      // GIVEN: An organization owner with a custom role, and a user NOT in the organization
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            organization: {
              dynamicRoles: true,
            },
          },
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      const roleResponse = await request.post('/api/auth/organization/create-role', {
        data: {
          organizationId: owner.organizationId!,
          name: 'custom-role',
          permissions: ['read:projects'],
        },
      })
      const role = await roleResponse.json()

      // Create another user NOT in the organization
      await signUp({
        email: 'outsider@test.com',
        password: 'Password123!',
        name: 'Outsider',
      })

      // WHEN: Owner tries to assign role to a user not in the organization
      const response = await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: owner.organizationId!,
          memberId: 'fake-member-id',
          roleId: role.id,
        },
      })

      // THEN: Should return 400 Bad Request
      expect(response.status()).toBe(400)
      const error = await response.json()
      expect(error.message).toContain('member')
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-ASSIGN-006: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ startServerWithSchema, request }) => {
      // GIVEN: A server without authentication
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            organization: {
              dynamicRoles: true,
            },
          },
        },
      })

      // WHEN: Unauthenticated request to assign role
      const response = await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: 'some-org-id',
          memberId: 'some-member-id',
          roleId: 'some-role-id',
        },
      })

      // THEN: Should return 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test.fixme(
    'API-AUTH-ORG-DYNAMIC-ROLE-ASSIGN-007: owner can assign roles and verify permissions apply',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedUser, signUp, request, addMember }) => {
      // GIVEN: An organization with custom roles and members
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          plugins: {
            organization: {
              dynamicRoles: true,
            },
          },
        },
      })
      const owner = await createAuthenticatedUser({
        email: 'owner@test.com',
        password: 'Password123!',
        createOrganization: true,
      })

      // Create multiple custom roles with different permissions
      const developerRole = await request
        .post('/api/auth/organization/create-role', {
          data: {
            organizationId: owner.organizationId!,
            name: 'developer',
            permissions: ['read:code', 'write:code'],
          },
        })
        .then((r) => r.json())

      const qaRole = await request
        .post('/api/auth/organization/create-role', {
          data: {
            organizationId: owner.organizationId!,
            name: 'qa',
            permissions: ['read:code', 'test:code'],
          },
        })
        .then((r) => r.json())

      // Add members
      const dev1 = await signUp({ email: 'dev1@test.com', password: 'Password123!', name: 'Dev 1' })
      const { member: member1 } = await addMember({
        organizationId: owner.organizationId!,
        userId: dev1.user.id,
      })

      const qa1 = await signUp({ email: 'qa1@test.com', password: 'Password123!', name: 'QA 1' })
      const { member: member2 } = await addMember({
        organizationId: owner.organizationId!,
        userId: qa1.user.id,
      })

      // WHEN: Owner assigns different roles to members
      const assignDev = await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: owner.organizationId!,
          memberId: member1.id,
          roleId: developerRole.id,
        },
      })

      const assignQA = await request.post('/api/auth/organization/assign-role', {
        data: {
          organizationId: owner.organizationId!,
          memberId: member2.id,
          roleId: qaRole.id,
        },
      })

      // THEN: Both assignments succeed and permissions are applied
      expect(assignDev.status()).toBe(200)
      expect(assignQA.status()).toBe(200)

      // Verify roles were assigned correctly
      const member1Data = await assignDev.json()
      expect(member1Data.role).toBe('developer')

      const member2Data = await assignQA.json()
      expect(member2Data.role).toBe('qa')

      // Verify permissions can be checked
      const checkDevPermission = await request.post('/api/auth/organization/check-permission', {
        data: {
          organizationId: owner.organizationId!,
          memberId: member1.id,
          permission: 'write:code',
        },
      })
      expect(checkDevPermission.status()).toBe(200)
      const devPermData = await checkDevPermission.json()
      expect(devPermData.hasPermission).toBe(true)

      const checkQAPermission = await request.post('/api/auth/organization/check-permission', {
        data: {
          organizationId: owner.organizationId!,
          memberId: member2.id,
          permission: 'test:code',
        },
      })
      expect(checkQAPermission.status()).toBe(200)
      const qaPermData = await checkQAPermission.json()
      expect(qaPermData.hasPermission).toBe(true)
    }
  )
})
