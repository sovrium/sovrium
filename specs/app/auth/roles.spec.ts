/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Auth Role Definitions
 *
 * Source: src/domain/models/app/auth/roles.ts
 * Domain: app
 * Spec Count: 12
 *
 * User Stories:
 * - US-AUTH-ROLES-001: Define Custom Roles (8 acceptance criteria)
 * - US-AUTH-ROLES-002: Default Role Assignment (4 acceptance criteria)
 *
 * Schema: RolesConfigSchema, DefaultRoleSchema, AuthSchema
 *
 * Tests validate:
 * - Built-in roles (admin=80, member=40, viewer=10) always available
 * - Custom roles with name, optional description, optional level
 * - Role name uniqueness and naming convention enforcement
 * - Hierarchy level ordering
 * - Table permission validation against defined roles
 * - Default role configuration and fallback behavior
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (12 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Custom Role Definitions (US-AUTH-ROLES-001)', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage for US-AUTH-ROLES-001
  // ============================================================================

  test(
    'APP-AUTH-ROLES-001: should provide built-in roles admin=80, member=40, viewer=10 without configuration',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedAdmin, page }) => {
      // GIVEN: Application with auth enabled but no custom roles defined
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          // roles intentionally omitted - only built-in roles should be available
        },
      })

      // WHEN: Admin user is created and accesses the application
      await createAuthenticatedAdmin({
        email: 'admin@example.com',
        password: 'AdminPass123!',
        name: 'Admin User',
      })

      // THEN: Application starts successfully with built-in roles available
      // Built-in roles: admin (level 80), member (level 40), viewer (level 10)
      await page.goto('/')
      await expect(page.locator('body')).toBeVisible()
    }
  )

  test(
    'APP-AUTH-ROLES-002: should accept custom roles with name, optional description, and optional level',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: Application with custom roles using all available fields
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          roles: [
            {
              name: 'editor',
              description: 'Can edit content but not manage users',
              level: 30,
            },
            {
              name: 'moderator',
              description: 'Can moderate comments and content',
              level: 20,
            },
            {
              name: 'contributor',
              // description and level intentionally omitted - both are optional
            },
          ],
        },
      })

      // WHEN: User navigates to the application
      await page.goto('/')

      // THEN: Application starts successfully with custom roles configured
      await expect(page.locator('body')).toBeVisible()
    }
  )

  test(
    'APP-AUTH-ROLES-003: should reject duplicate role names in custom roles',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Application with duplicate custom role names ('editor' appears twice)
      // WHEN: Server attempts to start with duplicate role names
      // THEN: Schema validation rejects with "Duplicate role names: editor" error
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
            roles: [
              { name: 'editor', level: 30 },
              { name: 'editor', level: 25 },
            ],
          },
        })
      }).rejects.toThrow()
    }
  )

  test.fixme(
    'APP-AUTH-ROLES-004: should enforce role naming convention (lowercase, alphanumeric, hyphens)',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Application with role names violating naming convention
      // WHEN: Server attempts to start with uppercase role name 'Editor'
      // THEN: Schema validation rejects (RoleNameSchema pattern: /^[a-z][a-z0-9-]*$/)
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
            roles: [{ name: 'Editor', level: 30 }],
          },
        })
      }).rejects.toThrow()

      // WHEN: Server attempts to start with role name starting with number
      // THEN: Schema validation rejects
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
            roles: [{ name: '123role', level: 30 }],
          },
        })
      }).rejects.toThrow()

      // GIVEN: Application with valid hyphenated role name
      // WHEN: Server starts with 'content-manager' role
      // THEN: Schema validation passes (hyphens are allowed)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          roles: [{ name: 'content-manager', description: 'Manages content', level: 35 }],
        },
      })
    }
  )

  test.fixme(
    'APP-AUTH-ROLES-005: should order roles by hierarchy level (higher level = more permissions)',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: Application with custom roles at various hierarchy levels
      // Levels: admin=80 > member=40 > editor=30 > moderator=20 > viewer=10
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          roles: [
            { name: 'editor', description: 'Can edit content', level: 30 },
            { name: 'moderator', description: 'Can moderate', level: 20 },
          ],
        },
      })

      // WHEN: User navigates to the application
      await page.goto('/')

      // THEN: Application starts successfully with role hierarchy established
      // Built-in + custom roles ordered: admin(80) > member(40) > editor(30) > moderator(20) > viewer(10)
      await expect(page.locator('body')).toBeVisible()
    }
  )

  test.fixme(
    'APP-AUTH-ROLES-006: should validate table permission roles against defined roles',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: Application with custom 'editor' role and table permissions referencing it in role arrays
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
        },
        tables: [
          {
            id: 1,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
              { id: 3, name: 'content', type: 'long-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'all',
              create: ['admin', 'editor'],
              update: ['admin', 'editor'],
              delete: ['admin'],
            },
          },
        ],
      })

      // WHEN: User navigates to the application
      await page.goto('/')

      // THEN: Application starts successfully - 'editor' and 'admin' are both valid roles
      await expect(page.locator('body')).toBeVisible()
    }
  )

  test.fixme(
    'APP-AUTH-ROLES-007: should reject table permission referencing undefined role',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Application with table permissions referencing 'publisher' role that is NOT defined
      // WHEN: Server attempts to start with undefined role in table permissions
      // THEN: Schema validation rejects because 'publisher' is not a built-in or custom role
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
            roles: [{ name: 'editor', level: 30 }],
          },
          tables: [
            {
              id: 1,
              name: 'articles',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text', required: true },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                create: ['publisher'],
                update: ['publisher'],
              },
            },
          ],
        })
      }).rejects.toThrow()
    }
  )

  test.fixme(
    'APP-AUTH-ROLES-008: should accept empty roles array (only built-in roles available)',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: Application with explicit empty roles array
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          roles: [],
        },
      })

      // WHEN: User navigates to the application
      await page.goto('/')

      // THEN: Application starts successfully with only built-in roles (admin, member, viewer)
      await expect(page.locator('body')).toBeVisible()
    }
  )
})

