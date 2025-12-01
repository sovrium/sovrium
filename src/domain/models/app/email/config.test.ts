/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { EmailConfigSchema, SmtpConfigSchema } from './config'

describe('EmailConfigSchema', () => {
  test('should validate minimal SMTP config', () => {
    const config = {
      from: 'noreply@example.com',
      host: 'smtp.gmail.com',
      port: 587,
    }

    const result = Schema.decodeUnknownSync(EmailConfigSchema)(config)
    expect(result.from).toBe('noreply@example.com')
    expect(result.host).toBe('smtp.gmail.com')
    expect(result.port).toBe(587)
  })

  test('should validate SMTP config with authentication', () => {
    const config = {
      from: 'noreply@myapp.com',
      fromName: 'MyApp',
      host: 'smtp.gmail.com',
      port: 587,
      secure: true,
      username: '$SMTP_USER',
      password: '$SMTP_PASS',
    }

    const result = Schema.decodeUnknownSync(EmailConfigSchema)(config)
    expect(result.from).toBe('noreply@myapp.com')
    expect(result.fromName).toBe('MyApp')
    expect(result.host).toBe('smtp.gmail.com')
    expect(result.port).toBe(587)
    expect(result.secure).toBe(true)
    expect(result.username).toBe('$SMTP_USER')
    expect(result.password).toBe('$SMTP_PASS')
  })

  test('should validate config with replyTo', () => {
    const config = {
      from: 'noreply@myapp.com',
      replyTo: 'support@myapp.com',
      host: 'smtp.gmail.com',
      port: 587,
    }

    const result = Schema.decodeUnknownSync(EmailConfigSchema)(config)
    expect(result.replyTo).toBe('support@myapp.com')
  })

  test('should validate config with templates', () => {
    const config = {
      from: 'noreply@myapp.com',
      fromName: 'MyApp',
      host: 'smtp.gmail.com',
      port: 587,
      templates: {
        engine: 'handlebars',
        templatesDir: './templates/emails',
        cache: true,
      },
    }

    const result = Schema.decodeUnknownSync(EmailConfigSchema)(config)
    expect(result.templates?.engine).toBe('handlebars')
    expect(result.templates?.templatesDir).toBe('./templates/emails')
    expect(result.templates?.cache).toBe(true)
  })

  test('should validate config with preview mode', () => {
    const config = {
      from: 'dev@example.com',
      host: 'smtp.gmail.com',
      port: 587,
      preview: true,
    }

    const result = Schema.decodeUnknownSync(EmailConfigSchema)(config)
    expect(result.preview).toBe(true)
  })

  test('should validate config with all options', () => {
    const config = {
      from: 'noreply@myapp.com',
      fromName: 'MyApp',
      replyTo: 'support@myapp.com',
      host: 'smtp.gmail.com',
      port: 587,
      secure: true,
      username: '$SMTP_USER',
      password: '$SMTP_PASS',
      templates: {
        engine: 'handlebars',
        templatesDir: './templates/emails',
      },
      preview: false,
    }

    const result = Schema.decodeUnknownSync(EmailConfigSchema)(config)
    expect(result.from).toBe('noreply@myapp.com')
    expect(result.fromName).toBe('MyApp')
    expect(result.replyTo).toBe('support@myapp.com')
    expect(result.host).toBe('smtp.gmail.com')
    expect(result.port).toBe(587)
    expect(result.secure).toBe(true)
    expect(result.username).toBe('$SMTP_USER')
    expect(result.password).toBe('$SMTP_PASS')
    expect(result.templates?.engine).toBe('handlebars')
    expect(result.templates?.templatesDir).toBe('./templates/emails')
    expect(result.preview).toBe(false)
  })

  test('should reject invalid email address', () => {
    const config = {
      from: 'not-an-email',
      host: 'smtp.gmail.com',
      port: 587,
    }

    expect(() => Schema.decodeUnknownSync(EmailConfigSchema)(config)).toThrow()
  })

  test('should reject missing required fields', () => {
    const config = {
      from: 'noreply@myapp.com',
      // Missing host and port
    }

    expect(() => Schema.decodeUnknownSync(EmailConfigSchema)(config)).toThrow()
  })

  test('should reject invalid port', () => {
    const config = {
      from: 'noreply@myapp.com',
      host: 'smtp.gmail.com',
      port: 70_000, // Invalid port
    }

    expect(() => Schema.decodeUnknownSync(EmailConfigSchema)(config)).toThrow()
  })
})

describe('SmtpConfigSchema', () => {
  test('should validate minimal SMTP config', () => {
    const config = {
      host: 'smtp.gmail.com',
      port: 587,
    }

    const result = Schema.decodeUnknownSync(SmtpConfigSchema)(config)
    expect(result.host).toBe('smtp.gmail.com')
    expect(result.port).toBe(587)
  })

  test('should validate SMTP config with all options', () => {
    const config = {
      host: 'smtp.gmail.com',
      port: 587,
      secure: true,
      username: '$SMTP_USER',
      password: '$SMTP_PASS',
    }

    const result = Schema.decodeUnknownSync(SmtpConfigSchema)(config)
    expect(result.host).toBe('smtp.gmail.com')
    expect(result.port).toBe(587)
    expect(result.secure).toBe(true)
    expect(result.username).toBe('$SMTP_USER')
    expect(result.password).toBe('$SMTP_PASS')
  })

  test('should reject invalid port', () => {
    const config = {
      host: 'smtp.gmail.com',
      port: 70_000, // Invalid port
    }

    expect(() => Schema.decodeUnknownSync(SmtpConfigSchema)(config)).toThrow()
  })

  test('should reject non-integer port', () => {
    const config = {
      host: 'smtp.gmail.com',
      port: 587.5,
    }

    expect(() => Schema.decodeUnknownSync(SmtpConfigSchema)(config)).toThrow()
  })
})
