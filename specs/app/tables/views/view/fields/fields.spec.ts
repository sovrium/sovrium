/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

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
    'APP-TABLES-VIEW-FIELDS-001: should show only configured visible fields when a view has specific fields configured as visible',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: a view with specific fields configured as visible
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'name', type: 'text' },
              { name: 'price', type: 'decimal' },
              { name: 'internal_notes', type: 'text' },
            ],
            views: [
              {
                id: 'public_view',
                name: 'Public View',
                type: 'grid',
                fields: [
                  { name: 'id', visible: true, order: 1 },
                  { name: 'name', visible: true, order: 2 },
                  { name: 'price', visible: true, order: 3 },
                  { name: 'internal_notes', visible: false },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: displaying records in the view
      await page.goto('/tables/tbl_products/views/public_view')

      // THEN: only configured visible fields should be shown
      await expect(page.locator('[data-field="id"]')).toBeVisible()
      await expect(page.locator('[data-field="name"]')).toBeVisible()
      await expect(page.locator('[data-field="price"]')).toBeVisible()
      await expect(page.locator('[data-field="internal_notes"]')).toBeHidden()
    }
  )

  test.fixme(
    'APP-TABLES-VIEW-FIELDS-002: should display fields in the specified order when a view has fields configured with custom order',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: a view with fields configured with custom order
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_tasks',
            name: 'tasks',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'title', type: 'text' },
              { name: 'status', type: 'text' },
              { name: 'priority', type: 'text' },
            ],
            views: [
              {
                id: 'ordered_view',
                name: 'Ordered View',
                type: 'grid',
                fields: [
                  { name: 'priority', visible: true, order: 1 },
                  { name: 'status', visible: true, order: 2 },
                  { name: 'title', visible: true, order: 3 },
                  { name: 'id', visible: true, order: 4 },
                ],
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
    'APP-TABLES-VIEW-FIELDS-003: should not show field when a view has a field marked as visible: false',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: a view with a field marked as visible: false
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_users',
            name: 'users',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'username', type: 'text' },
              { name: 'email', type: 'text' },
              { name: 'password', type: 'text' },
            ],
            views: [
              {
                id: 'safe_view',
                name: 'Safe View',
                type: 'grid',
                fields: [
                  { name: 'id', visible: true, order: 1 },
                  { name: 'username', visible: true, order: 2 },
                  { name: 'email', visible: true, order: 3 },
                  { name: 'password', visible: false },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: displaying records in the view
      await page.goto('/tables/tbl_users/views/safe_view')

      // THEN: that field should not be shown
      await expect(page.locator('[data-field="password"]')).toBeHidden()
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'user can complete full view-fields workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative field configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'name', type: 'text' },
              { name: 'status', type: 'text' },
              { name: 'secret', type: 'text' },
            ],
            views: [
              {
                id: 'custom_view',
                name: 'Custom View',
                type: 'grid',
                fields: [
                  { name: 'status', visible: true, order: 1, width: 100 },
                  { name: 'name', visible: true, order: 2, width: 200 },
                  { name: 'id', visible: true, order: 3, width: 80 },
                  { name: 'secret', visible: false },
                ],
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/tables/tbl_data/views/custom_view')

      const columns = page.locator('[data-field]')
      await expect(columns.nth(0)).toHaveAttribute('data-field', 'status')
      await expect(columns.nth(1)).toHaveAttribute('data-field', 'name')
      await expect(columns.nth(2)).toHaveAttribute('data-field', 'id')
      await expect(page.locator('[data-field="secret"]')).toBeHidden()
    }
  )
})
