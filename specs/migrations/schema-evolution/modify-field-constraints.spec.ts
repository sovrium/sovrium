/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Modify Field Constraints Migration
 *
 * Source: specs/migrations/schema-evolution/modify-field-constraints/modify-field-constraints.json
 * Domain: migrations
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Modify Field Constraints Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'MIGRATION-MODIFY-CONSTRAINTS-001: should alter table add constraint check with range validation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with price field (NUMERIC), no constraints
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'price', type: 'decimal', required: true },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO products (name, price) VALUES ('Widget', 50.00), ('Gadget', 150.00)`,
      ])

      // WHEN: min/max constraint added (price >= 0 AND price <= 10000)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              {
                id: 3,
                name: 'price',
                type: 'decimal',
                required: true,
                min: 0,
                max: 10_000,
              },
            ],
          },
        ],
      })

      // THEN: ALTER TABLE ADD CONSTRAINT CHECK with range validation

      // Valid values within range are accepted
      const validInsert = await executeQuery(
        `INSERT INTO products (name, price) VALUES ('Test Product', 500.00) RETURNING price`
      )
      expect(parseFloat(validInsert.price)).toBe(500)

      // Value below minimum rejected
      await expect(async () => {
        await executeQuery(`INSERT INTO products (name, price) VALUES ('Negative Price', -10.00)`)
      }).rejects.toThrow(/violates check constraint/i)

      // Value above maximum rejected
      await expect(async () => {
        await executeQuery(`INSERT INTO products (name, price) VALUES ('Too Expensive', 15000.00)`)
      }).rejects.toThrow(/violates check constraint/i)
    }
  )

  test(
    'MIGRATION-MODIFY-CONSTRAINTS-002: should drop old check constraint, add new check with updated max',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'inventory' with quantity field, existing constraint (quantity >= 0 AND quantity <= 100)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'inventory',
            fields: [
              { id: 2, name: 'item', type: 'single-line-text', required: true },
              {
                id: 3,
                name: 'quantity',
                type: 'integer',
                required: true,
                min: 0,
                max: 100,
              },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO inventory (item, quantity) VALUES ('Screws', 50), ('Bolts', 75)`,
      ])

      // WHEN: max constraint increased from 100 to 1000
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'inventory',
            fields: [
              { id: 2, name: 'item', type: 'single-line-text', required: true },
              {
                id: 3,
                name: 'quantity',
                type: 'integer',
                required: true,
                min: 0,
                max: 1000,
              },
            ],
          },
        ],
      })

      // THEN: DROP old CHECK constraint, ADD new CHECK with updated max

      // Value above old max (100) but below new max (1000) now accepted
      const validInsert = await executeQuery(
        `INSERT INTO inventory (item, quantity) VALUES ('Nails', 500) RETURNING quantity`
      )
      expect(validInsert.quantity).toBe(500)

      // Value at new max boundary accepted
      const maxInsert = await executeQuery(
        `INSERT INTO inventory (item, quantity) VALUES ('Washers', 1000) RETURNING quantity`
      )
      expect(maxInsert.quantity).toBe(1000)

      // Value above new max rejected
      await expect(async () => {
        await executeQuery(`INSERT INTO inventory (item, quantity) VALUES ('Excess', 1500)`)
      }).rejects.toThrow(/violates check constraint/i)
    }
  )

  test(
    'MIGRATION-MODIFY-CONSTRAINTS-003: should migration fails due to invalid existing data (negative age)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with age field (INTEGER), no constraint, existing rows with age = -5
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'users',
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'age', type: 'integer' },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO users (name, age) VALUES ('Valid User', 25), ('Invalid User', -5)`,
      ])

      // WHEN: min constraint added (age >= 0)
      // THEN: Migration fails due to invalid existing data (negative age)
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 3,
              name: 'users',
              fields: [
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'age', type: 'integer', min: 0 },
              ],
            },
          ],
        })
      }).rejects.toThrow(/violates check constraint|invalid existing data/i)

      // Existing invalid data remains unchanged (migration rolled back)
      const invalidUser = await executeQuery(`SELECT age FROM users WHERE name = 'Invalid User'`)
      expect(invalidUser.age).toBe(-5)
    }
  )

  test(
    'MIGRATION-MODIFY-CONSTRAINTS-004: should alter table drop constraint removes validation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' with discount field, existing constraint (discount >= 0 AND discount <= 100)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'orders',
            fields: [
              {
                id: 2,
                name: 'order_number',
                type: 'single-line-text',
                required: true,
              },
              {
                id: 3,
                name: 'discount',
                type: 'integer',
                required: true,
                min: 0,
                max: 100,
              },
            ],
          },
        ],
      })
      await executeQuery([
        `INSERT INTO orders (order_number, discount) VALUES ('ORD-001', 10), ('ORD-002', 50)`,
      ])

      // WHEN: constraint removed from schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'orders',
            fields: [
              {
                id: 2,
                name: 'order_number',
                type: 'single-line-text',
                required: true,
              },
              { id: 3, name: 'discount', type: 'integer', required: true }, // No min/max constraints
            ],
          },
        ],
      })

      // THEN: ALTER TABLE DROP CONSTRAINT removes validation

      // Value above old max (100) now accepted
      const aboveOldMax = await executeQuery(
        `INSERT INTO orders (order_number, discount) VALUES ('ORD-003', 150) RETURNING discount`
      )
      expect(aboveOldMax.discount).toBe(150)

      // Negative value now accepted (was previously >= 0)
      const negativeValue = await executeQuery(
        `INSERT INTO orders (order_number, discount) VALUES ('ORD-004', -25) RETURNING discount`
      )
      expect(negativeValue.discount).toBe(-25)
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 4 @spec tests - covers: add constraint, update constraint, migration failure, drop constraint
  // ============================================================================

  test(
    'MIGRATION-MODIFY-CONSTRAINTS-REGRESSION: user can complete full modify-field-constraints workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('MIGRATION-MODIFY-CONSTRAINTS-001: adds check constraint with range validation', async () => {
        // Setup: table 'products' with price field, no constraints
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'products',
              fields: [
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'price', type: 'decimal', required: true },
              ],
            },
          ],
        })
        await executeQuery([
          `INSERT INTO products (name, price) VALUES ('Widget', 50.00), ('Gadget', 150.00)`,
        ])

        // Add min/max constraint
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'products',
              fields: [
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                {
                  id: 3,
                  name: 'price',
                  type: 'decimal',
                  required: true,
                  min: 0,
                  max: 10_000,
                },
              ],
            },
          ],
        })

        // Valid values accepted
        const validInsert = await executeQuery(
          `INSERT INTO products (name, price) VALUES ('Test Product', 500.00) RETURNING price`
        )
        expect(parseFloat(validInsert.price)).toBe(500)

        // Values outside range rejected
        await expect(async () => {
          await executeQuery(`INSERT INTO products (name, price) VALUES ('Negative Price', -10.00)`)
        }).rejects.toThrow(/violates check constraint/i)
      })

      await test.step('MIGRATION-MODIFY-CONSTRAINTS-002: drops old check constraint and adds new with updated max', async () => {
        // Setup: table 'inventory' with existing constraint (max 100)
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 2,
              name: 'inventory',
              fields: [
                { id: 2, name: 'item', type: 'single-line-text', required: true },
                {
                  id: 3,
                  name: 'quantity',
                  type: 'integer',
                  required: true,
                  min: 0,
                  max: 100,
                },
              ],
            },
          ],
        })
        await executeQuery([
          `INSERT INTO inventory (item, quantity) VALUES ('Screws', 50), ('Bolts', 75)`,
        ])

        // Update max constraint from 100 to 1000
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 2,
              name: 'inventory',
              fields: [
                { id: 2, name: 'item', type: 'single-line-text', required: true },
                {
                  id: 3,
                  name: 'quantity',
                  type: 'integer',
                  required: true,
                  min: 0,
                  max: 1000,
                },
              ],
            },
          ],
        })

        // Value above old max now accepted
        const validInsert = await executeQuery(
          `INSERT INTO inventory (item, quantity) VALUES ('Nails', 500) RETURNING quantity`
        )
        expect(validInsert.quantity).toBe(500)

        // Value above new max rejected
        await expect(async () => {
          await executeQuery(`INSERT INTO inventory (item, quantity) VALUES ('Excess', 1500)`)
        }).rejects.toThrow(/violates check constraint/i)
      })

      await test.step('MIGRATION-MODIFY-CONSTRAINTS-003: migration fails due to invalid existing data', async () => {
        // Setup: table 'users' with age field, no constraint, invalid data exists
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 3,
              name: 'users',
              fields: [
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'age', type: 'integer' },
              ],
            },
          ],
        })
        await executeQuery([
          `INSERT INTO users (name, age) VALUES ('Valid User', 25), ('Invalid User', -5)`,
        ])

        // Adding constraint fails due to invalid existing data
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 3,
                name: 'users',
                fields: [
                  { id: 2, name: 'name', type: 'single-line-text', required: true },
                  { id: 3, name: 'age', type: 'integer', min: 0 },
                ],
              },
            ],
          })
        }).rejects.toThrow(/violates check constraint|invalid existing data/i)

        // Invalid data remains unchanged (migration rolled back)
        const invalidUser = await executeQuery(`SELECT age FROM users WHERE name = 'Invalid User'`)
        expect(invalidUser.age).toBe(-5)
      })

      await test.step('MIGRATION-MODIFY-CONSTRAINTS-004: drops constraint and removes validation', async () => {
        // Setup: table 'orders' with existing constraint
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 4,
              name: 'orders',
              fields: [
                {
                  id: 2,
                  name: 'order_number',
                  type: 'single-line-text',
                  required: true,
                },
                {
                  id: 3,
                  name: 'discount',
                  type: 'integer',
                  required: true,
                  min: 0,
                  max: 100,
                },
              ],
            },
          ],
        })
        await executeQuery([
          `INSERT INTO orders (order_number, discount) VALUES ('ORD-001', 10), ('ORD-002', 50)`,
        ])

        // Remove constraint from schema
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 4,
              name: 'orders',
              fields: [
                {
                  id: 2,
                  name: 'order_number',
                  type: 'single-line-text',
                  required: true,
                },
                { id: 3, name: 'discount', type: 'integer', required: true },
              ],
            },
          ],
        })

        // Values outside old constraints now accepted
        const aboveOldMax = await executeQuery(
          `INSERT INTO orders (order_number, discount) VALUES ('ORD-003', 150) RETURNING discount`
        )
        expect(aboveOldMax.discount).toBe(150)

        const negativeValue = await executeQuery(
          `INSERT INTO orders (order_number, discount) VALUES ('ORD-004', -25) RETURNING discount`
        )
        expect(negativeValue.discount).toBe(-25)
      })
    }
  )
})
