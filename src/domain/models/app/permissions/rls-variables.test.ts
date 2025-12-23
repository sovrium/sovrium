/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { RLS_VARIABLES, RLS_VARIABLE_DOCS, buildRlsVariablesDoc } from './rls-variables'

describe('RLS_VARIABLES', () => {
  test('should have USER_ID placeholder', () => {
    expect(RLS_VARIABLES.USER_ID).toBe('{userId}')
  })

  test('should have ORGANIZATION_ID placeholder', () => {
    expect(RLS_VARIABLES.ORGANIZATION_ID).toBe('{organizationId}')
  })

  test('should have ROLES placeholder', () => {
    expect(RLS_VARIABLES.ROLES).toBe('{roles}')
  })

  test('should be readonly (const assertion)', () => {
    // TypeScript ensures this at compile time, but we verify the values are correct
    expect(Object.keys(RLS_VARIABLES)).toEqual(['USER_ID', 'ORGANIZATION_ID', 'ROLES'])
  })
})

describe('RLS_VARIABLE_DOCS', () => {
  describe('userId', () => {
    test('should have correct placeholder', () => {
      expect(RLS_VARIABLE_DOCS.userId.placeholder).toBe('{userId}')
    })

    test('should have description', () => {
      expect(RLS_VARIABLE_DOCS.userId.description).toBe("Current authenticated user's ID")
    })

    test('should have SQL function', () => {
      expect(RLS_VARIABLE_DOCS.userId.sqlFunction).toBe('auth.user_id()')
    })

    test('should have examples', () => {
      expect(RLS_VARIABLE_DOCS.userId.examples).toContain('{userId} = created_by')
      expect(RLS_VARIABLE_DOCS.userId.examples).toContain('{userId} = owner_id')
    })
  })

  describe('organizationId', () => {
    test('should have correct placeholder', () => {
      expect(RLS_VARIABLE_DOCS.organizationId.placeholder).toBe('{organizationId}')
    })

    test('should have description', () => {
      expect(RLS_VARIABLE_DOCS.organizationId.description).toBe("Current user's organization ID")
    })

    test('should have SQL function', () => {
      expect(RLS_VARIABLE_DOCS.organizationId.sqlFunction).toBe('auth.organization_id()')
    })

    test('should have examples', () => {
      expect(RLS_VARIABLE_DOCS.organizationId.examples).toContain(
        '{organizationId} = organization_id'
      )
    })
  })

  describe('roles', () => {
    test('should have correct placeholder', () => {
      expect(RLS_VARIABLE_DOCS.roles.placeholder).toBe('{roles}')
    })

    test('should have description', () => {
      expect(RLS_VARIABLE_DOCS.roles.description).toBe("Array of current user's roles")
    })

    test('should have SQL function', () => {
      expect(RLS_VARIABLE_DOCS.roles.sqlFunction).toBe('auth.user_roles()')
    })

    test('should have examples', () => {
      expect(RLS_VARIABLE_DOCS.roles.examples).toContain("'admin' = ANY({roles})")
    })
  })
})

describe('buildRlsVariablesDoc', () => {
  test('should return formatted documentation string', () => {
    const doc = buildRlsVariablesDoc()
    expect(typeof doc).toBe('string')
    expect(doc.length).toBeGreaterThan(0)
  })

  test('should include all variable placeholders', () => {
    const doc = buildRlsVariablesDoc()
    expect(doc).toContain('{userId}')
    expect(doc).toContain('{organizationId}')
    expect(doc).toContain('{roles}')
  })

  test('should include descriptions', () => {
    const doc = buildRlsVariablesDoc()
    expect(doc).toContain("Current authenticated user's ID")
    expect(doc).toContain("Current user's organization ID")
    expect(doc).toContain("Array of current user's roles")
  })

  test('should format each variable on a new line', () => {
    const doc = buildRlsVariablesDoc()
    const lines = doc.split('\n')
    expect(lines.length).toBe(3) // One line per variable
  })

  test('should use markdown list format', () => {
    const doc = buildRlsVariablesDoc()
    const lines = doc.split('\n')
    lines.forEach((line) => {
      expect(line.startsWith('- `')).toBe(true)
    })
  })
})
