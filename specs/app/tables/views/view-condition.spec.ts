/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Filter Condition
 *
 * Source: specs/app/tables/views/view/filters/condition/condition.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Filter Condition', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-TABLES-VIEW-CONDITION-001: should pass only records with exact field value match when a condition has equals operator and matching value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a condition with equals operator and matching value
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'status', type: 'single-line-text' },
              { id: 3, name: 'name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'active_users',
                name: 'Active Users',
                filters: {
                  and: [{ field: 'status', operator: 'equals', value: 'active' }],
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO users (name, status) VALUES ('Alice', 'active'), ('Bob', 'inactive'), ('Charlie', 'active')",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: only records with exact field value match are included

      // View returns only records where status equals 'active'
      const viewRecords = await executeQuery('SELECT name, status FROM active_users ORDER BY id')
      // THEN: assertion
      expect(viewRecords).toHaveLength(2)
      expect(viewRecords).toEqual([
        { name: 'Alice', status: 'active' },
        { name: 'Charlie', status: 'active' },
      ])
    }
  )

  test.fixme(
    'APP-TABLES-VIEW-CONDITION-002: should pass records with substring match when a condition has contains operator on text field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a condition with contains operator on text field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'test_products',
                name: 'Test Products',
                filters: {
                  and: [{ field: 'name', operator: 'contains', value: 'test' }],
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO products (name) VALUES ('test product'), ('production item'), ('another test')",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: records with substring match are included

      // View returns records where name contains 'test'
      const viewRecords = await executeQuery('SELECT name FROM test_products ORDER BY id')
      // THEN: assertion
      expect(viewRecords).toHaveLength(2)
      expect(viewRecords).toEqual([{ name: 'test product' }, { name: 'another test' }])
    }
  )

  test.fixme(
    'APP-TABLES-VIEW-CONDITION-003: should pass only records with field value greater than specified value when a condition has greaterThan operator on numeric field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a condition with greaterThan operator on numeric field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'age', type: 'integer' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'adults',
                name: 'Adults',
                filters: {
                  and: [{ field: 'age', operator: 'greaterThan', value: 18 }],
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO employees (name, age) VALUES ('Alice', 25), ('Bob', 17), ('Charlie', 30), ('Diana', 16)",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: only records with age greater than 18 are included

      // View returns records where age > 18
      const viewRecords = await executeQuery('SELECT name, age FROM adults ORDER BY id')
      // THEN: assertion
      expect(viewRecords).toHaveLength(2)
      expect(viewRecords).toEqual([
        { name: 'Alice', age: 25 },
        { name: 'Charlie', age: 30 },
      ])
    }
  )

  test.fixme(
    'APP-TABLES-VIEW-CONDITION-004: should pass only records where field is null or empty when a condition has isEmpty operator',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a condition with isEmpty operator
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'contacts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'no_email',
                name: 'No Email',
                filters: {
                  and: [{ field: 'email', operator: 'isEmpty', value: null }],
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO contacts (name, email) VALUES ('Alice', 'alice@example.com'), ('Bob', NULL), ('Charlie', ''), ('Diana', 'diana@example.com')",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: only records where email is null or empty are included

      // View returns records where email is empty
      const viewRecords = await executeQuery('SELECT name, email FROM no_email ORDER BY id')
      // THEN: assertion
      expect(viewRecords).toHaveLength(2)
      expect(viewRecords[0].name).toBe('Bob')
      expect(viewRecords[1].name).toBe('Charlie')
    }
  )

  test.fixme(
    'APP-TABLES-VIEW-CONDITION-005: should pass records where field matches any value in the array when a condition has in operator and array of values',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a condition with in operator and array of values
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'category', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'tech_items',
                name: 'Tech Items',
                filters: {
                  and: [
                    {
                      field: 'category',
                      operator: 'in',
                      value: ['electronics', 'computers', 'phones'],
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO items (name, category) VALUES ('Laptop', 'computers'), ('Chair', 'furniture'), ('Phone', 'phones'), ('Desk', 'furniture'), ('Tablet', 'electronics')",
      ])

      // WHEN: querying the PostgreSQL VIEW
      // THEN: records where category matches any value in array are included

      // View returns records where category is in ['electronics', 'computers', 'phones']
      const viewRecords = await executeQuery('SELECT name, category FROM tech_items ORDER BY id')
      // THEN: assertion
      expect(viewRecords).toHaveLength(3)
      expect(viewRecords).toEqual([
        { name: 'Laptop', category: 'computers' },
        { name: 'Phone', category: 'phones' },
        { name: 'Tablet', category: 'electronics' },
      ])
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-VIEW-CONDITION-006: user can complete full filter-condition workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative filter conditions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'status', type: 'single-line-text' },
              { id: 3, name: 'value', type: 'integer' },
              { id: 4, name: 'category', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'filtered_view',
                name: 'Filtered View',
                filters: {
                  and: [
                    { field: 'status', operator: 'equals', value: 'active' },
                    { field: 'value', operator: 'greaterThan', value: 10 },
                    { field: 'category', operator: 'in', value: ['A', 'B'] },
                  ],
                },
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO data (status, value, category) VALUES ('active', 15, 'A'), ('active', 5, 'B'), ('inactive', 20, 'A'), ('active', 12, 'B')",
      ])

      // WHEN/THEN: Querying the PostgreSQL VIEW validates multiple condition operators

      // View returns records matching all conditions (equals, greaterThan, in)
      const viewRecords = await executeQuery(
        'SELECT status, value, category FROM filtered_view ORDER BY id'
      )
      // THEN: assertion
      expect(viewRecords).toHaveLength(2)
      expect(viewRecords).toEqual([
        { status: 'active', value: 15, category: 'A' },
        { status: 'active', value: 12, category: 'B' },
      ])
    }
  )
})
