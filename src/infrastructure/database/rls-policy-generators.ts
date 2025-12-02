/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Table } from '@/domain/models/app/table'

/**
 * Generate RLS policy statements for organization-scoped tables
 *
 * When a table has `permissions.organizationScoped: true`, this generates:
 * 1. ALTER TABLE statement to enable RLS
 * 2. CREATE POLICY statements for all CRUD operations
 *
 * The policies filter by organization_id using current_setting('app.organization_id')
 * which is set by the application layer based on the authenticated user's context.
 *
 * @param table - Table definition with permissions
 * @returns Array of SQL statements to enable RLS and create policies
 */
export const generateRLSPolicyStatements = (table: Table): readonly string[] => {
  // Check if organization isolation is enabled
  const isOrganizationScoped = table.permissions?.organizationScoped === true

  if (!isOrganizationScoped) {
    return []
  }

  // Verify table has organization_id field
  const hasOrganizationIdField = table.fields.some((field) => field.name === 'organization_id')
  if (!hasOrganizationIdField) {
    console.warn(
      `[RLS] Table "${table.name}" has organizationScoped=true but no organization_id field`
    )
    return []
  }

  const tableName = table.name

  // Enable RLS on table
  const enableRLS = `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`

  // Organization ID check expression
  const orgIdCheck = `organization_id = current_setting('app.organization_id')::TEXT`

  // Drop existing policies first (IF EXISTS prevents errors)
  const dropPolicies = [
    `DROP POLICY IF EXISTS ${tableName}_org_select ON ${tableName}`,
    `DROP POLICY IF EXISTS ${tableName}_org_insert ON ${tableName}`,
    `DROP POLICY IF EXISTS ${tableName}_org_update ON ${tableName}`,
    `DROP POLICY IF EXISTS ${tableName}_org_delete ON ${tableName}`,
  ]

  // Generate policies for all CRUD operations
  const selectPolicy = `CREATE POLICY ${tableName}_org_select ON ${tableName} FOR SELECT USING (${orgIdCheck})`
  const insertPolicy = `CREATE POLICY ${tableName}_org_insert ON ${tableName} FOR INSERT WITH CHECK (${orgIdCheck})`
  const updatePolicy = `CREATE POLICY ${tableName}_org_update ON ${tableName} FOR UPDATE USING (${orgIdCheck}) WITH CHECK (${orgIdCheck})`
  const deletePolicy = `CREATE POLICY ${tableName}_org_delete ON ${tableName} FOR DELETE USING (${orgIdCheck})`

  return [enableRLS, ...dropPolicies, selectPolicy, insertPolicy, updatePolicy, deletePolicy]
}
