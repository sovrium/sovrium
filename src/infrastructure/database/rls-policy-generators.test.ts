/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { generateRLSPolicyStatements } from './rls-policy-generators'
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

    expect(statements).toHaveLength(9) // Enable RLS + 4 drops + 4 creates

    // Check ALTER TABLE ENABLE RLS
    expect(statements[0]).toBe('ALTER TABLE projects ENABLE ROW LEVEL SECURITY')

    // Check DROP statements
    expect(statements[1]).toBe('DROP POLICY IF EXISTS projects_org_select ON projects')
    expect(statements[2]).toBe('DROP POLICY IF EXISTS projects_org_insert ON projects')
    expect(statements[3]).toBe('DROP POLICY IF EXISTS projects_org_update ON projects')
    expect(statements[4]).toBe('DROP POLICY IF EXISTS projects_org_delete ON projects')

    // Check CREATE POLICY statements
    expect(statements[5]).toContain('CREATE POLICY projects_org_select ON projects FOR SELECT')
    expect(statements[5]).toContain("organization_id = current_setting('app.organization_id')::TEXT")

    expect(statements[6]).toContain('CREATE POLICY projects_org_insert ON projects FOR INSERT')
    expect(statements[6]).toContain('WITH CHECK')

    expect(statements[7]).toContain('CREATE POLICY projects_org_update ON projects FOR UPDATE')
    expect(statements[7]).toContain('USING')
    expect(statements[7]).toContain('WITH CHECK')

    expect(statements[8]).toContain('CREATE POLICY projects_org_delete ON projects FOR DELETE')
    expect(statements[8]).toContain('USING')
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

  test('should return empty array when organizationScoped is undefined', () => {
    const table: Table = {
      id: 1,
      name: 'simple_table',
      fields: [
        { id: 1, name: 'id', type: 'integer', required: true },
        { id: 2, name: 'value', type: 'single-line-text' },
      ],
    }

    const statements = generateRLSPolicyStatements(table)
    expect(statements).toEqual([])
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
})
