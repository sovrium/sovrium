/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { getProviderEnvVars, OAuthConfigSchema, OAuthProviderSchema } from './providers'

describe('OAuthProviderSchema', () => {
  describe('valid providers', () => {
    const validProviders = ['google', 'github', 'microsoft', 'slack', 'gitlab'] as const

    test('should accept all valid providers', () => {
      for (const provider of validProviders) {
        const result = Schema.decodeUnknownSync(OAuthProviderSchema)(provider)
        expect(result).toBe(provider)
      }
    })
  })

  describe('invalid inputs', () => {
    test('should reject unknown provider', () => {
      expect(() => Schema.decodeUnknownSync(OAuthProviderSchema)('unknown-provider')).toThrow()
    })

    test('should reject number', () => {
      expect(() => Schema.decodeUnknownSync(OAuthProviderSchema)(123)).toThrow()
    })

    test('should reject null', () => {
      expect(() => Schema.decodeUnknownSync(OAuthProviderSchema)(null)).toThrow()
    })

    test('should reject removed provider discord', () => {
      expect(() => Schema.decodeUnknownSync(OAuthProviderSchema)('discord')).toThrow()
    })

    test('should reject removed provider apple', () => {
      expect(() => Schema.decodeUnknownSync(OAuthProviderSchema)('apple')).toThrow()
    })

    test('should reject removed provider facebook', () => {
      expect(() => Schema.decodeUnknownSync(OAuthProviderSchema)('facebook')).toThrow()
    })

    test('should reject removed provider twitter', () => {
      expect(() => Schema.decodeUnknownSync(OAuthProviderSchema)('twitter')).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(OAuthProviderSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('OAuth Provider')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(OAuthProviderSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toBe('Supported OAuth providers for social login')
      }
    })
  })
})

describe('OAuthConfigSchema', () => {
  describe('valid configurations', () => {
    test('should accept single provider', () => {
      const input = { providers: ['google'] }
      const result = Schema.decodeUnknownSync(OAuthConfigSchema)(input)
      expect(result.providers).toEqual(['google'])
    })

    test('should accept multiple providers', () => {
      const input = { providers: ['google', 'github', 'slack'] }
      const result = Schema.decodeUnknownSync(OAuthConfigSchema)(input)
      expect(result.providers).toEqual(['google', 'github', 'slack'])
    })

    test('should accept all supported providers', () => {
      const input = { providers: ['google', 'github', 'microsoft', 'slack', 'gitlab'] }
      const result = Schema.decodeUnknownSync(OAuthConfigSchema)(input)
      expect(result.providers).toHaveLength(5)
    })
  })

  describe('invalid configurations', () => {
    test('should reject empty providers array', () => {
      const input = { providers: [] }
      expect(() => Schema.decodeUnknownSync(OAuthConfigSchema)(input)).toThrow()
    })

    test('should reject invalid provider', () => {
      const input = { providers: ['invalid'] }
      expect(() => Schema.decodeUnknownSync(OAuthConfigSchema)(input)).toThrow()
    })

    test('should reject empty object', () => {
      expect(() => Schema.decodeUnknownSync(OAuthConfigSchema)({})).toThrow()
    })

    test('should reject missing providers field', () => {
      expect(() => Schema.decodeUnknownSync(OAuthConfigSchema)({ provider: 'google' })).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(OAuthConfigSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('OAuth Configuration')
      }
    })

    test('should have examples annotation', () => {
      const examples = SchemaAST.getExamplesAnnotation(OAuthConfigSchema.ast)
      expect(examples._tag).toBe('Some')
    })
  })
})

describe('getProviderEnvVars', () => {
  test('should return uppercase env var names for google', () => {
    const result = getProviderEnvVars('google')
    expect(result).toEqual({
      clientId: 'GOOGLE_CLIENT_ID',
      clientSecret: 'GOOGLE_CLIENT_SECRET',
    })
  })

  test('should return uppercase env var names for github', () => {
    const result = getProviderEnvVars('github')
    expect(result).toEqual({
      clientId: 'GITHUB_CLIENT_ID',
      clientSecret: 'GITHUB_CLIENT_SECRET',
    })
  })

  test('should return uppercase env var names for slack', () => {
    const result = getProviderEnvVars('slack')
    expect(result).toEqual({
      clientId: 'SLACK_CLIENT_ID',
      clientSecret: 'SLACK_CLIENT_SECRET',
    })
  })

  test('should return uppercase env var names for microsoft', () => {
    const result = getProviderEnvVars('microsoft')
    expect(result).toEqual({
      clientId: 'MICROSOFT_CLIENT_ID',
      clientSecret: 'MICROSOFT_CLIENT_SECRET',
    })
  })

  test('should return uppercase env var names for gitlab', () => {
    const result = getProviderEnvVars('gitlab')
    expect(result).toEqual({
      clientId: 'GITLAB_CLIENT_ID',
      clientSecret: 'GITLAB_CLIENT_SECRET',
    })
  })
})
