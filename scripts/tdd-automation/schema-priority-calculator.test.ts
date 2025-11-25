/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as path from 'node:path'
import { describe, expect, test } from 'bun:test'
import { calculateSpecPriority, getFeaturePathFromSpecId } from './schema-priority-calculator'

const rootSchemaPath = path.join(process.cwd(), 'specs/app/app.schema.json')

describe('Domain-based priority calculation', () => {
  describe('Domain separation', () => {
    test('APP specs should have priority < 1,000,000', () => {
      const appPriorities = [
        calculateSpecPriority('APP-VERSION-001', rootSchemaPath),
        calculateSpecPriority('APP-NAME-001', rootSchemaPath),
        calculateSpecPriority('APP-THEME-COLORS-001', rootSchemaPath),
      ]

      for (const priority of appPriorities) {
        expect(priority).toBeLessThan(1_000_000)
      }
    })

    test('API specs should have priority between 1,000,000 and 2,000,000', () => {
      const apiPriorities = [
        calculateSpecPriority('API-PATHS-HEALTH-001', rootSchemaPath),
        calculateSpecPriority('API-PATHS-AUTH-001', rootSchemaPath),
      ]

      for (const priority of apiPriorities) {
        expect(priority).toBeGreaterThanOrEqual(1_000_000)
        expect(priority).toBeLessThan(2_000_000)
      }
    })

    test('ADMIN specs should have priority >= 2,000,000', () => {
      const adminPriorities = [
        calculateSpecPriority('ADMIN-TABLES-001', rootSchemaPath),
        calculateSpecPriority('ADMIN-CONNECTIONS-001', rootSchemaPath),
      ]

      for (const priority of adminPriorities) {
        expect(priority).toBeGreaterThanOrEqual(2_000_000)
      }
    })

    test('APP specs should always run before API specs', () => {
      const maxAppPriority = Math.max(
        calculateSpecPriority('APP-VERSION-REGRESSION', rootSchemaPath),
        calculateSpecPriority('APP-THEME-COLORS-REGRESSION', rootSchemaPath)
      )

      const minApiPriority = Math.min(
        calculateSpecPriority('API-PATHS-HEALTH-001', rootSchemaPath),
        calculateSpecPriority('API-PATHS-AUTH-001', rootSchemaPath)
      )

      expect(maxAppPriority).toBeLessThan(minApiPriority)
    })

    test('API specs should always run before ADMIN specs', () => {
      const maxApiPriority = calculateSpecPriority('API-PATHS-AUTH-REGRESSION', rootSchemaPath)
      const minAdminPriority = calculateSpecPriority('ADMIN-TABLES-001', rootSchemaPath)

      expect(maxApiPriority).toBeLessThan(minAdminPriority)
    })
  })

  describe('Regression tests ordering', () => {
    test('Regression tests should run after regular tests in same feature', () => {
      const regularTest = calculateSpecPriority('API-PATHS-HEALTH-001', rootSchemaPath)
      const regressionTest = calculateSpecPriority('API-PATHS-HEALTH-REGRESSION', rootSchemaPath)

      expect(regressionTest).toBeGreaterThan(regularTest)
    })

    test('Regression test with number suffix should run after regular tests', () => {
      const test001 = calculateSpecPriority('ADMIN-TABLES-001', rootSchemaPath)
      const test002 = calculateSpecPriority('ADMIN-TABLES-002', rootSchemaPath)
      const regressionTest = calculateSpecPriority('ADMIN-TABLES-REGRESSION-001', rootSchemaPath)

      expect(regressionTest).toBeGreaterThan(test001)
      expect(regressionTest).toBeGreaterThan(test002)
    })
  })

  describe('Feature path extraction', () => {
    test('should extract APP feature paths correctly', () => {
      expect(getFeaturePathFromSpecId('APP-VERSION-001')).toBe('app/version')
      expect(getFeaturePathFromSpecId('APP-THEME-COLORS-001')).toBe('app/theme/colors')
      expect(getFeaturePathFromSpecId('APP-VERSION-REGRESSION')).toBe('app/version')
    })

    test('should extract API feature paths correctly', () => {
      expect(getFeaturePathFromSpecId('API-PATHS-HEALTH-001')).toBe('api/paths/health')
      expect(getFeaturePathFromSpecId('API-PATHS-AUTH-SIGNIN-001')).toBe('api/paths/auth/signin')
    })

    test('should extract ADMIN feature paths correctly', () => {
      expect(getFeaturePathFromSpecId('ADMIN-TABLES-001')).toBe('admin/tables')
      expect(getFeaturePathFromSpecId('ADMIN-CONNECTIONS-001')).toBe('admin/connections')
    })
  })

  describe('Sequential test numbering', () => {
    test('Tests should be ordered by their numeric suffix', () => {
      const test001 = calculateSpecPriority('API-PATHS-HEALTH-001', rootSchemaPath)
      const test002 = calculateSpecPriority('API-PATHS-HEALTH-002', rootSchemaPath)
      const test003 = calculateSpecPriority('API-PATHS-HEALTH-003', rootSchemaPath)

      expect(test001).toBeLessThan(test002)
      expect(test002).toBeLessThan(test003)
    })
  })
})
