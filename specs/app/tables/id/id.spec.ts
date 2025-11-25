/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures.ts'

/**
 * E2E Tests for Table ID
 *
 * Source: specs/app/tables/id/id.schema.json
 * Domain: app
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - Configuration validation (startServerWithSchema)
 * - Database validation (executeQuery for verification)
 * - ID uniqueness and read-only constraints
 */

test.describe('Table ID', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'APP-TABLES-ID-001: should be unique within the parent collection',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a new entity is created
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_entities',
            name: 'test_entities',
            fields: [
              {
                id: 1,
                name: 'name',
                type: 'single-line-text',
                required: true,
              },
            ],
          },
        ],
      })

      // WHEN: the system assigns an ID
      const entity1 = await executeQuery(
        `INSERT INTO test_entities (name) VALUES ('Entity 1') RETURNING id`
      )
      const entity2 = await executeQuery(
        `INSERT INTO test_entities (name) VALUES ('Entity 2') RETURNING id`
      )

      // THEN: it should be unique within the parent collection
      expect(entity1.rows[0].id).not.toBe(entity2.rows[0].id)

      // Verify uniqueness constraint exists
      const primaryKey = await executeQuery(
        `SELECT constraint_type FROM information_schema.table_constraints WHERE table_name = 'test_entities' AND constraint_type = 'PRIMARY KEY'`
      )
      expect(primaryKey.rows[0]).toMatchObject({ constraint_type: 'PRIMARY KEY' })
    }
  )

  test.fixme(
    'APP-TABLES-ID-002: should prevent changes (read-only constraint)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: an entity exists
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_entities',
            name: 'test_entities',
            fields: [
              {
                id: 1,
                name: 'name',
                type: 'single-line-text',
                required: true,
              },
            ],
          },
        ],
      })

      const entity = await executeQuery(
        `INSERT INTO test_entities (name) VALUES ('Test Entity') RETURNING id`
      )
      const originalId = entity.rows[0].id

      // WHEN: attempting to modify its ID
      // THEN: the system should prevent changes (read-only constraint)

      // Primary key columns cannot be updated to NULL
      await expect(
        executeQuery(`UPDATE test_entities SET id = NULL WHERE id = ${originalId}`)
      ).rejects.toThrow()

      // Verify ID remains unchanged
      const check = await executeQuery(`SELECT id FROM test_entities WHERE id = ${originalId}`)
      expect(check.rows[0]).toMatchObject({ id: originalId })
    }
  )

  test.fixme(
    'APP-TABLES-ID-003: should retrieve entity successfully when ID is valid',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a client requests an entity by ID
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_entities',
            name: 'test_entities',
            fields: [
              {
                id: 1,
                name: 'name',
                type: 'single-line-text',
                required: true,
              },
            ],
          },
        ],
      })

      const entity = await executeQuery(
        `INSERT INTO test_entities (name) VALUES ('Test Entity') RETURNING id, name`
      )
      const entityId = entity.rows[0].id

      // WHEN: the ID is valid
      const result = await executeQuery(`SELECT * FROM test_entities WHERE id = ${entityId}`)

      // THEN: the entity should be retrieved successfully
      expect(result.rows[0]).toMatchObject({
        id: entityId,
        name: 'Test Entity',
      })
      expect(result.rows).toHaveLength(1)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'APP-TABLES-ID-REGRESSION-001: user can complete full Table ID workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Database with entities using auto-generated IDs
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              {
                id: 1,
                name: 'sku',
                type: 'single-line-text',
                required: true,
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Execute representative ID workflow

      // 1. IDs are unique and auto-generated
      const product1 = await executeQuery(
        `INSERT INTO products (sku) VALUES ('WIDGET-001') RETURNING id`
      )
      const product2 = await executeQuery(
        `INSERT INTO products (sku) VALUES ('WIDGET-002') RETURNING id`
      )
      expect(product1.rows[0].id).not.toBe(product2.rows[0].id)

      // 2. Entities can be retrieved by ID
      const retrieved = await executeQuery(
        `SELECT * FROM products WHERE id = ${product1.rows[0].id}`
      )
      expect(retrieved.rows[0]).toMatchObject({
        id: product1.rows[0].id,
        sku: 'WIDGET-001',
      })

      // 3. ID uniqueness is enforced
      const count = await executeQuery(`SELECT COUNT(DISTINCT id) as count FROM products`)
      expect(count.rows[0]).toMatchObject({ count: 2 })

      // Workflow completes successfully
    }
  )
})
