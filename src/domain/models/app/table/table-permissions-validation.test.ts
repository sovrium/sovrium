/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  validateOrganizationScoped,
  validateOwnerPermissions,
  validateFieldPermissions,
  validateRecordPermissions,
  validateTablePermissions,
} from './table-permissions-validation'

describe('validateOrganizationScoped', () => {
  describe('When organizationScoped is not enabled', () => {
    test('Then returns undefined for no permissions', () => {
      const result = validateOrganizationScoped({
        fields: [{ name: 'name', type: 'single-line-text' }],
      })
      expect(result).toBeUndefined()
    })

    test('Then returns undefined for organizationScoped false', () => {
      const result = validateOrganizationScoped({
        fields: [{ name: 'name', type: 'single-line-text' }],
        permissions: { organizationScoped: false },
      })
      expect(result).toBeUndefined()
    })
  })

  describe('When organizationScoped is enabled', () => {
    test('Then returns error if organization_id field is missing', () => {
      const result = validateOrganizationScoped({
        fields: [{ name: 'name', type: 'single-line-text' }],
        permissions: { organizationScoped: true },
      })
      expect(result).toEqual({
        message: 'organizationScoped requires organization_id field',
        path: ['permissions', 'organizationScoped'],
      })
    })

    test('Then returns error if organization_id has wrong type', () => {
      const result = validateOrganizationScoped({
        fields: [{ name: 'organization_id', type: 'integer' }],
        permissions: { organizationScoped: true },
      })
      expect(result?.message).toContain('must be a text type')
      expect(result?.path).toEqual(['fields'])
    })

    test('Then allows single-line-text type', () => {
      const result = validateOrganizationScoped({
        fields: [{ name: 'organization_id', type: 'single-line-text' }],
        permissions: { organizationScoped: true },
      })
      expect(result).toBeUndefined()
    })

    test('Then allows long-text type', () => {
      const result = validateOrganizationScoped({
        fields: [{ name: 'organization_id', type: 'long-text' }],
        permissions: { organizationScoped: true },
      })
      expect(result).toBeUndefined()
    })
  })
})

