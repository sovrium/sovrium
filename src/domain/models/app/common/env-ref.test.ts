/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { EnvRefSchema } from './env-ref'

describe('EnvRefSchema', () => {
  test('should accept valid environment variable references', () => {
    const decode = Schema.decodeUnknownSync(EnvRefSchema)

    expect(decode('$SMTP_PASSWORD')).toBe('$SMTP_PASSWORD')
    expect(decode('$AWS_ACCESS_KEY_ID')).toBe('$AWS_ACCESS_KEY_ID')
    expect(decode('$SENDGRID_API_KEY')).toBe('$SENDGRID_API_KEY')
    expect(decode('$BETTER_AUTH_SECRET')).toBe('$BETTER_AUTH_SECRET')
    expect(decode('$MY_SECRET_123')).toBe('$MY_SECRET_123')
    expect(decode('$DATABASE_URL')).toBe('$DATABASE_URL')
  })

  test('should reject invalid environment variable references', () => {
    const decode = Schema.decodeUnknownSync(EnvRefSchema)

    expect(() => decode('SMTP_PASSWORD')).toThrow() // Missing $
    expect(() => decode('$smtp_password')).toThrow() // Lowercase
    expect(() => decode('$123_VAR')).toThrow() // Starts with number
    expect(() => decode('$VAR-NAME')).toThrow() // Hyphen not allowed
    expect(() => decode('$ SPACE')).toThrow() // Space not allowed
    expect(() => decode('$VAR.NAME')).toThrow() // Dot not allowed
    expect(() => decode('$$VAR')).toThrow() // Double $
  })
})
