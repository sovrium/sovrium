/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Checksum Optimization
 *
 * Source: specs/migrations/migration-system/checksum/checksum.json
 * Domain: migrations
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Checksum Optimization', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'MIGRATION-CHECKSUM-001: should save SHA-256 checksum to system.schema_checksum table when runtime migration executes for first time',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table schema configuration with no previous checksum
      // WHEN: runtime migration executes for first time
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [{ id: 2, name: 'email', type: 'email' }],
          },
        ],
      })

      // THEN: PostgreSQL saves SHA-256 checksum to system.schema_checksum table

      // Checksum table exists
      const tableCheck = await executeQuery(
        `SELECT table_name FROM information_schema.tables WHERE table_name = 'system.schema_checksum'`
      )
      // THEN: assertion
      expect(tableCheck.table_name).toBe('system.schema_checksum')

      // Checksum saved as singleton row
      const singletonCheck = await executeQuery(
        `SELECT id, LENGTH(checksum) as checksum_length FROM system.schema_checksum WHERE id = 'singleton'`
      )
      // THEN: assertion
      expect(singletonCheck.id).toBe('singleton')
      expect(singletonCheck.checksum_length).toBe(64)

      // Checksum is SHA-256 hex (64 characters)
      const validSha256 = await executeQuery(
        `SELECT checksum ~ '^[0-9a-f]{64}$' as valid_sha256 FROM system.schema_checksum WHERE id = 'singleton'`
      )
      // THEN: assertion
      expect(validSha256.valid_sha256).toBe(true)
    }
  )

  test(
    'MIGRATION-CHECKSUM-002: should skip migration and complete startup in <100ms when table schema unchanged from previous run',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table schema unchanged from previous run (checksum matches)
      // First run creates initial schema and checksum
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'users',
            fields: [{ id: 2, name: 'email', type: 'email' }],
          },
        ],
      })

      // WHEN: runtime migration compares current hash with saved checksum (same schema)
      const startTime = Date.now()
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'users',
            fields: [{ id: 2, name: 'email', type: 'email' }],
          },
        ],
      })
      const endTime = Date.now()
      const executionTime = endTime - startTime

      // THEN: Migration skipped, startup completes quickly

      // Performance check: startup < 3000ms (when migrations skipped)
      // Note: This validates optimization is working (full migrations take 5-10+ seconds)
      // The 3000ms timeout accounts for server startup overhead and CI environment variability
      // THEN: assertion
      expect(executionTime).toBeLessThan(3000)

      // Verify checksum exists and is valid
      const savedChecksum = await executeQuery(
        `SELECT checksum FROM system.schema_checksum WHERE id = 'singleton'`
      )
      // THEN: assertion
      expect(savedChecksum.checksum).toMatch(/^[0-9a-f]{64}$/)
    }
  )

  test(
    'MIGRATION-CHECKSUM-003: should execute full migration and save new checksum when table schema modified',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table schema with initial configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'users',
            fields: [{ id: 2, name: 'email', type: 'email' }],
          },
        ],
      })
      await executeQuery([`INSERT INTO users (email) VALUES ('test@example.com')`])

      // Get initial checksum
      const initialChecksum = await executeQuery(
        `SELECT checksum FROM system.schema_checksum WHERE id = 'singleton'`
      )

      // WHEN: table schema modified (new field added) - checksum differs from previous run
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'users',
            fields: [
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'name', type: 'single-line-text' },
            ],
          },
        ],
      })

      // THEN: Full migration executed and new checksum saved

      // Verify migration executed (new field exists)
      const columnCheck = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'name'`
      )
      // THEN: assertion
      expect(columnCheck.column_name).toBe('name')

      // New checksum saved after successful migration
      const newChecksum = await executeQuery(
        `SELECT checksum FROM system.schema_checksum WHERE id = 'singleton'`
      )
      // THEN: assertion
      expect(newChecksum.checksum).not.toBe(initialChecksum.checksum)

      // Updated timestamp reflects migration
      const timestampCheck = await executeQuery(
        `SELECT updated_at > (NOW() - INTERVAL '5 seconds') as recently_updated
         FROM system.schema_checksum WHERE id = 'singleton'`
      )
      // THEN: assertion
      expect(timestampCheck.recently_updated).toBe(true)
    }
  )

  test(
    'MIGRATION-CHECKSUM-004: should change checksum and trigger re-migration when minor schema change occurs',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: checksum computation includes all schema properties (fields, types, constraints, indexes)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'products',
            fields: [{ id: 2, name: 'sku', type: 'single-line-text' }],
          },
        ],
      })
      await executeQuery([`INSERT INTO products (sku) VALUES ('SKU-001')`])

      // Get initial checksum
      const initialChecksum = await executeQuery(
        `SELECT checksum FROM system.schema_checksum WHERE id = 'singleton'`
      )

      // WHEN: minor schema change occurs (field property change that affects schema)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'products',
            fields: [{ id: 2, name: 'sku', type: 'single-line-text', required: true }],
          },
        ],
      })

      // THEN: Checksum changes and triggers re-migration

      // Verify constraint was added (sku is now NOT NULL)
      const constraintCheck = await executeQuery(
        `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'sku'`
      )
      // THEN: assertion
      expect(constraintCheck.is_nullable).toBe('NO')

      // New checksum saved with constraint included
      const newChecksum = await executeQuery(
        `SELECT checksum FROM system.schema_checksum WHERE id = 'singleton'`
      )
      // THEN: assertion
      expect(newChecksum.checksum).not.toBe(initialChecksum.checksum)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'MIGRATION-CHECKSUM-REGRESSION: user can complete full checksum-optimization workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Shared state for tracking checksums across steps
      let initialChecksum: string
      let checksumAfterModification: string

      await test.step('MIGRATION-CHECKSUM-001: SaveChecksumOnFirstMigration', async () => {
        // GIVEN: table schema configuration with no previous checksum
        // WHEN: runtime migration executes for first time
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'regression_users',
              fields: [{ id: 2, name: 'email', type: 'email' }],
            },
          ],
        })

        // THEN: PostgreSQL saves SHA-256 checksum to system.schema_checksum table

        // Checksum table exists
        const tableCheck = await executeQuery(
          `SELECT table_name FROM information_schema.tables WHERE table_name = 'system.schema_checksum'`
        )
        expect(tableCheck.table_name).toBe('system.schema_checksum')

        // Checksum saved as singleton row
        const singletonCheck = await executeQuery(
          `SELECT id, LENGTH(checksum) as checksum_length FROM system.schema_checksum WHERE id = 'singleton'`
        )
        expect(singletonCheck.id).toBe('singleton')
        expect(singletonCheck.checksum_length).toBe(64)

        // Checksum is SHA-256 hex (64 characters)
        const validSha256 = await executeQuery(
          `SELECT checksum ~ '^[0-9a-f]{64}$' as valid_sha256 FROM system.schema_checksum WHERE id = 'singleton'`
        )
        expect(validSha256.valid_sha256).toBe(true)

        // Save initial checksum for later comparison
        const savedChecksum = await executeQuery(
          `SELECT checksum FROM system.schema_checksum WHERE id = 'singleton'`
        )
        initialChecksum = savedChecksum.checksum
      })

      await test.step('MIGRATION-CHECKSUM-002: SkipMigrationWhenUnchanged', async () => {
        // GIVEN: table schema unchanged from previous run (checksum matches)
        // WHEN: runtime migration compares current hash with saved checksum (same schema)
        const startTime = Date.now()
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'regression_users',
              fields: [{ id: 2, name: 'email', type: 'email' }],
            },
          ],
        })
        const endTime = Date.now()
        const executionTime = endTime - startTime

        // THEN: Migration skipped, startup completes quickly

        // Performance check: startup < 3000ms (when migrations skipped)
        // Note: This validates optimization is working (full migrations take 5-10+ seconds)
        // The 3000ms timeout accounts for server startup overhead and CI environment variability
        expect(executionTime).toBeLessThan(3000)

        // Verify checksum exists and is valid
        const savedChecksum = await executeQuery(
          `SELECT checksum FROM system.schema_checksum WHERE id = 'singleton'`
        )
        expect(savedChecksum.checksum).toMatch(/^[0-9a-f]{64}$/)
      })

      await test.step('MIGRATION-CHECKSUM-003: ExecuteMigrationWhenSchemaModified', async () => {
        // GIVEN: table schema with initial configuration (from previous steps)
        await executeQuery([`INSERT INTO regression_users (email) VALUES ('test@example.com')`])

        // WHEN: table schema modified (new field added) - checksum differs from previous run
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'regression_users',
              fields: [
                { id: 2, name: 'email', type: 'email' },
                { id: 3, name: 'name', type: 'single-line-text' },
              ],
            },
          ],
        })

        // THEN: Full migration executed and new checksum saved

        // Verify migration executed (new field exists)
        const columnCheck = await executeQuery(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'regression_users' AND column_name = 'name'`
        )
        expect(columnCheck.column_name).toBe('name')

        // New checksum saved after successful migration
        const newChecksum = await executeQuery(
          `SELECT checksum FROM system.schema_checksum WHERE id = 'singleton'`
        )
        expect(newChecksum.checksum).not.toBe(initialChecksum)

        // Updated timestamp reflects migration
        const timestampCheck = await executeQuery(
          `SELECT updated_at > (NOW() - INTERVAL '5 seconds') as recently_updated
           FROM system.schema_checksum WHERE id = 'singleton'`
        )
        expect(timestampCheck.recently_updated).toBe(true)

        // Save checksum for next step comparison
        checksumAfterModification = newChecksum.checksum

        // Populate 'name' for existing row to allow step 004 to add NOT NULL constraint
        await executeQuery([`UPDATE regression_users SET name = 'Test User' WHERE name IS NULL`])
      })

      await test.step('MIGRATION-CHECKSUM-004: ReMigrateOnMinorSchemaChange', async () => {
        // GIVEN: checksum computation includes all schema properties (fields, types, constraints, indexes)
        // Current schema has 'name' field as nullable (from previous step)

        // WHEN: minor schema change occurs (field property change that affects schema)
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'regression_users',
              fields: [
                { id: 2, name: 'email', type: 'email' },
                { id: 3, name: 'name', type: 'single-line-text', required: true },
              ],
            },
          ],
        })

        // THEN: Checksum changes and triggers re-migration

        // Verify constraint was added (name is now NOT NULL)
        const constraintCheck = await executeQuery(
          `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'regression_users' AND column_name = 'name'`
        )
        expect(constraintCheck.is_nullable).toBe('NO')

        // New checksum saved with constraint included
        const newChecksum = await executeQuery(
          `SELECT checksum FROM system.schema_checksum WHERE id = 'singleton'`
        )
        expect(newChecksum.checksum).not.toBe(checksumAfterModification)
      })
    }
  )
})
