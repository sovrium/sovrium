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

  test.fixme(
    'MIGRATION-CHECKSUM-001: should save SHA-256 checksum to _sovrium_schema_checksum table when runtime migration executes for first time',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table schema configuration with no previous checksum
      await executeQuery([
        `CREATE TABLE IF NOT EXISTS _sovrium_schema_checksum (
          id VARCHAR(50) PRIMARY KEY,
          checksum VARCHAR(64) NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
      ])

      // WHEN: runtime migration executes for first time
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'email', type: 'email' },
            ],
          },
        ],
      })

      // THEN: PostgreSQL saves SHA-256 checksum to _sovrium_schema_checksum table

      // Checksum table exists
      const tableCheck = await executeQuery(
        `SELECT table_name FROM information_schema.tables WHERE table_name = '_sovrium_schema_checksum'`
      )
      // THEN: assertion
      expect(tableCheck.table_name).toBe('_sovrium_schema_checksum')

      // Checksum saved as singleton row
      const singletonCheck = await executeQuery(
        `SELECT id, LENGTH(checksum) as checksum_length FROM _sovrium_schema_checksum WHERE id = 'singleton'`
      )
      // THEN: assertion
      expect(singletonCheck.id).toBe('singleton')
      expect(singletonCheck.checksum_length).toBe(64)

      // Checksum is SHA-256 hex (64 characters)
      const validSha256 = await executeQuery(
        `SELECT checksum ~ '^[0-9a-f]{64}$' as valid_sha256 FROM _sovrium_schema_checksum WHERE id = 'singleton'`
      )
      // THEN: assertion
      expect(validSha256.valid_sha256).toBe(true)
    }
  )

  test.fixme(
    'MIGRATION-CHECKSUM-002: should skip migration and complete startup in <100ms when table schema unchanged from previous run',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table schema unchanged from previous run (checksum matches)
      await executeQuery([
        `CREATE TABLE IF NOT EXISTS _sovrium_schema_checksum (
          id VARCHAR(50) PRIMARY KEY,
          checksum VARCHAR(64) NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        `INSERT INTO _sovrium_schema_checksum (id, checksum)
         VALUES ('singleton', 'abc123previoushash0000000000000000000000000000000000000000000000')`,
      ])

      // WHEN: runtime migration compares current hash with saved checksum
      const startTime = Date.now()
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'email', type: 'email' },
            ],
          },
        ],
      })
      const endTime = Date.now()
      const executionTime = endTime - startTime

      // THEN: Migration skipped, startup completes in <100ms

      // Performance check: startup < 100ms (when migrations skipped)
      // Note: This assertion validates the optimization goal
      // THEN: assertion
      expect(executionTime).toBeLessThan(100)

      // Verify checksum comparison logic
      const savedChecksum = await executeQuery(
        `SELECT checksum FROM _sovrium_schema_checksum WHERE id = 'singleton'`
      )
      // Checksum should remain unchanged if schema matches
      // THEN: assertion
      expect(savedChecksum.checksum).toBe(
        'abc123previoushash0000000000000000000000000000000000000000000000'
      )
    }
  )

  test.fixme(
    'MIGRATION-CHECKSUM-003: should execute full migration and save new checksum when table schema modified',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table schema modified (new field added)
      await executeQuery([
        `CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255))`,
        `CREATE TABLE IF NOT EXISTS _sovrium_schema_checksum (
          id VARCHAR(50) PRIMARY KEY,
          checksum VARCHAR(64) NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        `INSERT INTO _sovrium_schema_checksum (id, checksum)
         VALUES ('singleton', 'oldchecksumbeforechange00000000000000000000000000000000000000000')`,
      ])

      // WHEN: checksum differs from previous run
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
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
      const checksumUpdated = await executeQuery(
        `SELECT checksum != 'oldchecksumbeforechange00000000000000000000000000000000000000000' as checksum_updated
         FROM _sovrium_schema_checksum WHERE id = 'singleton'`
      )
      // THEN: assertion
      expect(checksumUpdated.checksum_updated).toBe(true)

      // Updated timestamp reflects migration
      const timestampCheck = await executeQuery(
        `SELECT updated_at > (NOW() - INTERVAL '5 seconds') as recently_updated
         FROM _sovrium_schema_checksum WHERE id = 'singleton'`
      )
      // THEN: assertion
      expect(timestampCheck.recently_updated).toBe(true)
    }
  )

  test.fixme(
    'MIGRATION-CHECKSUM-004: should change checksum and trigger re-migration when minor schema change occurs',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: checksum computation includes all schema properties (fields, types, constraints, indexes)
      await executeQuery([
        `CREATE TABLE products (id SERIAL PRIMARY KEY, sku VARCHAR(100))`,
        `CREATE TABLE IF NOT EXISTS _sovrium_schema_checksum (
          id VARCHAR(50) PRIMARY KEY,
          checksum VARCHAR(64) NOT NULL
        )`,
        `INSERT INTO _sovrium_schema_checksum (id, checksum)
         VALUES ('singleton', 'checksumwithoutindex000000000000000000000000000000000000000000')`,
      ])

      // WHEN: minor schema change (e.g., index added) occurs
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'sku', type: 'single-line-text' },
            ],
          },
        ],
      })

      // THEN: Checksum changes and triggers re-migration

      // Verify index was created
      const indexCheck = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'products' AND indexname LIKE '%sku%'`
      )
      // THEN: assertion
      expect(indexCheck.indexname).toContain('sku')

      // New checksum saved with index included
      const checksumUpdated = await executeQuery(
        `SELECT checksum != 'checksumwithoutindex000000000000000000000000000000000000000000' as updated
         FROM _sovrium_schema_checksum WHERE id = 'singleton'`
      )
      // THEN: assertion
      expect(checksumUpdated.updated).toBe(true)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'MIGRATION-CHECKSUM-005: user can complete full checksum-optimization workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative checksum system
      await executeQuery([
        `CREATE TABLE IF NOT EXISTS _sovrium_schema_checksum (
          id VARCHAR(50) PRIMARY KEY,
          checksum VARCHAR(64) NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
      ])

      // WHEN/THEN: Streamlined workflow testing integration points

      // First run: Create initial checksum
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'value', type: 'single-line-text' },
            ],
          },
        ],
      })

      // Verify checksum created
      const initialChecksum = await executeQuery(
        `SELECT checksum FROM _sovrium_schema_checksum WHERE id = 'singleton'`
      )
      // THEN: assertion
      expect(initialChecksum.checksum).toMatch(/^[0-9a-f]{64}$/)

      // Second run with same schema: Skip migrations (fast startup)
      const startTime = Date.now()
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'value', type: 'single-line-text' },
            ],
          },
        ],
      })
      const executionTime = Date.now() - startTime

      // Performance: Startup < 100ms when unchanged
      // THEN: assertion
      expect(executionTime).toBeLessThan(100)

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
