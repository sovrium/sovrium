/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for View Fields
 *
 * Source: specs/app/tables/views/view/fields/fields.schema.json
 * Domain: app
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('View Fields', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-TABLES-VIEW-001: should show only configured fields when a view has specific fields configured',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a view with specific fields configured (fields not in array are hidden)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'price', type: 'decimal' },
              { id: 4, name: 'internal_notes', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'public_view',
                name: 'Public View',
                fields: ['id', 'name', 'price'],
              },
            ],
          },
        ],
      })

      // WHEN: displaying records in the view
      await page.goto('/tables/tbl_products/views/public_view')

      // THEN: only configured fields should be shown (internal_notes excluded from array)
      await expect(page.locator('[data-field="id"]')).toBeVisible()
      await expect(page.locator('[data-field="name"]')).toBeVisible()
      await expect(page.locator('[data-field="price"]')).toBeVisible()
      await expect(page.locator('[data-field="internal_notes"]')).toBeHidden()
    }
  )

  test.fixme(
    'APP-TABLES-VIEW-002: should display fields in the specified order when a view has fields configured with custom order',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a view with fields configured with custom order
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
              { id: 4, name: 'priority', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'ordered_view',
                name: 'Ordered View',
                fields: ['priority', 'status', 'title', 'id'],
              },
            ],
          },
        ],
      })

      // WHEN: displaying records in the view
      await page.goto('/tables/tbl_tasks/views/ordered_view')

      // THEN: fields should appear in the specified order
      const columns = page.locator('[data-field]')
      await expect(columns.nth(0)).toHaveAttribute('data-field', 'priority')
      await expect(columns.nth(1)).toHaveAttribute('data-field', 'status')
      await expect(columns.nth(2)).toHaveAttribute('data-field', 'title')
      await expect(columns.nth(3)).toHaveAttribute('data-field', 'id')
    }
  )

  test.fixme(
    'APP-TABLES-VIEW-003: should not show field when it is not included in the view fields array',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a view with a field excluded from the fields array
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'username', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'single-line-text' },
              { id: 4, name: 'password', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'safe_view',
                name: 'Safe View',
                fields: ['id', 'username', 'email'],
              },
            ],
          },
        ],
      })

      // WHEN: displaying records in the view
      await page.goto('/tables/tbl_users/views/safe_view')

      // THEN: that field should not be shown (password excluded from array)
      await expect(page.locator('[data-field="password"]')).toBeHidden()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-VIEW-004: user can complete full view-fields workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application configured with representative field configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'status', type: 'single-line-text' },
              { id: 4, name: 'secret', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            views: [
              {
                id: 'custom_view',
                name: 'Custom View',
                fields: ['status', 'name', 'id'],
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/tables/tbl_data/views/custom_view')

      const columns = page.locator('[data-field]')
      // THEN: fields should appear in array order, secret excluded
      await expect(columns.nth(0)).toHaveAttribute('data-field', 'status')
      await expect(columns.nth(1)).toHaveAttribute('data-field', 'name')
      await expect(columns.nth(2)).toHaveAttribute('data-field', 'id')
      await expect(page.locator('[data-field="secret"]')).toBeHidden()
    }
  )
})
