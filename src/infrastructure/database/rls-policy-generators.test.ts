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
