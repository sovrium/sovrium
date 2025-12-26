/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import * as schema from '@/infrastructure/auth/better-auth/schema'
import type {
  ExecuteQueryFn,
  RoleContext,
  RlsPolicyInfo,
  QuerySuccessOptions,
  MultiOrgScenarioResult,
} from './types'

// =============================================================================
// Database Template Manager
// =============================================================================

/**
 * Database Template Manager for Fast Test Isolation
 *
 * Strategy:
 * 1. Create a template database once with all migrations applied
 * 2. For each test, duplicate the template into a new database (fast operation)
 * 3. Tests run against isolated databases in parallel
 * 4. Cleanup drops test databases after completion
 *
 * Benefits:
 * - Fast: Database duplication is ~10-100x faster than running migrations
 * - Isolated: Each test gets a pristine database copy
 * - Parallel: Tests can run concurrently without interference
 */
export class DatabaseTemplateManager {
  private templateDbName = 'sovrium_test_template'
  private adminConnectionUrl: string

  constructor(private containerConnectionUrl: string) {
    // Extract admin connection (connect to 'postgres' database for admin operations)
    const url = new URL(containerConnectionUrl)
    url.pathname = '/postgres'
    this.adminConnectionUrl = url.toString()
  }

  /**
   * Create template database and run all migrations
   * Called once during global setup
   */
  async createTemplate(): Promise<void> {
    // Wait for container to be fully ready before creating admin pool
    await this.waitForContainerReady()

    // Create admin pool once and reuse for both drop and create
    const adminPool = new Pool({
      connectionString: this.adminConnectionUrl,
      max: 1,
      connectionTimeoutMillis: 5000,
    })

    try {
      // Drop template if exists (for clean slate)
      await this.dropDatabaseWithPool(adminPool, this.templateDbName)

      // Create fresh template database
      await adminPool.query(`CREATE DATABASE "${this.templateDbName}"`)

      // Create a non-superuser role for RLS testing
      // Superusers always bypass RLS (even with NOBYPASSRLS), so we create
      // a separate role 'app_user' without superuser privileges.
      // Tests should use SET ROLE app_user to switch to this role before queries.
      await adminPool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
            CREATE ROLE app_user WITH LOGIN INHERIT;
          END IF;
        END
        $$;
        GRANT ALL PRIVILEGES ON DATABASE "${this.templateDbName}" TO app_user;
        GRANT app_user TO test;
      `)
    } finally {
      await adminPool.end()
    }

    // Run migrations on template
    const templateUrl = this.getTemplateUrl()
    const templatePool = new Pool({ connectionString: templateUrl })
    const db = drizzle(templatePool, { schema })

    try {
      await migrate(db, { migrationsFolder: './drizzle' })

      // Create auth schema and helper functions for RLS policies
      // This was previously in migrations but consolidated out
      await templatePool.query(`
        CREATE SCHEMA IF NOT EXISTS auth;

        CREATE OR REPLACE FUNCTION auth.user_has_role(role_name TEXT)
        RETURNS BOOLEAN
        LANGUAGE sql
        STABLE
        AS $$
          SELECT COALESCE(current_setting('app.user_role', true), '') = role_name
        $$;

        CREATE OR REPLACE FUNCTION auth.is_authenticated()
        RETURNS BOOLEAN
        LANGUAGE sql
        STABLE
        AS $$
          SELECT current_setting('app.user_id', true) IS NOT NULL
            AND current_setting('app.user_id', true) != ''
        $$;

        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_user') THEN
            CREATE ROLE admin_user;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'member_user') THEN
            CREATE ROLE member_user;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated_user') THEN
            CREATE ROLE authenticated_user;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guest_user') THEN
            CREATE ROLE guest_user;
          END IF;
        END
        $$;
      `)

      // Configure custom session variables for RLS policies
      // These variables are used by Row-Level Security policies to filter data
      // based on authenticated user context (user_id, organization_id, role)
      await templatePool.query(`
        ALTER DATABASE "${this.templateDbName}" SET app.user_id = '';
        ALTER DATABASE "${this.templateDbName}" SET app.organization_id = '';
        ALTER DATABASE "${this.templateDbName}" SET app.user_role = '';
      `)

      // Grant schema and table access to app_user for RLS testing
      // This allows the non-superuser role to access all tables through SET ROLE
      await templatePool.query(`
        GRANT USAGE ON SCHEMA public TO app_user;
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
        GRANT USAGE ON SCHEMA auth TO app_user;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO app_user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO app_user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO app_user;
      `)

      // Grant test roles to app_user so it can switch roles via SET ROLE
      // This allows app_user (non-superuser) to test RLS policies with different permission levels
      await templatePool.query(`
        GRANT admin_user TO app_user;
        GRANT member_user TO app_user;
        GRANT authenticated_user TO app_user;
        GRANT guest_user TO app_user;
      `)

      // Grant test roles to 'test' user for direct SET ROLE usage in executeQuery fixture
      // This allows tests to directly SET ROLE admin_user without going through app_user first
      await templatePool.query(`
        GRANT admin_user TO test;
        GRANT member_user TO test;
        GRANT authenticated_user TO test;
        GRANT guest_user TO test;
      `)

      // Grant schema and sequence privileges to test roles
      // Required for INSERT operations when using SET ROLE to switch roles
      await templatePool.query(`
        GRANT USAGE ON SCHEMA public TO admin_user, member_user, authenticated_user, guest_user;
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin_user, member_user, authenticated_user, guest_user;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin_user, member_user, authenticated_user, guest_user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO admin_user, member_user, authenticated_user, guest_user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO admin_user, member_user, authenticated_user, guest_user;
      `)

      // Clear checksum table to ensure tests start with clean state
      // Migration audit trail tables are created by Drizzle migrations, but may have
      // residual data from previous test runs if template was reused.
      await templatePool.query(`DELETE FROM _sovrium_schema_checksum`)
    } finally {
      await templatePool.end()
    }
  }

  /**
   * Wait for PostgreSQL container to be ready
   * Creates and destroys temporary pools to avoid connection termination issues
   */
  private async waitForContainerReady(maxAttempts = 20): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const testPool = new Pool({
        connectionString: this.adminConnectionUrl,
        max: 1,
        connectionTimeoutMillis: 5000,
      })

      try {
        await testPool.query('SELECT 1')
        await testPool.end()
        return
      } catch (error) {
        try {
          await testPool.end()
        } catch {
          // Ignore pool cleanup errors
        }

        if (i === maxAttempts - 1) {
          throw new Error(
            `PostgreSQL container not ready after ${maxAttempts} attempts: ${error instanceof Error ? error.message : error}`
          )
        }

        const backoff = i < 3 ? 500 : i < 6 ? 1000 : 1500
        await new Promise((resolve) => setTimeout(resolve, backoff))
      }
    }
  }

  /**
   * Duplicate template into a new test database
   * Called before each test that needs database access
   */
  async duplicateTemplate(testDbName: string): Promise<string> {
    const adminPool = new Pool({ connectionString: this.adminConnectionUrl })
    try {
      // Terminate connections to template (required for duplication)
      await adminPool.query(
        `
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = $1
          AND pid <> pg_backend_pid()
      `,
        [this.templateDbName]
      )

      // Small delay to ensure connections are fully terminated
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Create new database from template
      await adminPool.query(`CREATE DATABASE "${testDbName}" TEMPLATE "${this.templateDbName}"`)
    } finally {
      await adminPool.end()
    }

    return this.getTestDatabaseUrl(testDbName)
  }

  /**
   * Drop test database
   * Called after each test for cleanup
   */
  async dropTestDatabase(testDbName: string): Promise<void> {
    await this.dropDatabase(testDbName)
  }

  /**
   * Cleanup template database
   * Called during global teardown
   */
  async cleanup(): Promise<void> {
    await this.dropDatabase(this.templateDbName)
  }

  /**
   * Get template database URL
   */
  private getTemplateUrl(): string {
    return this.getTestDatabaseUrl(this.templateDbName)
  }

  /**
   * Get test database URL
   */
  private getTestDatabaseUrl(dbName: string): string {
    const url = new URL(this.containerConnectionUrl)
    url.pathname = `/${dbName}`
    return url.toString()
  }

  /**
   * Drop database if exists (creates its own pool)
   */
  private async dropDatabase(dbName: string): Promise<void> {
    const adminPool = new Pool({
      connectionString: this.adminConnectionUrl,
      max: 1,
      connectionTimeoutMillis: 5000,
    })

    try {
      await this.dropDatabaseWithPool(adminPool, dbName)
    } finally {
      await adminPool.end()
    }
  }

  /**
   * Drop database if exists (uses provided pool)
   */
  private async dropDatabaseWithPool(adminPool: Pool, dbName: string): Promise<void> {
    // Use retry logic to handle transient connection issues
    const maxRetries = 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // First, check if database exists
        const checkResult = await adminPool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [
          dbName,
        ])

        // If database doesn't exist, we're done
        if (checkResult.rows.length === 0) {
          return
        }

        // Terminate all connections to the target database (force)
        await adminPool.query(
          `
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = $1
            AND pid <> pg_backend_pid()
        `,
          [dbName]
        )

        // Wait for connections to fully terminate
        await new Promise((resolve) => setTimeout(resolve, 200))

        // Use DROP DATABASE with FORCE (PostgreSQL 13+)
        // This will forcefully terminate remaining connections
        await adminPool.query(`DROP DATABASE "${dbName}" WITH (FORCE)`)

        // Success! Break retry loop
        return
      } catch (error) {
        // If this was the last attempt, log warning and continue
        if (attempt === maxRetries) {
          console.warn(
            `Warning dropping database ${dbName} after ${maxRetries} attempts:`,
            error instanceof Error ? error.message : error
          )
          // Don't throw, just continue - database drop is best-effort
          return
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, attempt * 200))
      }
    }
  }
}

/**
 * Generate unique test database name
 * Uses worker index and timestamp to ensure uniqueness across parallel tests
 */
export function generateTestDatabaseName(testInfo: { workerIndex: number }): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  return `sovrium_test_${testInfo.workerIndex}_${timestamp}_${random}`
}

// =============================================================================
// SQL Statement Utilities
// =============================================================================

/**
 * Split SQL query into multiple statements, respecting string literals
 * Handles PostgreSQL string escaping ('')  within quotes
 */
export function splitSQLStatements(query: string): string[] {
  const statements: string[] = []
  let current = ''
  let inString = false
  let i = 0

  while (i < query.length) {
    const char = query[i]

    if (char === "'" && !inString) {
      // Start of string literal
      inString = true
      current += char
      i++
    } else if (char === "'" && inString) {
      // Check if this is an escaped quote ('')
      if (i + 1 < query.length && query[i + 1] === "'") {
        // Escaped quote - add both quotes and continue
        current += "''"
        i += 2
      } else {
        // End of string literal
        inString = false
        current += char
        i++
      }
    } else if (char === ';' && !inString) {
      // Statement separator (not inside string)
      const stmt = current.trim()
      if (stmt.length > 0) {
        statements.push(stmt)
      }
      current = ''
      i++
    } else {
      current += char
      i++
    }
  }

  // Add final statement
  const stmt = current.trim()
  if (stmt.length > 0) {
    statements.push(stmt)
  }

  return statements
}

/**
 * Helper function to execute multiple SQL statements in a transaction
 * Used for SET LOCAL pattern in RLS testing
 */
export async function executeStatementsInTransaction(
  client: any,
  statements: string[]
): Promise<{ rows: any[]; rowCount: number; [key: string]: any }> {
  await client.query('BEGIN')
  try {
    let lastResult: any = { rows: [], rowCount: 0 }
    for (const sql of statements) {
      const result = await client.query(sql)
      const rows = result.rows
      const rowCount = result.rowCount || 0
      lastResult = rows.length === 1 ? { rows, rowCount, ...rows[0] } : { rows, rowCount }
    }
    await client.query('COMMIT')
    return lastResult
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

// =============================================================================
// Role-Based Query Execution Utilities
// =============================================================================

/**
 * Execute SQL queries as a specific database role with session context
 *
 * This helper simplifies RLS testing by:
 * 1. Setting session variables (app.user_id, app.user_role, app.organization_id)
 * 2. Switching to a non-superuser database role (SET ROLE)
 * 3. Executing the query
 * 4. Resetting the role back to superuser
 *
 * **Important**: Uses SET ROLE (not SET SESSION AUTHORIZATION) to avoid
 * the PostgreSQL limitation where SET LOCAL variables are invisible
 * to RLS policies after SESSION AUTHORIZATION switch.
 *
 * @example Basic usage with member role
 * ```ts
 * const result = await executeQueryAsRole(
 *   executeQuery,
 *   { dbRole: 'member_user', userId: user.id, userRole: 'member' },
 *   'SELECT * FROM projects'
 * )
 * expect(result.rows).toHaveLength(2)
 * ```
 *
 * @example Organization-scoped query
 * ```ts
 * const result = await executeQueryAsRole(
 *   executeQuery,
 *   {
 *     dbRole: 'authenticated_user',
 *     userId: user.id,
 *     organizationId: org.id
 *   },
 *   'SELECT * FROM employees'
 * )
 * ```
 *
 * @example Admin role with full context
 * ```ts
 * const result = await executeQueryAsRole(
 *   executeQuery,
 *   {
 *     dbRole: 'admin_user',
 *     userId: admin.id,
 *     userRole: 'admin',
 *     organizationId: org.id
 *   },
 *   "INSERT INTO confidential (data) VALUES ('secret') RETURNING id"
 * )
 * ```
 */
export async function executeQueryAsRole(
  executeQuery: ExecuteQueryFn,
  context: RoleContext,
  sql: string
): Promise<{ rows: any[]; rowCount: number; [key: string]: any }> {
  // Build the session variable SET statements
  const setStatements: string[] = []

  if (context.userId) {
    setStatements.push(`SET app.user_id = '${context.userId}'`)
  }
  if (context.userRole) {
    setStatements.push(`SET app.user_role = '${context.userRole}'`)
  }
  if (context.organizationId) {
    setStatements.push(`SET app.organization_id = '${context.organizationId}'`)
  }

  // SET ROLE to switch database role (preserves session variable visibility)
  if (context.dbRole) {
    setStatements.push(`SET ROLE ${context.dbRole}`)
  }

  // Combine: set context → execute query → reset role
  const combinedSql = [...setStatements, sql, 'RESET ROLE'].join('; ')

  return executeQuery(combinedSql)
}

/**
 * Generate a unique PostgreSQL role name for test isolation
 * Prevents conflicts when running tests in parallel
 *
 * @example
 * ```ts
 * const roleName = generateRoleName('member')
 * // Returns: 'member_1702345678901_abc123'
 * ```
 */
export function generateRoleName(prefix: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}_${timestamp}_${random}`
}

// =============================================================================
// RLS Policy Verification Utilities
// =============================================================================

/**
 * Verify that an RLS policy exists on a table
 *
 * @example
 * ```ts
 * const policy = await verifyRlsPolicyExists(
 *   executeQuery,
 *   'employees',
 *   'authenticated_read'
 * )
 * expect(policy).toBeDefined()
 * expect(policy.cmd).toBe('SELECT')
 * ```
 */
export async function verifyRlsPolicyExists(
  executeQuery: ExecuteQueryFn,
  tableName: string,
  policyName: string
): Promise<RlsPolicyInfo | null> {
  const result = await executeQuery(
    `SELECT policyname, tablename, cmd, qual, with_check
     FROM pg_policies
     WHERE tablename = $1 AND policyname = $2`,
    [tableName, policyName]
  )
  return result.rows[0] || null
}

/**
 * Get all RLS policies for a table
 *
 * @example
 * ```ts
 * const policies = await getRlsPolicies(executeQuery, 'employees')
 * expect(policies).toHaveLength(4) // read, create, update, delete
 * ```
 */
export async function getRlsPolicies(
  executeQuery: ExecuteQueryFn,
  tableName: string
): Promise<RlsPolicyInfo[]> {
  const result = await executeQuery(
    `SELECT policyname, tablename, cmd, qual, with_check
     FROM pg_policies
     WHERE tablename = $1
     ORDER BY policyname`,
    [tableName]
  )
  return result.rows
}

/**
 * Verify that RLS is enabled on a table
 *
 * @example
 * ```ts
 * const isEnabled = await verifyRlsEnabled(executeQuery, 'employees')
 * expect(isEnabled).toBe(true)
 * ```
 */
export async function verifyRlsEnabled(
  executeQuery: ExecuteQueryFn,
  tableName: string
): Promise<boolean> {
  const result = await executeQuery(`SELECT relrowsecurity FROM pg_class WHERE relname = $1`, [
    tableName,
  ])
  return result.rows[0]?.relrowsecurity === true
}

// =============================================================================
// Permission Test Assertion Helpers
// =============================================================================

/**
 * Assert that a query succeeds with expected results
 * Useful for testing permission grants
 *
 * @example
 * ```ts
 * // Test that admin can see salary field
 * await expectQueryToSucceed(
 *   executeQuery,
 *   { dbRole: 'admin_user', userRole: 'admin' },
 *   'SELECT * FROM employees',
 *   { requiredFields: ['name', 'salary'], exactRows: 1 }
 * )
 * ```
 */
export async function expectQueryToSucceed(
  executeQuery: ExecuteQueryFn,
  context: RoleContext,
  sql: string,
  options: QuerySuccessOptions = {}
): Promise<{ rows: any[]; rowCount: number }> {
  const result = await executeQueryAsRole(executeQuery, context, sql)

  // Row count assertions
  if (options.exactRows !== undefined) {
    if (result.rows.length !== options.exactRows) {
      throw new Error(`Expected exactly ${options.exactRows} rows, got ${result.rows.length}`)
    }
  }
  if (options.minRows !== undefined && result.rows.length < options.minRows) {
    throw new Error(`Expected at least ${options.minRows} rows, got ${result.rows.length}`)
  }
  if (options.maxRows !== undefined && result.rows.length > options.maxRows) {
    throw new Error(`Expected at most ${options.maxRows} rows, got ${result.rows.length}`)
  }

  // Field presence assertions (for first row if any)
  if (result.rows.length > 0) {
    const firstRow = result.rows[0]

    if (options.requiredFields) {
      for (const field of options.requiredFields) {
        if (!(field in firstRow)) {
          throw new Error(`Expected field '${field}' to be present in result`)
        }
      }
    }

    if (options.forbiddenFields) {
      for (const field of options.forbiddenFields) {
        if (field in firstRow) {
          throw new Error(`Expected field '${field}' to be absent from result (permission denied)`)
        }
      }
    }
  }

  return result
}

/**
 * Assert that a query fails with an RLS policy violation
 * Useful for testing permission denials
 *
 * @example
 * ```ts
 * // Test that member cannot insert
 * await expectQueryToFailWithRls(
 *   executeQuery,
 *   { dbRole: 'member_user', userRole: 'member' },
 *   "INSERT INTO documents (title) VALUES ('test')"
 * )
 * ```
 */
export async function expectQueryToFailWithRls(
  executeQuery: ExecuteQueryFn,
  context: RoleContext,
  sql: string,
  expectedErrorPattern?: RegExp
): Promise<void> {
  try {
    await executeQueryAsRole(executeQuery, context, sql)
    throw new Error('Expected query to fail with RLS violation, but it succeeded')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // Check for RLS-related error messages
    const rlsPatterns = [
      /new row violates row-level security policy/i,
      /permission denied/i,
      /violates row-level security/i,
    ]

    const isRlsError = rlsPatterns.some((p) => p.test(message))

    if (!isRlsError && !message.includes('Expected query to fail')) {
      throw new Error(`Query failed but not with RLS error: ${message}`)
    }

    if (expectedErrorPattern && !expectedErrorPattern.test(message)) {
      throw new Error(`RLS error message did not match expected pattern: ${message}`)
    }
  }
}

/**
 * Assert that a query returns zero rows (RLS filtering without error)
 * Useful for SELECT/UPDATE queries where RLS silently filters results
 *
 * @example
 * ```ts
 * // Test that member sees no confidential records
 * await expectQueryToReturnZeroRows(
 *   executeQuery,
 *   { dbRole: 'member_user', userRole: 'member' },
 *   'SELECT * FROM confidential_data'
 * )
 * ```
 */
export async function expectQueryToReturnZeroRows(
  executeQuery: ExecuteQueryFn,
  context: RoleContext,
  sql: string
): Promise<void> {
  const result = await executeQueryAsRole(executeQuery, context, sql)

  if (result.rows.length !== 0) {
    throw new Error(`Expected query to return 0 rows (RLS filter), got ${result.rows.length}`)
  }
}

// =============================================================================
// Multi-Org Test Utilities
// =============================================================================

/**
 * Verify that a record exists in the database
 *
 * @example
 * ```ts
 * // Check if record exists
 * const exists = await verifyRecordExists(
 *   executeQuery,
 *   'employees',
 *   { id: 1, organization_id: 'org_123' }
 * )
 * expect(exists).toBe(true)
 * ```
 */
export async function verifyRecordExists(
  executeQuery: ExecuteQueryFn,
  table: string,
  conditions: Record<string, unknown>
): Promise<boolean> {
  const keys = Object.keys(conditions)
  const whereClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(' AND ')
  const values = keys.map((key) => conditions[key])

  const result = await executeQuery(
    `SELECT COUNT(*) as count FROM "${table}" WHERE ${whereClause}`,
    values
  )
  return result.rows[0]?.count > 0
}

/**
 * Verify that a record does NOT exist in the database
 *
 * @example
 * ```ts
 * // Check if record was deleted
 * const notExists = await verifyRecordNotExists(
 *   executeQuery,
 *   'employees',
 *   { id: 1 }
 * )
 * expect(notExists).toBe(true)
 * ```
 */
export async function verifyRecordNotExists(
  executeQuery: ExecuteQueryFn,
  table: string,
  conditions: Record<string, unknown>
): Promise<boolean> {
  const exists = await verifyRecordExists(executeQuery, table, conditions)
  return !exists
}

/**
 * Create a test scenario with records in multiple organizations
 * Useful for testing organization isolation and cross-org access prevention
 *
 * @example
 * ```ts
 * // Create records in two organizations
 * const { userOrgRecordIds, otherOrgRecordIds } = await createMultiOrgScenario(
 *   executeQuery,
 *   {
 *     table: 'employees',
 *     organizationIdField: 'organization_id',
 *     userOrgId: 'org_123',
 *     otherOrgId: 'org_456',
 *     userOrgRecords: [
 *       { name: 'Alice', email: 'alice@example.com' },
 *       { name: 'Bob', email: 'bob@example.com' },
 *     ],
 *     otherOrgRecords: [
 *       { name: 'Charlie', email: 'charlie@example.com' },
 *     ],
 *   }
 * )
 *
 * // userOrgRecordIds = [1, 2] (IDs of Alice and Bob)
 * // otherOrgRecordIds = [3] (ID of Charlie)
 * ```
 */
export async function createMultiOrgScenario(
  executeQuery: ExecuteQueryFn,
  options: {
    table: string
    organizationIdField?: string
    userOrgId: string
    otherOrgId: string
    userOrgRecords: Record<string, unknown>[]
    otherOrgRecords: Record<string, unknown>[]
  }
): Promise<MultiOrgScenarioResult> {
  const {
    table,
    organizationIdField = 'organization_id',
    userOrgId,
    otherOrgId,
    userOrgRecords,
    otherOrgRecords,
  } = options

  const userOrgRecordIds: number[] = []
  const otherOrgRecordIds: number[] = []

  // Insert user org records
  for (const record of userOrgRecords) {
    const recordWithOrg = { ...record, [organizationIdField]: userOrgId }
    const keys = Object.keys(recordWithOrg)
    const columns = keys.map((k) => `"${k}"`).join(', ')
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
    const values = keys.map((k) => recordWithOrg[k])

    const result = await executeQuery(
      `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING id`,
      values
    )
    if (result.rows[0]?.id) {
      userOrgRecordIds.push(result.rows[0].id)
    }
  }

  // Insert other org records
  for (const record of otherOrgRecords) {
    const recordWithOrg = { ...record, [organizationIdField]: otherOrgId }
    const keys = Object.keys(recordWithOrg)
    const columns = keys.map((k) => `"${k}"`).join(', ')
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
    const values = keys.map((k) => recordWithOrg[k])

    const result = await executeQuery(
      `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING id`,
      values
    )
    if (result.rows[0]?.id) {
      otherOrgRecordIds.push(result.rows[0].id)
    }
  }

  return { userOrgRecordIds, otherOrgRecordIds }
}

// Re-export types from types.ts for convenience
export type {
  RoleContext,
  ExecuteQueryFn,
  RlsPolicyInfo,
  QuerySuccessOptions,
  MultiOrgScenarioResult,
} from './types'
