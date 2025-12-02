/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Authorization Test Helpers
 *
 * Provides reusable assertion functions for common authorization test patterns:
 * - 401 Unauthorized: Unauthenticated requests
 * - 403 Forbidden: Insufficient permissions
 * - 404 Not Found: Cross-org access (security - prevents enumeration)
 *
 * These helpers reduce boilerplate in authorization tests while maintaining
 * clear, explicit test logic.
 *
 * @example
 * ```ts
 * import { expect401Unauthorized, expect403Forbidden, expect404CrossOrg } from '@/specs/auth-utils'
 *
 * test('should return 401 Unauthorized', async ({ request, startServerWithSchema }) => {
 *   await startServerWithSchema({ ... })
 *
 *   const response = await request.delete('/api/tables/1/records/1')
 *
 *   await expect401Unauthorized(response)
 * })
 * ```
 */

import { expect } from '@playwright/test'
import type { APIResponse } from '@playwright/test'

// =============================================================================
// Response Assertion Helpers
// =============================================================================

/**
 * Assert that response is 401 Unauthorized
 *
 * Use when testing unauthenticated requests (no auth token provided).
 *
 * @example
 * ```ts
 * // Request without authentication
 * const response = await request.delete('/api/tables/1/records/1')
 * await expect401Unauthorized(response)
 * ```
 */
export async function expect401Unauthorized(
  response: APIResponse,
  options?: {
    /** Custom error code to verify (default: 'Unauthorized' or 'UNAUTHORIZED') */
    errorCode?: string
    /** Custom error message to verify */
    errorMessage?: string
  }
): Promise<void> {
  expect(response.status()).toBe(401)

  const data = await response.json()
  expect(data).toHaveProperty('error')

  if (options?.errorCode) {
    expect(data.error).toBe(options.errorCode)
  }

  if (options?.errorMessage) {
    expect(data).toHaveProperty('message')
    expect(data.message).toBe(options.errorMessage)
  }
}

/**
 * Assert that response is 403 Forbidden
 *
 * Use when testing authenticated requests with insufficient permissions.
 * User is authenticated but lacks the required role/permission.
 *
 * @example
 * ```ts
 * // Authenticated user without delete permission
 * const response = await request.delete('/api/tables/1/records/1', {})
 * await expect403Forbidden(response, {
 *   errorMessage: 'You do not have permission to delete records in this table'
 * })
 * ```
 */
export async function expect403Forbidden(
  response: APIResponse,
  options?: {
    /** Expected error code (default: 'Forbidden') */
    errorCode?: string
    /** Expected error message */
    errorMessage?: string
  }
): Promise<void> {
  expect(response.status()).toBe(403)

  const data = await response.json()
  expect(data).toHaveProperty('error')
  expect(data.error).toBe(options?.errorCode ?? 'Forbidden')

  if (options?.errorMessage) {
    expect(data).toHaveProperty('message')
    expect(data.message).toBe(options.errorMessage)
  }
}

/**
 * Assert that response is 404 Not Found (for cross-org access)
 *
 * Use when testing organization isolation. Returns 404 instead of 403
 * to prevent organization enumeration attacks.
 *
 * @example
 * ```ts
 * // User from org_123 trying to access record from org_456
 * const response = await request.get('/api/tables/1/records/1', {})
 * await expect404CrossOrg(response)
 * ```
 */
export async function expect404CrossOrg(
  response: APIResponse,
  options?: {
    /** Expected error message (default: 'Record not found') */
    errorMessage?: string
  }
): Promise<void> {
  expect(response.status()).toBe(404)

  const data = await response.json()
  expect(data).toHaveProperty('error')
  expect(data.error).toBe(options?.errorMessage ?? 'Record not found')
}

/**
 * Assert that response is 404 Not Found (generic)
 *
 * Use when testing that a resource doesn't exist.
 *
 * @example
 * ```ts
 * // Request for non-existent record
 * const response = await request.get('/api/tables/1/records/9999', {})
 * await expect404NotFound(response)
 * ```
 */
export async function expect404NotFound(
  response: APIResponse,
  options?: {
    /** Expected error message (default: 'Record not found') */
    errorMessage?: string
  }
): Promise<void> {
  expect(response.status()).toBe(404)

  const data = await response.json()
  expect(data).toHaveProperty('error')
  expect(data.error).toBe(options?.errorMessage ?? 'Record not found')
}

