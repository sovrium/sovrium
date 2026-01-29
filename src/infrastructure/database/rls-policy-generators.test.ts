/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { generateRLSPolicyStatements, generateBasicTableGrants } from './rls-policy-generators'
import type { Table } from '@/domain/models/app/table'

describe('generateRLSPolicyStatements', () => {
  test('should enable RLS with no policies when explicit empty permissions configured (default deny)', () => {
    const table: Table = {
      id: 1,
      name: 'simple_table',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'value', type: 'single-line-text' },
      ],
      // Explicit empty permissions = true deny (0 policies, all access blocked)
      permissions: {},
    }

    const statements = generateRLSPolicyStatements(table)
    // When permissions is explicitly empty {}, only enable RLS (no policies = default deny)
    expect(statements).toEqual([
      'ALTER TABLE simple_table ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE simple_table FORCE ROW LEVEL SECURITY',
    ])
  })

  test('should generate authenticated policies when permissions not configured (API access allowed)', () => {
    const table: Table = {
      id: 1,
      name: 'unconfigured_table',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'value', type: 'single-line-text' },
      ],
      // No permissions property = undefined = API access allowed via authenticated session
    }

    const statements = generateRLSPolicyStatements(table)
    // When permissions is undefined (not configured), enable RLS with authenticated policies
    expect(statements).toEqual([
      'ALTER TABLE unconfigured_table ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE unconfigured_table FORCE ROW LEVEL SECURITY',
      'DROP POLICY IF EXISTS unconfigured_table_authenticated_select ON unconfigured_table',
      "CREATE POLICY unconfigured_table_authenticated_select ON unconfigured_table FOR SELECT USING (current_setting('app.user_id', true) IS NOT NULL AND current_setting('app.user_id', true) != '')",
      'DROP POLICY IF EXISTS unconfigured_table_authenticated_insert ON unconfigured_table',
      "CREATE POLICY unconfigured_table_authenticated_insert ON unconfigured_table FOR INSERT WITH CHECK (current_setting('app.user_id', true) IS NOT NULL AND current_setting('app.user_id', true) != '')",
      'DROP POLICY IF EXISTS unconfigured_table_authenticated_update ON unconfigured_table',
      "CREATE POLICY unconfigured_table_authenticated_update ON unconfigured_table FOR UPDATE USING (current_setting('app.user_id', true) IS NOT NULL AND current_setting('app.user_id', true) != '') WITH CHECK (current_setting('app.user_id', true) IS NOT NULL AND current_setting('app.user_id', true) != '')",
      'DROP POLICY IF EXISTS unconfigured_table_authenticated_delete ON unconfigured_table',
      "CREATE POLICY unconfigured_table_authenticated_delete ON unconfigured_table FOR DELETE USING (current_setting('app.user_id', true) IS NOT NULL AND current_setting('app.user_id', true) != '')",
    ])
  })

  test('should generate owner-based RLS policies for UPDATE operations', () => {
    const table: Table = {
      id: 1,
      name: 'documents',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'content', type: 'long-text' },
        { id: 3, name: 'owner_id', type: 'user' },
      ],
      permissions: {
        update: { type: 'owner', field: 'owner_id' },
      },
    }

    const statements = generateRLSPolicyStatements(table)

    // Should enable RLS + DROP + CREATE for UPDATE
    expect(statements.length).toBeGreaterThan(0)
    expect(statements[0]).toBe('ALTER TABLE documents ENABLE ROW LEVEL SECURITY')

    // Find UPDATE policy
    const updatePolicy = statements.find((s) => s.includes('FOR UPDATE'))
    expect(updatePolicy).toBeDefined()
    expect(updatePolicy).toContain('CREATE POLICY documents_owner_update ON documents FOR UPDATE')
    expect(updatePolicy).toContain("owner_id = current_setting('app.user_id', true)::TEXT")

    // UPDATE should have both USING and WITH CHECK clauses
    expect(updatePolicy).toContain('USING')
    expect(updatePolicy).toContain('WITH CHECK')
  })

  test('should generate owner-based RLS policies for all CRUD operations', () => {
    const table: Table = {
      id: 1,
      name: 'posts',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'title', type: 'single-line-text' },
        { id: 3, name: 'author_id', type: 'user' },
      ],
      permissions: {
        read: { type: 'owner', field: 'author_id' },
        create: { type: 'owner', field: 'author_id' },
        update: { type: 'owner', field: 'author_id' },
        delete: { type: 'owner', field: 'author_id' },
      },
    }

    const statements = generateRLSPolicyStatements(table)

    // Should have: enable RLS + force RLS + 4 drops + 4 creates
    expect(statements.length).toBe(10)
    expect(statements[0]).toBe('ALTER TABLE posts ENABLE ROW LEVEL SECURITY')
    expect(statements[1]).toBe('ALTER TABLE posts FORCE ROW LEVEL SECURITY')

    // Check DROP policies
    expect(statements.filter((s) => s.startsWith('DROP POLICY IF EXISTS'))).toHaveLength(4)

    // Check SELECT policy
    const selectPolicy = statements.find((s) => s.includes('FOR SELECT'))
    expect(selectPolicy).toBeDefined()
    expect(selectPolicy).toContain("author_id = current_setting('app.user_id', true)::TEXT")
    expect(selectPolicy).toContain('USING')

    // Check INSERT policy
    const insertPolicy = statements.find((s) => s.includes('FOR INSERT'))
    expect(insertPolicy).toBeDefined()
    expect(insertPolicy).toContain("author_id = current_setting('app.user_id', true)::TEXT")
    expect(insertPolicy).toContain('WITH CHECK')

    // Check UPDATE policy
    const updatePolicy = statements.find((s) => s.includes('FOR UPDATE'))
    expect(updatePolicy).toBeDefined()
    expect(updatePolicy).toContain("author_id = current_setting('app.user_id', true)::TEXT")
    expect(updatePolicy).toContain('USING')
    expect(updatePolicy).toContain('WITH CHECK')

    // Check DELETE policy
    const deletePolicy = statements.find((s) => s.includes('FOR DELETE'))
    expect(deletePolicy).toBeDefined()
    expect(deletePolicy).toContain("author_id = current_setting('app.user_id', true)::TEXT")
    expect(deletePolicy).toContain('USING')
  })

  test('should generate public RLS policies (priority 1 - no policies, public access)', () => {
    const table: Table = {
      id: 1,
      name: 'public_announcements',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'message', type: 'single-line-text' },
      ],
      permissions: {
        read: { type: 'public' },
        create: { type: 'public' },
        update: { type: 'public' },
        delete: { type: 'public' },
      },
    }

    const statements = generateRLSPolicyStatements(table)

    // Public permissions = no RLS needed, return empty array
    expect(statements).toEqual([])
  })

  test('should generate record-level custom permission policies (priority 4)', () => {
    const table: Table = {
      id: 1,
      name: 'tasks',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'title', type: 'single-line-text' },
        { id: 3, name: 'assigned_to', type: 'user' },
        { id: 4, name: 'status', type: 'single-line-text' },
      ],
      permissions: {
        records: [
          {
            action: 'read',
            condition: "{userId} = assigned_to OR status = 'public'",
          },
          {
            action: 'create',
            condition: '{userId} = assigned_to',
          },
          {
            action: 'update',
            condition: '{userId} = assigned_to',
          },
          {
            action: 'delete',
            condition: '{userId} = assigned_to',
          },
        ],
      },
    }

    const statements = generateRLSPolicyStatements(table)

    expect(statements.length).toBeGreaterThan(0)
    expect(statements[0]).toBe('ALTER TABLE tasks ENABLE ROW LEVEL SECURITY')
    expect(statements[1]).toBe('ALTER TABLE tasks FORCE ROW LEVEL SECURITY')

    // Check SELECT policy with custom condition
    const selectPolicy = statements.find((s) => s.includes('FOR SELECT'))
    expect(selectPolicy).toBeDefined()
    expect(selectPolicy).toContain('CREATE POLICY tasks_record_read ON tasks FOR SELECT')
    expect(selectPolicy).toContain("current_setting('app.user_id', true)::TEXT")
    expect(selectPolicy).toContain('assigned_to')
    expect(selectPolicy).toContain('status')
    expect(selectPolicy).toContain('public')

    // Check INSERT policy
    const insertPolicy = statements.find((s) => s.includes('FOR INSERT'))
    expect(insertPolicy).toBeDefined()
    expect(insertPolicy).toContain('CREATE POLICY tasks_record_create ON tasks FOR INSERT')

    // Check UPDATE policy (should have both USING and WITH CHECK)
    const updatePolicy = statements.find((s) => s.includes('FOR UPDATE'))
    expect(updatePolicy).toBeDefined()
    expect(updatePolicy).toContain('USING')
    expect(updatePolicy).toContain('WITH CHECK')

    // Check DELETE policy
    const deletePolicy = statements.find((s) => s.includes('FOR DELETE'))
    expect(deletePolicy).toBeDefined()
  })

  test('should generate mixed permission policies (priority 5 - different types per operation)', () => {
    const table: Table = {
      id: 1,
      name: 'articles',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'title', type: 'single-line-text' },
        { id: 3, name: 'author_id', type: 'user' },
      ],
      permissions: {
        read: { type: 'public' }, // Public read
        create: { type: 'authenticated' }, // Authenticated users can create
        update: { type: 'owner', field: 'author_id' }, // Only owner can update
        delete: { type: 'roles', roles: ['admin'] }, // Only admins can delete
      },
    }

    const statements = generateRLSPolicyStatements(table)

    expect(statements.length).toBeGreaterThan(0)
    expect(statements[0]).toBe('ALTER TABLE articles ENABLE ROW LEVEL SECURITY')

    // Read: Public (no policy needed for SELECT)
    const selectPolicies = statements.filter(
      (s) => s.includes('FOR SELECT') && s.includes('CREATE POLICY')
    )
    expect(selectPolicies.length).toBe(0) // Public = no SELECT policy

    // Create: Authenticated
    const insertPolicy = statements.find((s) => s.includes('FOR INSERT'))
    expect(insertPolicy).toBeDefined()
    expect(insertPolicy).toContain("current_setting('app.user_id', true) IS NOT NULL")

    // Update: Owner
    const updatePolicy = statements.find((s) => s.includes('FOR UPDATE'))
    expect(updatePolicy).toBeDefined()
    expect(updatePolicy).toContain("author_id = current_setting('app.user_id', true)::TEXT")

    // Delete: Role (admin)
    const deletePolicy = statements.find((s) => s.includes('FOR DELETE'))
    expect(deletePolicy).toBeDefined()
    expect(deletePolicy).toContain("current_setting('app.user_role', true) = 'admin'")
  })

  test('should generate authenticated policies for all operations (priority 7)', () => {
    const table: Table = {
      id: 1,
      name: 'user_profiles',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'bio', type: 'long-text' },
      ],
      permissions: {
        read: { type: 'authenticated' },
        create: { type: 'authenticated' },
        update: { type: 'authenticated' },
        delete: { type: 'authenticated' },
      },
    }

    const statements = generateRLSPolicyStatements(table)

    expect(statements.length).toBe(10) // Enable + Force + 4 drops + 4 creates

    // All policies should check authenticated session
    const authCheck = "current_setting('app.user_id', true) IS NOT NULL"

    const selectPolicy = statements.find((s) => s.includes('FOR SELECT'))
    expect(selectPolicy).toContain(authCheck)

    const insertPolicy = statements.find((s) => s.includes('FOR INSERT'))
    expect(insertPolicy).toContain(authCheck)

    const updatePolicy = statements.find((s) => s.includes('FOR UPDATE'))
    expect(updatePolicy).toContain(authCheck)

    const deletePolicy = statements.find((s) => s.includes('FOR DELETE'))
    expect(deletePolicy).toContain(authCheck)
  })

  test('should generate role-based policies (priority 8)', () => {
    const table: Table = {
      id: 1,
      name: 'admin_settings',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'key', type: 'single-line-text' },
        { id: 3, name: 'value', type: 'single-line-text' },
      ],
      permissions: {
        read: { type: 'roles', roles: ['admin', 'member'] },
        create: { type: 'roles', roles: ['admin'] },
        update: { type: 'roles', roles: ['admin'] },
        delete: { type: 'roles', roles: ['admin'] },
      },
    }

    const statements = generateRLSPolicyStatements(table)

    expect(statements.length).toBeGreaterThan(0)

    // Read: admin OR member
    const selectPolicy = statements.find((s) => s.includes('FOR SELECT'))
    expect(selectPolicy).toBeDefined()
    expect(selectPolicy).toContain("current_setting('app.user_role', true) = 'admin'")
    expect(selectPolicy).toContain("current_setting('app.user_role', true) = 'member'")
    expect(selectPolicy).toContain('OR')

    // Create/Update/Delete: admin only
    const insertPolicy = statements.find((s) => s.includes('FOR INSERT'))
    expect(insertPolicy).toContain("current_setting('app.user_role', true) = 'admin'")
    expect(insertPolicy).not.toContain('member')

    const updatePolicy = statements.find((s) => s.includes('FOR UPDATE'))
    expect(updatePolicy).toContain("current_setting('app.user_role', true) = 'admin'")

    const deletePolicy = statements.find((s) => s.includes('FOR DELETE'))
    expect(deletePolicy).toContain("current_setting('app.user_role', true) = 'admin'")
  })

  test('should handle empty roles array (deny all access)', () => {
    const table: Table = {
      id: 1,
      name: 'forbidden_table',
      fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
      permissions: {
        read: { type: 'roles', roles: [] },
        create: { type: 'roles', roles: [] },
        update: { type: 'roles', roles: [] },
        delete: { type: 'roles', roles: [] },
      },
    }

    const statements = generateRLSPolicyStatements(table)

    // Empty roles = false = deny all
    const selectPolicy = statements.find((s) => s.includes('FOR SELECT'))
    expect(selectPolicy).toContain('false')

    const insertPolicy = statements.find((s) => s.includes('FOR INSERT'))
    expect(insertPolicy).toContain('false')
  })

  test('should skip RLS for field-only role-based permissions (priority 9)', () => {
    const table: Table = {
      id: 1,
      name: 'user_data',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'public_info', type: 'single-line-text' },
        { id: 3, name: 'private_info', type: 'single-line-text' },
      ],
      permissions: {
        fields: [
          {
            field: 'private_info',
            read: { type: 'roles', roles: ['admin'] },
            write: { type: 'roles', roles: ['admin'] },
          },
        ],
      },
    }

    const statements = generateRLSPolicyStatements(table)

    // Field-only role permissions should skip RLS entirely (return empty array)
    // Field-level permissions are enforced via PostgreSQL column grants, not RLS policies
    expect(statements).toEqual([])
  })

  test('should not skip RLS for field-only custom/owner permissions', () => {
    const table: Table = {
      id: 1,
      name: 'sensitive_data',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'data', type: 'single-line-text' },
        { id: 3, name: 'owner_id', type: 'user' },
      ],
      permissions: {
        fields: [
          {
            field: 'data',
            read: { type: 'owner', field: 'owner_id' },
            write: { type: 'owner', field: 'owner_id' },
          },
        ],
      },
    }

    const statements = generateRLSPolicyStatements(table)

    // Custom/owner field permissions require RLS policies
    expect(statements.length).toBeGreaterThan(2) // More than just ENABLE RLS
  })

  test('should handle complex table names (SQL injection prevention)', () => {
    const table: Table = {
      id: 1,
      name: 'complex_table_name_with_underscores',
      fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
      permissions: {
        read: { type: 'authenticated' },
      },
    }

    const statements = generateRLSPolicyStatements(table)

    // Verify table name is used correctly in all statements
    const enableRLS = statements.find((s) => s.includes('ENABLE ROW LEVEL SECURITY'))
    expect(enableRLS).toContain('complex_table_name_with_underscores')

    const selectPolicy = statements.find((s) => s.includes('FOR SELECT'))
    expect(selectPolicy).toContain('complex_table_name_with_underscores')
  })

  test('should combine multiple record-level conditions (AND combination)', () => {
    const table: Table = {
      id: 1,
      name: 'project_files',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'project_id', type: 'integer' },
        { id: 3, name: 'created_by', type: 'single-line-text' },
      ],
      permissions: {
        records: [
          {
            action: 'read',
            condition:
              '{userId} IN (SELECT user_id FROM project_members WHERE project_id = project_id) AND {userId} = created_by',
          },
        ],
      },
    }

    const statements = generateRLSPolicyStatements(table)

    // Should combine conditions with AND
    const selectPolicy = statements.find((s) => s.includes('FOR SELECT'))
    expect(selectPolicy).toBeDefined()

    // Should contain translated {userId} (appears twice due to AND)
    expect(selectPolicy).toContain("current_setting('app.user_id', true)::TEXT")

    // Should contain both conditions
    expect(selectPolicy).toContain('project_members')
    expect(selectPolicy).toContain('created_by')

    // Should use AND to combine
    expect(selectPolicy).toContain('AND')
  })
})

describe('generateBasicTableGrants', () => {
  test('should generate grants for table with no permissions', () => {
    const table: Table = {
      id: 1,
      name: 'confidential',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'data', type: 'single-line-text' },
      ],
    }

    const statements = generateBasicTableGrants(table)

    // Should create roles and grant access
    expect(statements.length).toBeGreaterThan(0)
    expect(statements.some((s) => s.includes('CREATE ROLE admin_user'))).toBe(true)
    expect(statements.some((s) => s.includes('CREATE ROLE member_user'))).toBe(true)
    expect(statements.some((s) => s.includes('CREATE ROLE authenticated_user'))).toBe(true)
    expect(statements.some((s) => s.includes('GRANT USAGE ON SCHEMA public TO admin_user'))).toBe(
      true
    )
    expect(statements.some((s) => s.includes('GRANT SELECT ON confidential TO admin_user'))).toBe(
      true
    )
  })

  test('should return empty array for table with read permission', () => {
    const table: Table = {
      id: 1,
      name: 'public_data',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'title', type: 'single-line-text' },
      ],
      permissions: {
        read: { type: 'public' },
      },
    }

    const statements = generateBasicTableGrants(table)
    expect(statements).toEqual([])
  })
})
