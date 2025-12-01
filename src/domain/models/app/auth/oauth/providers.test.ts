/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import {
  DetailedOAuthConfigSchema,
  getDefaultEnvVars,
  OAuthConfigSchema,
  OAuthProviderConfigSchema,
  OAuthProviderSchema,
  SimpleOAuthConfigSchema,
} from './providers'

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

describe('OAuthProviderConfigSchema', () => {
  describe('valid configurations', () => {
    test('should accept minimal config', () => {
      const input = {
        provider: 'google' as const,
        clientId: '$GOOGLE_CLIENT_ID',
        clientSecret: '$GOOGLE_CLIENT_SECRET',
      }
      const result = Schema.decodeUnknownSync(OAuthProviderConfigSchema)(input)
      expect(result).toEqual(input)
    })

    test('should accept config with scopes', () => {
      const input = {
        provider: 'google' as const,
        clientId: '$GOOGLE_CLIENT_ID',
        clientSecret: '$GOOGLE_CLIENT_SECRET',
        scopes: ['openid', 'profile', 'email'],
      }
      const result = Schema.decodeUnknownSync(OAuthProviderConfigSchema)(input)
      expect(result.scopes).toEqual(['openid', 'profile', 'email'])
    })

    test('should accept config with redirectUri', () => {
      const input = {
        provider: 'github' as const,
        clientId: '$GH_ID',
        clientSecret: '$GH_SECRET',
        redirectUri: 'https://myapp.com/auth/callback',
      }
      const result = Schema.decodeUnknownSync(OAuthProviderConfigSchema)(input)
      expect(result.redirectUri).toBe('https://myapp.com/auth/callback')
    })

    test('should accept full config', () => {
      const input = {
        provider: 'slack' as const,
        clientId: '$SLACK_ID',
        clientSecret: '$SLACK_SECRET',
        scopes: ['users:read', 'users:read.email'],
        redirectUri: 'https://myapp.com/auth/slack/callback',
      }
      const result = Schema.decodeUnknownSync(OAuthProviderConfigSchema)(input)
      expect(result).toEqual(input)
    })
  })

  describe('invalid configurations', () => {
    test('should reject missing provider', () => {
      const input = {
        clientId: '$CLIENT_ID',
        clientSecret: '$CLIENT_SECRET',
      }
      expect(() => Schema.decodeUnknownSync(OAuthProviderConfigSchema)(input)).toThrow()
    })

    test('should reject missing clientId', () => {
      const input = {
        provider: 'google',
        clientSecret: '$CLIENT_SECRET',
      }
      expect(() => Schema.decodeUnknownSync(OAuthProviderConfigSchema)(input)).toThrow()
    })

    test('should reject missing clientSecret', () => {
      const input = {
        provider: 'google',
        clientId: '$CLIENT_ID',
      }
      expect(() => Schema.decodeUnknownSync(OAuthProviderConfigSchema)(input)).toThrow()
    })

    test('should reject invalid env ref format', () => {
      const input = {
        provider: 'google',
        clientId: 'not-an-env-ref', // missing $ prefix
        clientSecret: '$CLIENT_SECRET',
      }
      expect(() => Schema.decodeUnknownSync(OAuthProviderConfigSchema)(input)).toThrow()
    })
  })
})

describe('SimpleOAuthConfigSchema', () => {
  describe('valid configurations', () => {
    test('should accept single provider', () => {
      const input = { providers: ['google'] }
      const result = Schema.decodeUnknownSync(SimpleOAuthConfigSchema)(input)
      expect(result.providers).toEqual(['google'])
    })

    test('should accept multiple providers', () => {
      const input = { providers: ['google', 'github', 'slack'] }
      const result = Schema.decodeUnknownSync(SimpleOAuthConfigSchema)(input)
      expect(result.providers).toEqual(['google', 'github', 'slack'])
    })
  })

  describe('invalid configurations', () => {
    test('should reject empty providers array', () => {
      const input = { providers: [] }
      expect(() => Schema.decodeUnknownSync(SimpleOAuthConfigSchema)(input)).toThrow()
    })

    test('should reject invalid provider', () => {
      const input = { providers: ['invalid'] }
      expect(() => Schema.decodeUnknownSync(SimpleOAuthConfigSchema)(input)).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(SimpleOAuthConfigSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Simple OAuth Configuration')
      }
    })
  })
})

