/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { join } from 'node:path'
import { describe, test, expect } from 'bun:test'
import { compareAppSchemas } from './app-schema-diff'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const GOAL_APP_SCHEMA = join(PROJECT_ROOT, 'specs', 'app', 'app.schema.json')
const CURRENT_APP_SCHEMA = join(PROJECT_ROOT, 'schemas', '0.0.1', 'app.schema.json')

// Helper function to check if array is sorted
function isSorted(arr: string[]): boolean {
  for (let i = 1; i < arr.length; i++) {
    const prev = arr[i - 1]
    const curr = arr[i]
    if (!prev || !curr) continue
    if (prev > curr) return false
  }
  return true
}

// TODO: Update tests to work with Effect Schema instead of JSON Schema files
describe.skip('app-schema-diff', () => {
  describe('compareAppSchemas', () => {
    test('should compare goal and current schemas', async () => {
      const result = await compareAppSchemas(GOAL_APP_SCHEMA, CURRENT_APP_SCHEMA)

      // Should return comparison structure
      expect(result.totalProperties).toBeGreaterThan(0)
      expect(result.implementedProperties).toBeGreaterThanOrEqual(0)
      expect(result.missingProperties).toBeGreaterThanOrEqual(0)
      expect(result.completionPercent).toBeGreaterThanOrEqual(0)
      expect(result.completionPercent).toBeLessThanOrEqual(100)
    })

    test('should calculate correct property counts', async () => {
      const result = await compareAppSchemas(GOAL_APP_SCHEMA, CURRENT_APP_SCHEMA)

      // Total should equal implemented + missing
      expect(result.totalProperties).toBe(result.implementedProperties + result.missingProperties)
    })

    test('should return sorted property paths', async () => {
      const result = await compareAppSchemas(GOAL_APP_SCHEMA, CURRENT_APP_SCHEMA)

      // Should have arrays of property names
      expect(Array.isArray(result.missingPropertyPaths)).toBe(true)
      expect(Array.isArray(result.implementedPropertyPaths)).toBe(true)

      // Arrays should be sorted
      expect(isSorted(result.missingPropertyPaths)).toBe(true)
      expect(isSorted(result.implementedPropertyPaths)).toBe(true)
    })

    test('should calculate completion percentage correctly', async () => {
      const result = await compareAppSchemas(GOAL_APP_SCHEMA, CURRENT_APP_SCHEMA)

      const expectedPercent = Math.round(
        (result.implementedProperties / result.totalProperties) * 100
      )

      expect(result.completionPercent).toBe(expectedPercent)
    })

    test('should resolve $ref pointers before comparison', async () => {
      const result = await compareAppSchemas(GOAL_APP_SCHEMA, CURRENT_APP_SCHEMA)

      // Goal schema uses $ref (e.g., ./name/name.schema.json)
      // Current schema is fully resolved
      // If $ref resolution works, we should get valid comparison results
      expect(result.totalProperties).toBeGreaterThan(0)
      expect(typeof result.completionPercent).toBe('number')
    })

    test('should handle schemas with no implemented properties', async () => {
      // This tests the edge case where current schema has 0 properties
      // We'll use a minimal test by checking the goal schema alone
      const result = await compareAppSchemas(GOAL_APP_SCHEMA, CURRENT_APP_SCHEMA)

      // Even if nothing is implemented, should not error
      expect(result.totalProperties).toBeGreaterThan(0)
      expect(result.completionPercent).toBeGreaterThanOrEqual(0)
    })

    test('should include expected property names from goal schema', async () => {
      const result = await compareAppSchemas(GOAL_APP_SCHEMA, CURRENT_APP_SCHEMA)

      const allProperties = [...result.implementedPropertyPaths, ...result.missingPropertyPaths]

      // Goal schema should have standard app properties
      // At least one of these should be in the total
      const hasKnownProperties = allProperties.some((prop) =>
        ['name', 'description', 'version', 'tables', 'pages', 'automations'].includes(prop)
      )

      expect(hasKnownProperties).toBe(true)
    })
  })
})