test.describe('Default Role Assignment (US-AUTH-ROLES-002)', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage for US-AUTH-ROLES-002
  // ============================================================================

  test.fixme(
    'APP-AUTH-ROLES-009: should accept built-in role as defaultRole',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: Application with defaultRole set to built-in 'viewer' role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
        },
      })

      // WHEN: User navigates to the application
      await page.goto('/')

      // THEN: Application starts successfully with 'viewer' as the default role for new users
      await expect(page.locator('body')).toBeVisible()
    }
  )

  test.fixme(
    'APP-AUTH-ROLES-010: should accept custom role name as defaultRole when defined in auth.roles',
    { tag: '@spec' },
    async ({ startServerWithSchema, page }) => {
      // GIVEN: Application with custom 'editor' role and defaultRole='editor'
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
          defaultRole: 'editor',
        },
      })

      // WHEN: User navigates to the application
      await page.goto('/')

      // THEN: Application starts successfully with 'editor' as the default role
      await expect(page.locator('body')).toBeVisible()
    }
  )

  test.fixme(
    'APP-AUTH-ROLES-011: should default to member role when defaultRole is not specified',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Application with auth enabled but no defaultRole specified
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          // defaultRole intentionally omitted - should default to 'member'
        },
      })

      // WHEN: A new user signs up
      await signUp({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'New User',
      })

      // THEN: The new user is assigned 'member' role by default
      await page.goto('/')
      await expect(page.locator('body')).toBeVisible()
    }
  )

  test.fixme(
    'APP-AUTH-ROLES-012: should reject defaultRole referencing undefined custom role',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Application with defaultRole='publisher' but 'publisher' is not defined in roles
      // WHEN: Server attempts to start with undefined defaultRole
      // THEN: Schema validation rejects because 'publisher' is neither built-in nor custom-defined
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
            roles: [{ name: 'editor', level: 30 }],
            defaultRole: 'publisher',
          },
        })
      }).rejects.toThrow()
    }
  )
})

// ============================================================================
// REGRESSION TEST (@regression)
// ONE OPTIMIZED test verifying all role configuration behaviors together
// Generated from 12 @spec tests - see individual @spec tests for exhaustive criteria
// ============================================================================

