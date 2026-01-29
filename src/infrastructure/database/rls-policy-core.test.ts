/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import {
  generateEnableRLS,
  generatePolicyStatements,
  generateOwnerCheck,
  generateAuthenticatedCheck,
  generateRoleCheck,
  generateCustomCheck,
  generateDropPolicies,
  generateAuthenticatedPolicyStatements,
  generateRolePolicyStatements,
  generateOwnerPolicyStatements,
  generateOperationCheck,
  generatePolicyName,
} from './rls-policy-core'
import type { TablePermission } from '@/domain/models/app/table/permissions'

describe('rls-policy-core', () => {
  describe('generateEnableRLS', () => {
    test('generates both ENABLE and FORCE RLS statements', () => {
      const statements = generateEnableRLS('users')

      expect(statements).toHaveLength(2)
      expect(statements[0]).toBe('ALTER TABLE users ENABLE ROW LEVEL SECURITY')
      expect(statements[1]).toBe('ALTER TABLE users FORCE ROW LEVEL SECURITY')
    })

    test('includes table name in statements', () => {
      const statements = generateEnableRLS('posts')

      expect(statements[0]).toContain('posts')
      expect(statements[1]).toContain('posts')
    })
  })

  describe('generatePolicyStatements', () => {
    test('generates UPDATE policy with both USING and WITH CHECK clauses', () => {
      const statements = generatePolicyStatements(
        'users',
        'users_owner_update',
        'UPDATE',
        "owner_id = current_setting('app.user_id', true)::TEXT"
      )

      expect(statements).toHaveLength(2)
      expect(statements[0]).toBe('DROP POLICY IF EXISTS users_owner_update ON users')
      expect(statements[1]).toContain('CREATE POLICY users_owner_update ON users FOR UPDATE')
      expect(statements[1]).toContain('USING (')
      expect(statements[1]).toContain('WITH CHECK (')
    })

    test('generates INSERT policy with WITH CHECK clause only', () => {
      const statements = generatePolicyStatements(
        'posts',
        'posts_insert',
        'INSERT',
        "current_setting('app.user_id', true) IS NOT NULL"
      )

      expect(statements).toHaveLength(2)
      expect(statements[0]).toBe('DROP POLICY IF EXISTS posts_insert ON posts')
      expect(statements[1]).toContain('FOR INSERT WITH CHECK (')
      expect(statements[1]).not.toContain('USING')
    })

    test('generates SELECT policy with USING clause only', () => {
      const statements = generatePolicyStatements(
        'documents',
        'documents_select',
        'SELECT',
        "owner_id = current_setting('app.user_id', true)::TEXT"
      )

      expect(statements).toHaveLength(2)
      expect(statements[1]).toContain('FOR SELECT USING (')
      expect(statements[1]).not.toContain('WITH CHECK')
    })

    test('generates DELETE policy with USING clause only', () => {
      const statements = generatePolicyStatements(
        'comments',
        'comments_delete',
        'DELETE',
        "owner_id = current_setting('app.user_id', true)::TEXT"
      )

      expect(statements).toHaveLength(2)
      expect(statements[1]).toContain('FOR DELETE USING (')
      expect(statements[1]).not.toContain('WITH CHECK')
    })

    test('returns empty array when check expression is undefined', () => {
      const statements = generatePolicyStatements('users', 'users_select', 'SELECT', undefined)

      expect(statements).toEqual([])
    })

    test('returns empty array when check expression is empty string', () => {
      const statements = generatePolicyStatements('users', 'users_select', 'SELECT', '')

      expect(statements).toEqual([])
    })
  })

  describe('generateOwnerCheck', () => {
    test('generates owner check expression for owner permission', () => {
      const permission: TablePermission = {
        type: 'owner',
        field: 'owner_id',
      }

      const check = generateOwnerCheck(permission)

      expect(check).toBe("owner_id = current_setting('app.user_id', true)::TEXT")
    })

    test('returns undefined for non-owner permission type', () => {
      const permission: TablePermission = {
        type: 'authenticated',
      }

      const check = generateOwnerCheck(permission)

      expect(check).toBeUndefined()
    })

    test('returns undefined when permission is undefined', () => {
      const check = generateOwnerCheck(undefined)

      expect(check).toBeUndefined()
    })
  })

  describe('generateAuthenticatedCheck', () => {
    test('generates authenticated check expression for authenticated permission', () => {
      const permission: TablePermission = {
        type: 'authenticated',
      }

      const check = generateAuthenticatedCheck(permission)

      expect(check).toBe(
        "current_setting('app.user_id', true) IS NOT NULL AND current_setting('app.user_id', true) != ''"
      )
    })

    test('returns undefined for non-authenticated permission type', () => {
      const permission: TablePermission = {
        type: 'owner',
        field: 'owner_id',
      }

      const check = generateAuthenticatedCheck(permission)

      expect(check).toBeUndefined()
    })

    test('returns undefined when permission is undefined', () => {
      const check = generateAuthenticatedCheck(undefined)

      expect(check).toBeUndefined()
    })
  })

  describe('generateRoleCheck', () => {
    test('generates role check expression for single role', () => {
      const permission: TablePermission = {
        type: 'roles',
        roles: ['admin'],
      }

      const check = generateRoleCheck(permission)

      expect(check).toBe("(current_setting('app.user_role', true) = 'admin')")
    })

    test('generates OR-joined role checks for multiple roles', () => {
      const permission: TablePermission = {
        type: 'roles',
        roles: ['admin', 'member', 'viewer'],
      }

      const check = generateRoleCheck(permission)

      expect(check).toContain("current_setting('app.user_role', true) = 'admin'")
      expect(check).toContain("current_setting('app.user_role', true) = 'member'")
      expect(check).toContain("current_setting('app.user_role', true) = 'viewer'")
      expect(check).toContain(' OR ')
    })

    test('returns false for empty roles array (deny all access)', () => {
      const permission: TablePermission = {
        type: 'roles',
        roles: [],
      }

      const check = generateRoleCheck(permission)

      expect(check).toBe('false')
    })

    test('returns undefined for non-roles permission type', () => {
      const permission: TablePermission = {
        type: 'authenticated',
      }

      const check = generateRoleCheck(permission)

      expect(check).toBeUndefined()
    })

    test('returns undefined when permission is undefined', () => {
      const check = generateRoleCheck(undefined)

      expect(check).toBeUndefined()
    })
  })

  describe('generateCustomCheck', () => {
    test('generates custom check expression using translator', () => {
      const permission: TablePermission = {
        type: 'custom',
        condition: "{userId} = owner_id AND status = 'published'",
      }

      const check = generateCustomCheck(permission)

      expect(check).toBeDefined()
      expect(check).toBeTruthy()
      expect(check).toContain("current_setting('app.user_id', true)::TEXT")
      expect(check).toContain('owner_id')
      expect(check).toContain('published')
    })

    test('returns undefined for non-custom permission type', () => {
      const permission: TablePermission = {
        type: 'authenticated',
      }

      const check = generateCustomCheck(permission)

      expect(check).toBeUndefined()
    })

    test('returns undefined when permission is undefined', () => {
      const check = generateCustomCheck(undefined)

      expect(check).toBeUndefined()
    })
  })

  describe('generateDropPolicies', () => {
    test('generates DROP statements for all four CRUD operations', () => {
      const statements = generateDropPolicies('users')

      expect(statements).toHaveLength(4)
      expect(statements[0]).toBe('DROP POLICY IF EXISTS users_select ON users')
      expect(statements[1]).toBe('DROP POLICY IF EXISTS users_insert ON users')
      expect(statements[2]).toBe('DROP POLICY IF EXISTS users_update ON users')
      expect(statements[3]).toBe('DROP POLICY IF EXISTS users_delete ON users')
    })
  })

  describe('generateAuthenticatedPolicyStatements', () => {
    test('generates authenticated policy with authenticated_ prefix', () => {
      const checkExpression =
        "current_setting('app.user_id', true) IS NOT NULL AND current_setting('app.user_id', true) != ''"
      const statements = generateAuthenticatedPolicyStatements(
        'posts',
        'read',
        'SELECT',
        checkExpression
      )

      expect(statements).toHaveLength(2)
      expect(statements[0]).toBe('DROP POLICY IF EXISTS authenticated_read ON posts')
      expect(statements[1]).toContain('CREATE POLICY authenticated_read ON posts FOR SELECT')
    })
  })

  describe('generateRolePolicyStatements', () => {
    test('generates role policy with tableName_role_ prefix', () => {
      const checkExpression = "(current_setting('app.user_role', true) = 'admin')"
      const statements = generateRolePolicyStatements('users', 'update', 'UPDATE', checkExpression)

      expect(statements).toHaveLength(2)
      expect(statements[0]).toBe('DROP POLICY IF EXISTS users_role_update ON users')
      expect(statements[1]).toContain('CREATE POLICY users_role_update ON users FOR UPDATE')
    })
  })

  describe('generateOwnerPolicyStatements', () => {
    test('generates owner policy with tableName_owner_ prefix', () => {
      const checkExpression = "owner_id = current_setting('app.user_id', true)::TEXT"
      const statements = generateOwnerPolicyStatements(
        'documents',
        'delete',
        'DELETE',
        checkExpression
      )

      expect(statements).toHaveLength(2)
      expect(statements[0]).toBe('DROP POLICY IF EXISTS documents_owner_delete ON documents')
      expect(statements[1]).toContain(
        'CREATE POLICY documents_owner_delete ON documents FOR DELETE'
      )
    })
  })

  describe('generateOperationCheck', () => {
    test('generates authenticated check for authenticated permission', () => {
      const permission: TablePermission = {
        type: 'authenticated',
      }

      const check = generateOperationCheck(permission)

      expect(check).toContain("current_setting('app.user_id', true)")
    })

    test('generates role check for roles permission', () => {
      const permission: TablePermission = {
        type: 'roles',
        roles: ['admin'],
      }

      const check = generateOperationCheck(permission)

      expect(check).toContain("current_setting('app.user_role', true)")
    })

    test('generates owner check for owner permission', () => {
      const permission: TablePermission = {
        type: 'owner',
        field: 'owner_id',
      }

      const check = generateOperationCheck(permission)

      expect(check).toContain('owner_id =')
    })

    test('generates custom check for custom permission', () => {
      const permission: TablePermission = {
        type: 'custom',
        condition: '{userId} = created_by OR {userId} = assigned_to',
      }

      const check = generateOperationCheck(permission)

      expect(check).toBeDefined()
      expect(check).toContain("current_setting('app.user_id', true)::TEXT")
      expect(check).toContain('created_by')
      expect(check).toContain('assigned_to')
    })
  })

  describe('generatePolicyName', () => {
    test('generates authenticated_ prefix for authenticated permission', () => {
      const permission: TablePermission = {
        type: 'authenticated',
      }

      const name = generatePolicyName('users', 'read', permission)

      expect(name).toBe('authenticated_read')
    })

    test('generates tableName_role_ prefix for roles permission', () => {
      const permission: TablePermission = {
        type: 'roles',
        roles: ['admin'],
      }

      const name = generatePolicyName('posts', 'create', permission)

      expect(name).toBe('posts_role_create')
    })

    test('generates tableName_owner_ prefix for owner permission', () => {
      const permission: TablePermission = {
        type: 'owner',
        field: 'owner_id',
      }

      const name = generatePolicyName('documents', 'update', permission)

      expect(name).toBe('documents_owner_update')
    })

    test('generates tableName_custom_ prefix for custom permission', () => {
      const permission: TablePermission = {
        type: 'custom',
        condition: '{userId} = owner_id AND status = published',
      }

      const name = generatePolicyName('articles', 'read', permission)

      expect(name).toBe('articles_custom_read')
    })

    test('generates tableName_operation for undefined permission', () => {
      const name = generatePolicyName('users', 'delete', undefined)

      expect(name).toBe('users_delete')
    })
  })
})