// =============================================================================
// Error Response Structure Types
// =============================================================================

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  error: string
  message?: string
  code?: string
}

// =============================================================================
// Table Permission Test Patterns
// =============================================================================

/**
 * Standard permission error messages for table operations
 */
export const TABLE_PERMISSION_ERRORS = {
  read: 'You do not have permission to read records in this table',
  create: 'You do not have permission to create records in this table',
  update: 'You do not have permission to update records in this table',
  delete: 'You do not have permission to delete records in this table',
} as const

/**
 * Helper to build expected 403 error message for table operations
 */
export function getTablePermissionError(
  operation: 'read' | 'create' | 'update' | 'delete'
): string {
  return TABLE_PERMISSION_ERRORS[operation]
}

// =============================================================================
// Test Data Setup Helpers
// =============================================================================

/**
 * Standard table schema for authorization tests
 * Includes organization_id field for multi-tenant scenarios
 */
export const STANDARD_AUTH_TEST_SCHEMA = {
  employees: {
    fields: [
      { id: 1, name: 'name', type: 'single-line-text' as const },
      { id: 2, name: 'email', type: 'email' as const, required: true },
      { id: 3, name: 'organization_id', type: 'single-line-text' as const },
    ],
  },
  projects: {
    fields: [
      { id: 1, name: 'name', type: 'single-line-text' as const },
      { id: 2, name: 'status', type: 'single-line-text' as const },
      { id: 3, name: 'organization_id', type: 'single-line-text' as const },
    ],
  },
} as const

/**
 * Generate INSERT SQL for test data with organization isolation
 *
 * @example
 * ```ts
 * const sql = generateInsertSql('employees', [
 *   { id: 1, name: 'Alice', email: 'alice@example.com', organization_id: 'org_123' },
 *   { id: 2, name: 'Bob', email: 'bob@example.com', organization_id: 'org_456' },
 * ])
 * await executeQuery(sql)
 * ```
 */
export function generateInsertSql(table: string, records: Record<string, unknown>[]): string {
  const firstRecord = records[0]
  if (!firstRecord) return ''

  const columns = Object.keys(firstRecord)
  const columnList = columns.join(', ')

  const values = records
    .map((record) => {
      const valueList = columns
        .map((col) => {
          const value = record[col]
          if (value === null || value === undefined) return 'NULL'
          if (typeof value === 'number') return String(value)
          return `'${String(value).replace(/'/g, "''")}'`
        })
        .join(', ')
      return `(${valueList})`
    })
    .join(',\n        ')

  return `INSERT INTO ${table} (${columnList}) VALUES ${values}`
}

// =============================================================================
// Common Test Scenario Builders
// =============================================================================

/**
 * Build app schema for authorization tests
 * Creates a table with the given name and includes organization_id field
 *
 * @example
 * ```ts
 * await startServerWithSchema(
 *   buildAuthTestAppSchema('employees', [
 *     { id: 1, name: 'name', type: 'single-line-text' },
 *     { id: 2, name: 'email', type: 'email', required: true },
 *   ])
 * )
 * ```
 */
export function buildAuthTestAppSchema(
  tableName: string,
  fields: Array<{
    id: number
    name: string
    type: string
    required?: boolean
    [key: string]: unknown
  }>,
  options?: {
    /** Table ID (default: 1) */
    tableId?: number
    /** Include organization_id field (default: true) */
    includeOrgIdField?: boolean
    /** App name (default: 'test-app') */
    appName?: string
  }
) {
  const tableId = options?.tableId ?? 1
  const includeOrgIdField = options?.includeOrgIdField ?? true
  const appName = options?.appName ?? 'test-app'

  // Add organization_id field if not present
  const allFields =
    includeOrgIdField && !fields.some((f) => f.name === 'organization_id')
      ? [...fields, { id: fields.length + 1, name: 'organization_id', type: 'single-line-text' }]
      : fields

  return {
    name: appName,
    tables: [
      {
        id: tableId,
        name: tableName,
        fields: allFields,
      },
    ],
  }
}