describe('DetailedOAuthConfigSchema', () => {
  describe('valid configurations', () => {
    test('should accept single detailed provider', () => {
      const input = {
        providers: [
          {
            provider: 'google' as const,
            clientId: '$GOOGLE_ID',
            clientSecret: '$GOOGLE_SECRET',
          },
        ],
      }
      const result = Schema.decodeUnknownSync(DetailedOAuthConfigSchema)(input)
      expect(result.providers).toHaveLength(1)
      expect(result.providers[0].provider).toBe('google')
    })

    test('should accept multiple detailed providers', () => {
      const input = {
        providers: [
          {
            provider: 'google' as const,
            clientId: '$GOOGLE_ID',
            clientSecret: '$GOOGLE_SECRET',
          },
          {
            provider: 'github' as const,
            clientId: '$GH_ID',
            clientSecret: '$GH_SECRET',
          },
        ],
      }
      const result = Schema.decodeUnknownSync(DetailedOAuthConfigSchema)(input)
      expect(result.providers).toHaveLength(2)
    })
  })

  describe('invalid configurations', () => {
    test('should reject empty providers array', () => {
      const input = { providers: [] }
      expect(() => Schema.decodeUnknownSync(DetailedOAuthConfigSchema)(input)).toThrow()
    })

    test('should reject mixed simple and detailed providers', () => {
      const input = {
        providers: [
          'google',
          { provider: 'github', clientId: '$GH_ID', clientSecret: '$GH_SECRET' },
        ],
      }
      expect(() => Schema.decodeUnknownSync(DetailedOAuthConfigSchema)(input)).toThrow()
    })
  })
})

describe('OAuthConfigSchema', () => {
  describe('simple configuration', () => {
    test('should accept simple provider list', () => {
      const input = { providers: ['google', 'github'] as const }
      const result = Schema.decodeUnknownSync(OAuthConfigSchema)(input)
      expect(result.providers).toEqual(['google', 'github'])
    })
  })

  describe('detailed configuration', () => {
    test('should accept detailed provider config', () => {
      const input = {
        providers: [
          {
            provider: 'google' as const,
            clientId: '$GOOGLE_CLIENT_ID',
            clientSecret: '$GOOGLE_CLIENT_SECRET',
          },
        ] as const,
      }
      const result = Schema.decodeUnknownSync(OAuthConfigSchema)(input)
      expect(result.providers).toHaveLength(1)
    })
  })

  describe('invalid configurations', () => {
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

describe('getDefaultEnvVars', () => {
  test('should return uppercase env var names for google', () => {
    const result = getDefaultEnvVars('google')
    expect(result).toEqual({
      clientId: 'GOOGLE_CLIENT_ID',
      clientSecret: 'GOOGLE_CLIENT_SECRET',
    })
  })

  test('should return uppercase env var names for github', () => {
    const result = getDefaultEnvVars('github')
    expect(result).toEqual({
      clientId: 'GITHUB_CLIENT_ID',
      clientSecret: 'GITHUB_CLIENT_SECRET',
    })
  })

  test('should return uppercase env var names for slack', () => {
    const result = getDefaultEnvVars('slack')
    expect(result).toEqual({
      clientId: 'SLACK_CLIENT_ID',
      clientSecret: 'SLACK_CLIENT_SECRET',
    })
  })

  test('should return uppercase env var names for microsoft', () => {
    const result = getDefaultEnvVars('microsoft')
    expect(result).toEqual({
      clientId: 'MICROSOFT_CLIENT_ID',
      clientSecret: 'MICROSOFT_CLIENT_SECRET',
    })
  })

  test('should return uppercase env var names for gitlab', () => {
    const result = getDefaultEnvVars('gitlab')
    expect(result).toEqual({
      clientId: 'GITLAB_CLIENT_ID',
      clientSecret: 'GITLAB_CLIENT_SECRET',
    })
  })
})
