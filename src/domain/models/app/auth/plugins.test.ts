/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { AdminPluginSchema, AuthPluginsSchema, OrganizationPluginSchema } from './plugins'

describe('AdminPluginSchema', () => {
  describe('valid configurations', () => {
    test('should accept enabled: true', () => {
      const input = { enabled: true }
      const result = Schema.decodeUnknownSync(AdminPluginSchema)(input)
      expect(result).toEqual({ enabled: true })
    })

    test('should accept enabled: false', () => {
      const input = { enabled: false }
      const result = Schema.decodeUnknownSync(AdminPluginSchema)(input)
      expect(result).toEqual({ enabled: false })
    })
  })

  describe('invalid configurations', () => {
    test('should reject missing enabled field', () => {
      const input = {}
      expect(() => Schema.decodeUnknownSync(AdminPluginSchema)(input)).toThrow()
    })

    test('should reject enabled as string', () => {
      const input = { enabled: 'true' }
      expect(() => Schema.decodeUnknownSync(AdminPluginSchema)(input)).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(AdminPluginSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Admin Plugin Configuration')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(AdminPluginSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toBe('Configuration for admin plugin features')
      }
    })
  })
})

describe('OrganizationPluginSchema', () => {
  describe('valid configurations', () => {
    test('should accept enabled: true', () => {
      const input = { enabled: true }
      const result = Schema.decodeUnknownSync(OrganizationPluginSchema)(input)
      expect(result).toEqual({ enabled: true })
    })

    test('should accept enabled: false', () => {
      const input = { enabled: false }
      const result = Schema.decodeUnknownSync(OrganizationPluginSchema)(input)
      expect(result).toEqual({ enabled: false })
    })
  })

  describe('invalid configurations', () => {
    test('should reject missing enabled field', () => {
      const input = {}
      expect(() => Schema.decodeUnknownSync(OrganizationPluginSchema)(input)).toThrow()
    })

    test('should reject enabled as string', () => {
      const input = { enabled: 'true' }
      expect(() => Schema.decodeUnknownSync(OrganizationPluginSchema)(input)).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(OrganizationPluginSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Organization Plugin Configuration')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(OrganizationPluginSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toBe('Configuration for organization plugin features')
      }
    })
  })
})

describe('AuthPluginsSchema', () => {
  describe('valid configurations', () => {
    test('should accept both plugins enabled', () => {
      const input = {
        admin: { enabled: true },
        organization: { enabled: true },
      }
      const result = Schema.decodeUnknownSync(AuthPluginsSchema)(input)
      expect(result).toEqual({
        admin: { enabled: true },
        organization: { enabled: true },
      })
    })

    test('should accept only admin plugin', () => {
      const input = {
        admin: { enabled: true },
      }
      const result = Schema.decodeUnknownSync(AuthPluginsSchema)(input)
      expect(result).toEqual({
        admin: { enabled: true },
      })
    })

    test('should accept only organization plugin', () => {
      const input = {
        organization: { enabled: true },
      }
      const result = Schema.decodeUnknownSync(AuthPluginsSchema)(input)
      expect(result).toEqual({
        organization: { enabled: true },
      })
    })

    test('should accept empty plugins object', () => {
      const input = {}
      const result = Schema.decodeUnknownSync(AuthPluginsSchema)(input)
      expect(result).toEqual({})
    })

    test('should accept plugins with enabled: false', () => {
      const input = {
        admin: { enabled: false },
        organization: { enabled: false },
      }
      const result = Schema.decodeUnknownSync(AuthPluginsSchema)(input)
      expect(result).toEqual({
        admin: { enabled: false },
        organization: { enabled: false },
      })
    })
  })

  describe('invalid configurations', () => {
    test('should reject invalid admin plugin', () => {
      const input = {
        admin: { enabled: 'true' },
      }
      expect(() => Schema.decodeUnknownSync(AuthPluginsSchema)(input)).toThrow()
    })

    test('should reject invalid organization plugin', () => {
      const input = {
        organization: { enabled: 'true' },
      }
      expect(() => Schema.decodeUnknownSync(AuthPluginsSchema)(input)).toThrow()
    })

    test('should strip unknown plugin (Effect Schema default behavior)', () => {
      const input = {
        admin: { enabled: true },
        unknown: { enabled: true },
      }
      // Effect Schema strips unknown fields by default (lenient mode)
      const result = Schema.decodeUnknownSync(AuthPluginsSchema)(input)
      expect(result).toEqual({ admin: { enabled: true } })
      expect(result).not.toHaveProperty('unknown')
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(AuthPluginsSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Authentication Plugins')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(AuthPluginsSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toBe('Optional authentication plugins for extended functionality')
      }
    })

    test('should have examples annotation', () => {
      const examples = SchemaAST.getExamplesAnnotation(AuthPluginsSchema.ast)
      expect(examples._tag).toBe('Some')
      if (examples._tag === 'Some') {
        expect(examples.value).toEqual([
          {
            admin: { enabled: true },
            organization: { enabled: true },
          },
          {
            admin: { enabled: true },
          },
          {},
        ])
      }
    })
  })
})