describe('validateOwnerPermissions', () => {
  const fields = [
    { name: 'user_id', type: 'user' },
    { name: 'created_by', type: 'created-by' },
    { name: 'title', type: 'single-line-text' },
  ]
  const fieldNames = new Set(['user_id', 'created_by', 'title'])

  describe('When owner permission references non-existent field', () => {
    test('Then returns error for read permission', () => {
      const result = validateOwnerPermissions(
        { read: { type: 'owner', field: 'missing_field' } },
        fields,
        fieldNames
      )
      expect(result).toEqual({
        message: "Owner field 'missing_field' does not exist in table - field not found",
        path: ['permissions', 'read'],
      })
    })

    test('Then returns error for update permission', () => {
      const result = validateOwnerPermissions(
        { update: { type: 'owner', field: 'unknown' } },
        fields,
        fieldNames
      )
      expect(result?.path).toEqual(['permissions', 'update'])
    })

    test('Then returns error for delete permission', () => {
      const result = validateOwnerPermissions(
        { delete: { type: 'owner', field: 'nonexistent' } },
        fields,
        fieldNames
      )
      expect(result?.path).toEqual(['permissions', 'delete'])
    })
  })

  describe('When owner permission references non-user field', () => {
    test('Then returns error for text field', () => {
      const result = validateOwnerPermissions(
        { read: { type: 'owner', field: 'title' } },
        fields,
        fieldNames
      )
      expect(result?.message).toContain('must be a user type')
      expect(result?.message).toContain("'single-line-text'")
    })
  })

  describe('When owner permission is valid', () => {
    test('Then allows user type field', () => {
      const result = validateOwnerPermissions(
        { read: { type: 'owner', field: 'user_id' } },
        fields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then allows created-by type field', () => {
      const result = validateOwnerPermissions(
        { read: { type: 'owner', field: 'created_by' } },
        fields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then allows non-owner permission types', () => {
      const result = validateOwnerPermissions(
        { read: { type: 'public' }, create: { type: 'authenticated' } },
        fields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })
  })
})

describe('validateFieldPermissions', () => {
  const fieldNames = new Set(['name', 'email', 'status'])

  describe('When field permissions have duplicates', () => {
    test('Then returns error for duplicate field', () => {
      const result = validateFieldPermissions([{ field: 'name' }, { field: 'name' }], fieldNames)
      expect(result).toEqual({
        message: "Duplicate field permission for field 'name' - conflicting permission definitions",
        path: ['permissions', 'fields'],
      })
    })
  })

  describe('When field permissions reference non-existent field', () => {
    test('Then returns error for unknown field', () => {
      const result = validateFieldPermissions([{ field: 'missing' }], fieldNames)
      expect(result).toEqual({
        message:
          "Field permission references non-existent field 'missing' - field does not exist in table",
        path: ['permissions', 'fields'],
      })
    })
  })

  describe('When field permissions are valid', () => {
    test('Then returns undefined for existing fields', () => {
      const result = validateFieldPermissions([{ field: 'name' }, { field: 'email' }], fieldNames)
      expect(result).toBeUndefined()
    })

    test('Then returns undefined for empty array', () => {
      const result = validateFieldPermissions([], fieldNames)
      expect(result).toBeUndefined()
    })
  })
})

describe('validateRecordPermissions', () => {
  const fieldNames = new Set(['status', 'department', 'owner_id'])

  describe('When condition has invalid syntax', () => {
    test('Then returns error for double equals', () => {
      const result = validateRecordPermissions(
        [{ action: 'read', condition: "status == 'active'" }],
        fieldNames
      )
      expect(result).toEqual({
        message: 'Invalid condition syntax: use single = for equality, not ==',
        path: ['permissions', 'records'],
      })
    })

    test('Then returns error for consecutive operators', () => {
      const result = validateRecordPermissions(
        [{ action: 'read', condition: 'status = = active' }],
        fieldNames
      )
      expect(result?.message).toContain('consecutive comparison operators')
    })
  })

  describe('When condition references non-existent field', () => {
    test('Then returns error for unknown field', () => {
      const result = validateRecordPermissions(
        [{ action: 'read', condition: "unknown_field = 'value'" }],
        fieldNames
      )
      expect(result).toEqual({
        message:
          "Record permission references non-existent field 'unknown_field' - field does not exist in table",
        path: ['permissions', 'records'],
      })
    })
  })

  describe('When condition is valid', () => {
    test('Then allows existing field references', () => {
      const result = validateRecordPermissions(
        [{ action: 'read', condition: "status = 'active'" }],
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then allows {userId} variable', () => {
      const result = validateRecordPermissions(
        [{ action: 'read', condition: 'owner_id = {userId}' }],
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then allows {organizationId} variable', () => {
      const result = validateRecordPermissions(
        [{ action: 'read', condition: 'department = {organizationId}' }],
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then allows {user.property} syntax', () => {
      const result = validateRecordPermissions(
        [{ action: 'read', condition: 'department = {user.department}' }],
        fieldNames
      )
      expect(result).toBeUndefined()
    })
  })
})

describe('validateTablePermissions', () => {
  const fields = [
    { name: 'name', type: 'single-line-text' },
    { name: 'user_id', type: 'user' },
    { name: 'organization_id', type: 'single-line-text' },
  ]
  const fieldNames = new Set(['name', 'user_id', 'organization_id'])

  test('returns undefined for valid permissions', () => {
    const result = validateTablePermissions(
      {
        read: { type: 'public' },
        create: { type: 'authenticated' },
      },
      fields,
      fieldNames
    )
    expect(result).toBeUndefined()
  })

  test('validates organizationScoped first', () => {
    const result = validateTablePermissions(
      { organizationScoped: true },
      [{ name: 'name', type: 'single-line-text' }],
      new Set(['name'])
    )
    expect(result?.message).toContain('organizationScoped requires organization_id field')
  })

  test('validates owner permissions', () => {
    const result = validateTablePermissions(
      { read: { type: 'owner', field: 'missing' } },
      fields,
      fieldNames
    )
    expect(result?.message).toContain('does not exist')
  })

  test('validates field permissions', () => {
    const result = validateTablePermissions({ fields: [{ field: 'missing' }] }, fields, fieldNames)
    expect(result?.message).toContain('does not exist in table')
  })

  test('validates record permissions', () => {
    const result = validateTablePermissions(
      { records: [{ action: 'read', condition: "unknown = 'value'" }] },
      fields,
      fieldNames
    )
    expect(result?.message).toContain('non-existent field')
  })
})