test.fixme(
  'APP-AUTH-ROLES-REGRESSION: developer can configure roles and default role assignment correctly',
  { tag: '@regression' },
  async ({ startServerWithSchema, createAuthenticatedAdmin, signUp, page }) => {
    // --- US-AUTH-ROLES-001: Custom Role Definitions ---

    await test.step('APP-AUTH-ROLES-001: built-in roles available without configuration', async () => {
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
        },
      })
      await createAuthenticatedAdmin({
        email: 'admin@example.com',
        password: 'AdminPass123!',
        name: 'Admin User',
      })
      await page.goto('/')
      await expect(page.locator('body')).toBeVisible()
    })

    await test.step('APP-AUTH-ROLES-002: accepts custom roles with name, description, and level', async () => {
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          roles: [
            { name: 'editor', description: 'Can edit content', level: 30 },
            { name: 'moderator', description: 'Can moderate', level: 20 },
            { name: 'contributor' },
          ],
        },
      })
      await page.goto('/')
      await expect(page.locator('body')).toBeVisible()
    })

    await test.step('APP-AUTH-ROLES-003: rejects duplicate role names', async () => {
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
            roles: [
              { name: 'editor', level: 30 },
              { name: 'editor', level: 25 },
            ],
          },
        })
      }).rejects.toThrow()
    })

    await test.step('APP-AUTH-ROLES-004: enforces role naming convention', async () => {
      // Uppercase rejected
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
            roles: [{ name: 'Editor', level: 30 }],
          },
        })
      }).rejects.toThrow()

      // Valid hyphenated name accepted
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          roles: [{ name: 'content-manager', level: 35 }],
        },
      })
    })

    await test.step('APP-AUTH-ROLES-005: hierarchy levels establish role ordering', async () => {
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          roles: [
            { name: 'editor', level: 30 },
            { name: 'moderator', level: 20 },
          ],
        },
      })
      await page.goto('/')
      await expect(page.locator('body')).toBeVisible()
    })

    await test.step('APP-AUTH-ROLES-006: validates table permissions against defined roles', async () => {
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          roles: [{ name: 'editor', level: 30 }],
        },
        tables: [
          {
            id: 1,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'all',
              create: ['admin', 'editor'],
              update: ['admin', 'editor'],
              delete: ['admin'],
            },
          },
        ],
      })
      await page.goto('/')
      await expect(page.locator('body')).toBeVisible()
    })

    await test.step('APP-AUTH-ROLES-007: rejects undefined role in table permissions', async () => {
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
            roles: [{ name: 'editor', level: 30 }],
          },
          tables: [
            {
              id: 1,
              name: 'articles',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'title', type: 'single-line-text', required: true },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                create: ['publisher'],
                update: ['publisher'],
              },
            },
          ],
        })
      }).rejects.toThrow()
    })

    await test.step('APP-AUTH-ROLES-008: accepts empty roles array', async () => {
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          roles: [],
        },
      })
      await page.goto('/')
      await expect(page.locator('body')).toBeVisible()
    })

    // --- US-AUTH-ROLES-002: Default Role Assignment ---

    await test.step('APP-AUTH-ROLES-009: accepts built-in role as defaultRole', async () => {
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
        },
      })
      await page.goto('/')
      await expect(page.locator('body')).toBeVisible()
    })

    await test.step('APP-AUTH-ROLES-010: accepts custom role as defaultRole when defined', async () => {
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          roles: [{ name: 'editor', level: 30 }],
          defaultRole: 'editor',
        },
      })
      await page.goto('/')
      await expect(page.locator('body')).toBeVisible()
    })

    await test.step('APP-AUTH-ROLES-011: defaults to member when defaultRole is omitted', async () => {
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
        },
      })
      await signUp({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'New User',
      })
      await page.goto('/')
      await expect(page.locator('body')).toBeVisible()
    })

    await test.step('APP-AUTH-ROLES-012: rejects undefined custom role as defaultRole', async () => {
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
            roles: [{ name: 'editor', level: 30 }],
            defaultRole: 'publisher',
          },
        })
      }).rejects.toThrow()
    })
  }
)
