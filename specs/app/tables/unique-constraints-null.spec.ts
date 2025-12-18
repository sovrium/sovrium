/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for NULL Handling in Unique Constraints
 *
 * Source: src/domain/models/app/table/index.ts
 * Domain: app
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (7 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - Database assertions (executeQuery fixture)
 * - PostgreSQL NULL behavior in UNIQUE constraints (NULL != NULL per SQL standard)
 * - Partial unique indexes for "at most one NULL" scenarios
 * - Application-level validation requirements for complex NULL rules
 *
 * PostgreSQL Behavior:
 * - UNIQUE constraints allow multiple NULL values (NULL != NULL)
 * - This differs from other databases (SQL Server UNIQUE allows only 1 NULL)
 * - Application-level uniqueness may require custom validation or partial indexes
 */

test.describe('NULL Handling in Unique Constraints', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'APP-TABLES-UNIQUECONSTRAINTS-NULL-001: should allow multiple NULL values in UNIQUE column per SQL standard',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with UNIQUE constraint on nullable column
      // WHEN: inserting multiple rows with NULL email
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'contacts',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'email', type: 'email', unique: true, required: false },
            ],
          },
        ],
      })

      // THEN: PostgreSQL allows all (NULL != NULL per SQL standard)

      await executeQuery(`INSERT INTO contacts (name, email) VALUES ('Alice', NULL)`)
      await executeQuery(`INSERT INTO contacts (name, email) VALUES ('Bob', NULL)`)
      await executeQuery(`INSERT INTO contacts (name, email) VALUES ('Charlie', NULL)`)

      // All three records inserted successfully
      const nullCount = await executeQuery(
        `SELECT COUNT(*) as count FROM contacts WHERE email IS NULL`
      )
      // THEN: assertion
      expect(nullCount.rows[0]).toMatchObject({ count: 3 })

      // Duplicate non-NULL email still rejected
      await executeQuery(`INSERT INTO contacts (name, email) VALUES ('Dave', 'dave@example.com')`)
      await expect(
        executeQuery(`INSERT INTO contacts (name, email) VALUES ('Eve', 'dave@example.com')`)
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )

  test(
    'APP-TABLES-UNIQUECONSTRAINTS-NULL-002: should allow multiple NULL combinations in composite UNIQUE constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: composite UNIQUE constraint on (email, tenant_id)
      // WHEN: inserting rows with NULL in composite key
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'tenant_id', type: 'integer', required: false },
              { id: 2, name: 'email', type: 'email', required: false },
            ],
            uniqueConstraints: [
              {
                name: 'uq_users_tenant_email',
                fields: ['tenant_id', 'email'],
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL allows multiple NULL combinations

      // Both columns NULL (allowed multiple times)
      await executeQuery(`INSERT INTO users (tenant_id, email) VALUES (NULL, NULL)`)
      await executeQuery(`INSERT INTO users (tenant_id, email) VALUES (NULL, NULL)`)

      // One column NULL (allowed multiple times)
      await executeQuery(`INSERT INTO users (tenant_id, email) VALUES (1, NULL)`)
      await executeQuery(`INSERT INTO users (tenant_id, email) VALUES (1, NULL)`)

      // Verify all inserted
      const totalCount = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      // THEN: assertion
      expect(totalCount.rows[0]).toMatchObject({ count: 4 })

      // Non-NULL combination still enforces uniqueness
      await executeQuery(`INSERT INTO users (tenant_id, email) VALUES (1, 'test@example.com')`)
      await expect(
        executeQuery(`INSERT INTO users (tenant_id, email) VALUES (1, 'test@example.com')`)
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )

  test.fixme(
    'APP-TABLES-UNIQUECONSTRAINTS-NULL-003: should enforce unique non-NULL values while allowing multiple NULLs',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: optional phone field with UNIQUE constraint
      // WHEN: mixing NULL and non-NULL values
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'profiles',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'phone', type: 'phone-number', unique: true, required: false },
            ],
          },
        ],
      })

      // THEN: PostgreSQL enforces uniqueness for non-NULL, allows multiple NULLs

      await executeQuery(`INSERT INTO profiles (name, phone) VALUES ('Alice', '+1-555-0001')`)
      await executeQuery(`INSERT INTO profiles (name, phone) VALUES ('Bob', NULL)`)
      await executeQuery(`INSERT INTO profiles (name, phone) VALUES ('Charlie', NULL)`)
      await executeQuery(`INSERT INTO profiles (name, phone) VALUES ('Dave', '+1-555-0002')`)

      // Duplicate non-NULL phone rejected
      await expect(
        executeQuery(`INSERT INTO profiles (name, phone) VALUES ('Eve', '+1-555-0001')`)
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      // Additional NULL phone allowed
      const insertNull = await executeQuery(
        `INSERT INTO profiles (name, phone) VALUES ('Eve', NULL) RETURNING id`
      )
      // THEN: assertion
      expect(insertNull.rows[0]).toMatchObject({ id: 5 })
    }
  )

  test.fixme(
    'APP-TABLES-UNIQUECONSTRAINTS-NULL-004: should document required+unique differs from optional+unique behavior',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: two tables - one with required unique, one with optional unique
      // WHEN: attempting to insert NULL values
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'required_unique',
            fields: [{ id: 1, name: 'email', type: 'email', unique: true, required: true }],
          },
          {
            id: 2,
            name: 'optional_unique',
            fields: [{ id: 1, name: 'email', type: 'email', unique: true, required: false }],
          },
        ],
      })

      // THEN: required unique field enforces NOT NULL + UNIQUE

      // NULL values rejected in required+unique field
      await expect(
        executeQuery(`INSERT INTO required_unique (email) VALUES (NULL)`)
      ).rejects.toThrow(/violates not-null constraint/)

      await executeQuery(`INSERT INTO required_unique (email) VALUES ('test@example.com')`)
      await expect(
        executeQuery(`INSERT INTO required_unique (email) VALUES ('test@example.com')`)
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      // THEN: optional unique field allows NULL (multiple times)

      await executeQuery(`INSERT INTO optional_unique (email) VALUES (NULL)`)
      await executeQuery(`INSERT INTO optional_unique (email) VALUES (NULL)`)

      const nullCount = await executeQuery(
        `SELECT COUNT(*) as count FROM optional_unique WHERE email IS NULL`
      )
      // THEN: assertion
      expect(nullCount.rows[0]).toMatchObject({ count: '2' })
    }
  )

  test.fixme(
    'APP-TABLES-UNIQUECONSTRAINTS-NULL-005: should use partial unique index to enforce uniqueness only on non-NULL values',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table requiring uniqueness only among non-NULL values
      // NOTE: This requires a partial unique index - standard UNIQUE allows multiple NULLs
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'accounts',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'username', type: 'single-line-text', required: false },
            ],
            indexes: [
              {
                name: 'idx_accounts_username_unique',
                fields: ['username'],
                unique: true,
                // @ts-expect-error - Future feature: partial unique indexes with WHERE clause
                where: 'username IS NOT NULL', // Partial index excludes NULLs
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL allows multiple NULLs (partial index doesn't apply to NULL)

      await executeQuery(`INSERT INTO accounts (name, username) VALUES ('Alice', NULL)`)
      await executeQuery(`INSERT INTO accounts (name, username) VALUES ('Bob', NULL)`)
      await executeQuery(`INSERT INTO accounts (name, username) VALUES ('Charlie', NULL)`)

      const nullCount = await executeQuery(
        `SELECT COUNT(*) as count FROM accounts WHERE username IS NULL`
      )
      // THEN: assertion
      expect(nullCount.rows[0]).toMatchObject({ count: '3' })

      // Non-NULL usernames still unique
      await executeQuery(`INSERT INTO accounts (name, username) VALUES ('Dave', 'alice')`)
      await expect(
        executeQuery(`INSERT INTO accounts (name, username) VALUES ('Eve', 'alice')`)
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )

  test.fixme(
    'APP-TABLES-UNIQUECONSTRAINTS-NULL-006: should demonstrate PostgreSQL behavior when NULL used as distinct value in global settings',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table requiring NULL-aware uniqueness (treat NULL as distinct value)
      // NOTE: PostgreSQL default allows multiple (NULL, key) combinations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'settings',
            fields: [
              { id: 1, name: 'user_id', type: 'integer', required: false },
              { id: 2, name: 'key', type: 'single-line-text', required: true },
              { id: 3, name: 'value', type: 'single-line-text' },
            ],
            uniqueConstraints: [
              {
                name: 'uq_settings_user_key',
                fields: ['user_id', 'key'],
                // Application-level enforcement may be needed for "only one global setting per key"
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL default behavior allows multiple (NULL, key) combinations

      await executeQuery(
        `INSERT INTO settings (user_id, key, value) VALUES (NULL, 'theme', 'dark')`
      )

      // This inserts successfully (PostgreSQL allows multiple NULL user_id)
      await executeQuery(
        `INSERT INTO settings (user_id, key, value) VALUES (NULL, 'theme', 'light')`
      )

      // Verify both inserted (may be undesired - should only allow one global 'theme')
      const globalSettings = await executeQuery(
        `SELECT COUNT(*) as count FROM settings WHERE user_id IS NULL AND key = 'theme'`
      )
      // THEN: assertion - documents PostgreSQL behavior
      expect(globalSettings.rows[0]).toMatchObject({ count: '2' })

      // NOTE: Application should validate "only one global setting per key" before INSERT
      // Or use partial unique index: UNIQUE (key) WHERE user_id IS NULL
    }
  )

  test.fixme(
    'APP-TABLES-UNIQUECONSTRAINTS-NULL-007: should combine UNIQUE and CHECK constraints for conditional NULL rules',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with "email required if is_active = true"
      // WHEN: inactive member without email (allowed), active member without email (rejected)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'members',
            fields: [
              { id: 1, name: 'name', type: 'single-line-text', required: true },
              { id: 2, name: 'email', type: 'email', unique: true, required: false },
              { id: 3, name: 'is_active', type: 'checkbox', default: false },
            ],
            // @ts-expect-error - Future feature: CHECK constraints
            constraints: [
              {
                name: 'chk_active_members_have_email',
                check: '(is_active = false) OR (email IS NOT NULL)',
              },
            ],
          },
        ],
      })

      // THEN: inactive member without email (allowed)
      await executeQuery(
        `INSERT INTO members (name, email, is_active) VALUES ('Alice', NULL, false)`
      )

      // THEN: active member without email (rejected by CHECK constraint)
      await expect(
        executeQuery(`INSERT INTO members (name, email, is_active) VALUES ('Bob', NULL, true)`)
      ).rejects.toThrow(/violates check constraint/)

      // THEN: active member with email (allowed)
      await executeQuery(
        `INSERT INTO members (name, email, is_active) VALUES ('Charlie', 'charlie@example.com', true)`
      )

      // Unique constraint still enforced for non-NULL emails
      await expect(
        executeQuery(
          `INSERT INTO members (name, email, is_active) VALUES ('Dave', 'charlie@example.com', true)`
        )
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration workflow
  // ============================================================================

  test.fixme(
    'APP-TABLES-UNIQUECONSTRAINTS-NULL-008: user can complete full NULL-in-unique-constraints workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Create table with optional unique field', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'contacts',
              fields: [
                { id: 1, name: 'name', type: 'single-line-text', required: true },
                { id: 2, name: 'email', type: 'email', unique: true, required: false },
              ],
            },
          ],
        })
      })

      await test.step('Verify multiple NULL values allowed per SQL standard', async () => {
        await executeQuery(`INSERT INTO contacts (name, email) VALUES ('Alice', NULL)`)
        await executeQuery(`INSERT INTO contacts (name, email) VALUES ('Bob', NULL)`)
        const nullCount = await executeQuery(
          `SELECT COUNT(*) as count FROM contacts WHERE email IS NULL`
        )
        expect(nullCount.rows[0]).toMatchObject({ count: '2' })
      })

      await test.step('Verify non-NULL uniqueness still enforced', async () => {
        await executeQuery(
          `INSERT INTO contacts (name, email) VALUES ('Charlie', 'charlie@example.com')`
        )
        await expect(
          executeQuery(`INSERT INTO contacts (name, email) VALUES ('Dave', 'charlie@example.com')`)
        ).rejects.toThrow(/unique constraint/)
      })

      await test.step('Verify NULL and non-NULL coexist correctly', async () => {
        // Additional NULL still allowed
        await executeQuery(`INSERT INTO contacts (name, email) VALUES ('Eve', NULL)`)

        // Final count: 3 NULLs, 1 non-NULL
        const totalCount = await executeQuery(`SELECT COUNT(*) as count FROM contacts`)
        expect(totalCount.rows[0]).toMatchObject({ count: '4' })

        const nonNullCount = await executeQuery(
          `SELECT COUNT(*) as count FROM contacts WHERE email IS NOT NULL`
        )
        expect(nonNullCount.rows[0]).toMatchObject({ count: '1' })
      })
    }
  )
})
