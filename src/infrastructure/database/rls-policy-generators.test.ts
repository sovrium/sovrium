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
  test('should generate RLS policies for organization-scoped table', () => {
    const table: Table = {
      id: 1,
      name: 'projects',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'name', type: 'single-line-text' },
        { id: 3, name: 'organization_id', type: 'single-line-text' },
      ],
      permissions: {
        organizationScoped: true,
      },
    }

    const statements = generateRLSPolicyStatements(table)

    expect(statements).toHaveLength(10) // Enable RLS + Force RLS + 4 drops + 4 creates

    // Check ALTER TABLE ENABLE RLS and FORCE RLS
    expect(statements[0]).toBe('ALTER TABLE projects ENABLE ROW LEVEL SECURITY')
    expect(statements[1]).toBe('ALTER TABLE projects FORCE ROW LEVEL SECURITY')

    // Check DROP statements
    expect(statements[2]).toBe('DROP POLICY IF EXISTS projects_org_select ON projects')
    expect(statements[3]).toBe('DROP POLICY IF EXISTS projects_org_insert ON projects')
    expect(statements[4]).toBe('DROP POLICY IF EXISTS projects_org_update ON projects')
    expect(statements[5]).toBe('DROP POLICY IF EXISTS projects_org_delete ON projects')

    // Check CREATE POLICY statements
    expect(statements[6]).toContain('CREATE POLICY projects_org_select ON projects FOR SELECT')
    expect(statements[6]).toContain(
      "organization_id = current_setting('app.organization_id')::TEXT"
    )

    expect(statements[7]).toContain('CREATE POLICY projects_org_insert ON projects FOR INSERT')
    expect(statements[7]).toContain('WITH CHECK')

    expect(statements[8]).toContain('CREATE POLICY projects_org_update ON projects FOR UPDATE')
    expect(statements[8]).toContain('USING')
    expect(statements[8]).toContain('WITH CHECK')

    expect(statements[9]).toContain('CREATE POLICY projects_org_delete ON projects FOR DELETE')
    expect(statements[9]).toContain('USING')
  })

  test('should return empty array when organizationScoped is false', () => {
    const table: Table = {
      id: 1,
      name: 'public_data',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'title', type: 'single-line-text' },
      ],
      permissions: {
        organizationScoped: false,
      },
    }

    const statements = generateRLSPolicyStatements(table)
    expect(statements).toEqual([])
  })

  test('should enable RLS with no policies when no permissions configured (default deny)', () => {
    const table: Table = {
      id: 1,
      name: 'simple_table',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'value', type: 'single-line-text' },
      ],
    }

    const statements = generateRLSPolicyStatements(table)
    expect(statements).toEqual([
      'ALTER TABLE simple_table ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE simple_table FORCE ROW LEVEL SECURITY',
    ])
  })

  test('should return empty array when organization_id field is missing', () => {
    const table: Table = {
      id: 1,
      name: 'broken_table',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'name', type: 'single-line-text' },
      ],
      permissions: {
        organizationScoped: true,
      },
    }

    const statements = generateRLSPolicyStatements(table)
    expect(statements).toEqual([])
  })

  test('should combine organization scope with role-based permissions', () => {
    const table: Table = {
      id: 1,
      name: 'internal_docs',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'content', type: 'long-text' },
        { id: 3, name: 'organization_id', type: 'single-line-text' },
      ],
      permissions: {
        organizationScoped: true,
        read: { type: 'roles', roles: ['admin', 'member'] },
        create: { type: 'roles', roles: ['admin'] },
        update: { type: 'roles', roles: ['admin'] },
        delete: { type: 'roles', roles: ['admin'] },
      },
    }

    const statements = generateRLSPolicyStatements(table)

    expect(statements).toHaveLength(10) // Enable RLS + Force RLS + 4 drops + 4 creates

    // Check SELECT policy combines organization + role check
    expect(statements[6]).toContain('FOR SELECT')
    expect(statements[6]).toContain(
      "organization_id = current_setting('app.organization_id')::TEXT"
    )
    expect(statements[6]).toContain("current_setting('app.user_role')::TEXT = 'admin'")
    expect(statements[6]).toContain("current_setting('app.user_role')::TEXT = 'member'")
    expect(statements[6]).toContain('OR') // admin OR member

    // Check INSERT policy combines organization + admin-only
    expect(statements[7]).toContain('FOR INSERT')
    expect(statements[7]).toContain(
      "organization_id = current_setting('app.organization_id')::TEXT"
    )
    expect(statements[7]).toContain("current_setting('app.user_role')::TEXT = 'admin'")

    // Check UPDATE policy combines organization + admin-only
    expect(statements[8]).toContain('FOR UPDATE')
    expect(statements[8]).toContain(
      "organization_id = current_setting('app.organization_id')::TEXT"
    )
    expect(statements[8]).toContain("current_setting('app.user_role')::TEXT = 'admin'")

    // Check DELETE policy combines organization + admin-only
    expect(statements[9]).toContain('FOR DELETE')
    expect(statements[9]).toContain(
      "organization_id = current_setting('app.organization_id')::TEXT"
    )
    expect(statements[9]).toContain("current_setting('app.user_role')::TEXT = 'admin'")
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
    expect(updatePolicy).toContain("owner_id = current_setting('app.user_id')::TEXT")

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
    expect(selectPolicy).toContain("author_id = current_setting('app.user_id')::TEXT")
    expect(selectPolicy).toContain('USING')

    // Check INSERT policy
    const insertPolicy = statements.find((s) => s.includes('FOR INSERT'))
    expect(insertPolicy).toBeDefined()
    expect(insertPolicy).toContain("author_id = current_setting('app.user_id')::TEXT")
    expect(insertPolicy).toContain('WITH CHECK')

    // Check UPDATE policy
    const updatePolicy = statements.find((s) => s.includes('FOR UPDATE'))
    expect(updatePolicy).toBeDefined()
    expect(updatePolicy).toContain("author_id = current_setting('app.user_id')::TEXT")
    expect(updatePolicy).toContain('USING')
    expect(updatePolicy).toContain('WITH CHECK')

    // Check DELETE policy
    const deletePolicy = statements.find((s) => s.includes('FOR DELETE'))
    expect(deletePolicy).toBeDefined()
    expect(deletePolicy).toContain("author_id = current_setting('app.user_id')::TEXT")
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

  test('should return empty array for table with organizationScoped', () => {
    const table: Table = {
      id: 1,
      name: 'org_data',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'organization_id', type: 'single-line-text' },
      ],
      permissions: {
        organizationScoped: true,
      },
    }

    const statements = generateBasicTableGrants(table)
    expect(statements).toEqual([])
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
