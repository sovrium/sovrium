/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { isPluginEnabled, PluginsConfigSchema } from '.'

describe('PluginsConfigSchema', () => {
  describe('valid configurations', () => {
    test('should accept empty plugins object', () => {
      const input = {}
      const result = Schema.decodeUnknownSync(PluginsConfigSchema)(input)
      expect(result).toEqual({})
    })

    test('should accept admin plugin as boolean', () => {
      const input = { admin: true }
      const result = Schema.decodeUnknownSync(PluginsConfigSchema)(input)
      expect(result.admin).toBe(true)
    })

    test('should accept admin plugin as config object', () => {
      const input = { admin: { impersonation: true } }
      const result = Schema.decodeUnknownSync(PluginsConfigSchema)(input)
      expect(result.admin).toEqual({ impersonation: true })
    })

    test('should accept organization plugin as boolean', () => {
      const input = { organization: true }
      const result = Schema.decodeUnknownSync(PluginsConfigSchema)(input)
      expect(result.organization).toBe(true)
    })

    test('should accept organization plugin as config object', () => {
      const input = { organization: { maxMembersPerOrg: 50 } }
      const result = Schema.decodeUnknownSync(PluginsConfigSchema)(input)
      expect(result.organization).toEqual({ maxMembersPerOrg: 50 })
    })

    test('should accept twoFactor plugin as boolean', () => {
      const input = { twoFactor: true }
      const result = Schema.decodeUnknownSync(PluginsConfigSchema)(input)
      expect(result.twoFactor).toBe(true)
    })

    test('should accept twoFactor plugin as config object', () => {
      const input = { twoFactor: { issuer: 'MyApp', backupCodes: true } }
      const result = Schema.decodeUnknownSync(PluginsConfigSchema)(input)
      expect(result.twoFactor).toEqual({ issuer: 'MyApp', backupCodes: true })
    })

    test('should accept bearer plugin as boolean', () => {
      const input = { bearer: true }
      const result = Schema.decodeUnknownSync(PluginsConfigSchema)(input)
      expect(result.bearer).toBe(true)
    })

    test('should accept jwt plugin as boolean', () => {
      const input = { jwt: true }
      const result = Schema.decodeUnknownSync(PluginsConfigSchema)(input)
      expect(result.jwt).toBe(true)
    })

    test('should accept apiKeys plugin as boolean', () => {
      const input = { apiKeys: true }
      const result = Schema.decodeUnknownSync(PluginsConfigSchema)(input)
      expect(result.apiKeys).toBe(true)
    })

    test('should accept multiple plugins', () => {
      const input = {
        admin: true,
        organization: true,
        twoFactor: { issuer: 'MyApp' },
      }
      const result = Schema.decodeUnknownSync(PluginsConfigSchema)(input)
      expect(result).toEqual(input)
    })

    test('should accept all plugins configured together', () => {
      const input = {
        admin: { impersonation: true },
        organization: { maxMembersPerOrg: 100 },
        twoFactor: true,
        bearer: true,
        jwt: true,
        apiKeys: { expirationDays: 90 },
      }
      const result = Schema.decodeUnknownSync(PluginsConfigSchema)(input)
      expect(result.admin).toEqual({ impersonation: true })
      expect(result.organization).toEqual({ maxMembersPerOrg: 100 })
      expect(result.apiKeys).toEqual({ expirationDays: 90 })
    })
  })

  describe('invalid configurations', () => {
    test('should strip unknown plugin fields', () => {
      const input = { unknownPlugin: true }
      const result = Schema.decodeUnknownSync(PluginsConfigSchema)(input)
      expect(result).toEqual({})
      expect(result).not.toHaveProperty('unknownPlugin')
    })

    test('should strip removed plugin sso', () => {
      const input = { sso: true }
      const result = Schema.decodeUnknownSync(PluginsConfigSchema)(input)
      expect(result).toEqual({})
      expect(result).not.toHaveProperty('sso')
    })

    test('should strip removed plugin captcha', () => {
      const input = { captcha: true }
      const result = Schema.decodeUnknownSync(PluginsConfigSchema)(input)
      expect(result).toEqual({})
      expect(result).not.toHaveProperty('captcha')
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(PluginsConfigSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Plugins Configuration')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(PluginsConfigSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toBe('All authentication plugins configuration')
      }
    })

    test('should have examples annotation', () => {
      const examples = SchemaAST.getExamplesAnnotation(PluginsConfigSchema.ast)
      expect(examples._tag).toBe('Some')
      if (examples._tag === 'Some') {
        expect(examples.value).toHaveLength(2)
      }
    })
  })
})

describe('isPluginEnabled', () => {
  test('should return false when plugins is undefined', () => {
    expect(isPluginEnabled(undefined, 'admin')).toBe(false)
    expect(isPluginEnabled(undefined, 'twoFactor')).toBe(false)
  })

  test('should return false when plugins is empty object', () => {
    expect(isPluginEnabled({}, 'admin')).toBe(false)
    expect(isPluginEnabled({}, 'organization')).toBe(false)
  })

  test('should return true when plugin is set to true', () => {
    expect(isPluginEnabled({ admin: true }, 'admin')).toBe(true)
    expect(isPluginEnabled({ twoFactor: true }, 'twoFactor')).toBe(true)
    expect(isPluginEnabled({ bearer: true }, 'bearer')).toBe(true)
  })

  test('should return false when plugin is set to false', () => {
    expect(isPluginEnabled({ admin: false }, 'admin')).toBe(false)
    expect(isPluginEnabled({ twoFactor: false }, 'twoFactor')).toBe(false)
  })

  test('should return true when plugin is a config object', () => {
    expect(isPluginEnabled({ admin: { impersonation: true } }, 'admin')).toBe(true)
    expect(isPluginEnabled({ twoFactor: { issuer: 'MyApp' } }, 'twoFactor')).toBe(true)
    expect(isPluginEnabled({ organization: { maxMembersPerOrg: 50 } }, 'organization')).toBe(true)
  })

  test('should return false for plugins not in config', () => {
    const plugins = { admin: true }
    expect(isPluginEnabled(plugins, 'admin')).toBe(true)
    expect(isPluginEnabled(plugins, 'organization')).toBe(false)
    expect(isPluginEnabled(plugins, 'twoFactor')).toBe(false)
  })

  test('should work with all plugin types', () => {
    const allPlugins = {
      admin: true,
      organization: true,
      twoFactor: true,
      bearer: true,
      jwt: true,
      apiKeys: true,
    }

    expect(isPluginEnabled(allPlugins, 'admin')).toBe(true)
    expect(isPluginEnabled(allPlugins, 'organization')).toBe(true)
    expect(isPluginEnabled(allPlugins, 'twoFactor')).toBe(true)
    expect(isPluginEnabled(allPlugins, 'bearer')).toBe(true)
    expect(isPluginEnabled(allPlugins, 'jwt')).toBe(true)
    expect(isPluginEnabled(allPlugins, 'apiKeys')).toBe(true)
  })
})
