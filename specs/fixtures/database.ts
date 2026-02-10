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
import type { ExecuteQueryFn } from './types'

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
    } finally {
      await adminPool.end()
    }

    // Run migrations on template
    const templateUrl = this.getTemplateUrl()
    const templatePool = new Pool({ connectionString: templateUrl })
    const db = drizzle(templatePool, { schema })

    try {
      await migrate(db, { migrationsFolder: './drizzle' })

      // Clear checksum table to ensure tests start with clean state
      // Migration audit trail tables are created by Drizzle migrations, but may have
      // residual data from previous test runs if template was reused.
      await templatePool.query(`DELETE FROM system.schema_checksum`)
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
// Record Verification Utilities
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
 *   { id: 1, name: 'John Doe' }
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

// Re-export types from types.ts for convenience
export type { ExecuteQueryFn } from './types'
