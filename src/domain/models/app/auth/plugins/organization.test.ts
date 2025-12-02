/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { OrganizationConfigSchema } from './organization'

describe('OrganizationConfigSchema', () => {
  describe('valid configurations', () => {
    test('should accept boolean true', () => {
      const result = Schema.decodeUnknownSync(OrganizationConfigSchema)(true)
      expect(result).toBe(true)
    })

    test('should accept boolean false', () => {
      const result = Schema.decodeUnknownSync(OrganizationConfigSchema)(false)
      expect(result).toBe(false)
    })

    test('should accept empty config object', () => {
      const result = Schema.decodeUnknownSync(OrganizationConfigSchema)({})
      expect(result).toEqual({})
    })

    test('should accept maxMembersPerOrg', () => {
      const input = { maxMembersPerOrg: 50 }
      const result = Schema.decodeUnknownSync(OrganizationConfigSchema)(input)
      expect(result).toEqual({ maxMembersPerOrg: 50 })
    })

    test('should accept allowMultipleOrgs', () => {
      const input = { allowMultipleOrgs: true }
      const result = Schema.decodeUnknownSync(OrganizationConfigSchema)(input)
      expect(result).toEqual({ allowMultipleOrgs: true })
    })

    test('should accept defaultRole', () => {
      const input = { defaultRole: 'member' }
      const result = Schema.decodeUnknownSync(OrganizationConfigSchema)(input)
      expect(result).toEqual({ defaultRole: 'member' })
    })

    test('should accept all valid defaultRole values', () => {
      const roles = ['owner', 'admin', 'member', 'viewer'] as const
      for (const role of roles) {
        const result = Schema.decodeUnknownSync(OrganizationConfigSchema)({ defaultRole: role })
        expect(result).toEqual({ defaultRole: role })
      }
    })

    test('should accept full configuration', () => {
      const input = {
        maxMembersPerOrg: 100,
        allowMultipleOrgs: true,
        defaultRole: 'admin' as const,
      }
      const result = Schema.decodeUnknownSync(OrganizationConfigSchema)(input)
      expect(result).toEqual(input)
    })
  })

  describe('invalid configurations', () => {
    test('should reject negative maxMembersPerOrg', () => {
      expect(() =>
        Schema.decodeUnknownSync(OrganizationConfigSchema)({ maxMembersPerOrg: -1 })
      ).toThrow()
    })

    test('should reject zero maxMembersPerOrg', () => {
      expect(() =>
        Schema.decodeUnknownSync(OrganizationConfigSchema)({ maxMembersPerOrg: 0 })
      ).toThrow()
    })

    test('should reject invalid defaultRole', () => {
      expect(() =>
        Schema.decodeUnknownSync(OrganizationConfigSchema)({ defaultRole: 'superadmin' })
      ).toThrow()
    })

    test('should reject string input', () => {
      expect(() => Schema.decodeUnknownSync(OrganizationConfigSchema)('true')).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(OrganizationConfigSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Organization Plugin Configuration')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(OrganizationConfigSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toBe('Multi-tenancy and organization management')
      }
    })

    test('should have examples annotation', () => {
      const examples = SchemaAST.getExamplesAnnotation(OrganizationConfigSchema.ast)
      expect(examples._tag).toBe('Some')
      if (examples._tag === 'Some') {
        expect(examples.value).toContain(true)
      }
    })
  })
})
