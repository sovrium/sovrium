/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import {
  hasPermission,
  isAdminRole,
  checkPermissionWithAdminOverride,
  evaluateTablePermissions,
  evaluateFieldPermissions,
  hasCreatePermission,
  hasDeletePermission,
  hasUpdatePermission,
  hasReadPermission,
} from './permissions'

/**
 * Smoke tests verifying re-exports from domain layer.
 *
 * Comprehensive tests live in permission-evaluator.test.ts (domain layer).
 * These tests only verify the re-export wiring is correct.
 */
describe('permissions (re-export smoke tests)', () => {
  test('hasPermission is re-exported and functional', () => {
    expect(hasPermission('all', 'member')).toBe(true)
    expect(hasPermission(undefined, 'member')).toBe(false)
  })

  test('isAdminRole is re-exported and functional', () => {
    expect(isAdminRole('admin')).toBe(true)
    expect(isAdminRole('member')).toBe(false)
  })

  test('checkPermissionWithAdminOverride is re-exported and functional', () => {
    expect(checkPermissionWithAdminOverride(true, undefined, 'admin')).toBe(true)
  })

  test('evaluateTablePermissions is re-exported and functional', () => {
    const result = evaluateTablePermissions(undefined, 'admin', true)
    expect(result.read).toBe(true)
  })

  test('evaluateFieldPermissions is re-exported and functional', () => {
    const result = evaluateFieldPermissions(undefined, 'member', false)
    expect(result).toEqual({})
  })

  test('hasCreatePermission is re-exported and functional', () => {
    expect(hasCreatePermission(undefined, 'member')).toBe(true)
  })

  test('hasDeletePermission is re-exported and functional', () => {
    expect(hasDeletePermission(undefined, 'member')).toBe(false)
  })

  test('hasUpdatePermission is re-exported and functional', () => {
    expect(hasUpdatePermission(undefined, 'member')).toBe(true)
  })

  test('hasReadPermission is re-exported and functional', () => {
    expect(hasReadPermission(undefined, 'member')).toBe(true)
  })
})
