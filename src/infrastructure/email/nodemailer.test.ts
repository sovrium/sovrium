/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { getEmailConfig, createTransporter, getDefaultFrom } from './nodemailer'

describe('getEmailConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('returns EmailConfig object with required fields', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_PORT = '587'
    process.env.SMTP_USER = 'test-user'
    process.env.SMTP_PASS = 'test-pass'

    const config = getEmailConfig()

    expect(config).toHaveProperty('host')
    expect(config).toHaveProperty('port')
    expect(config).toHaveProperty('secure')
    expect(config).toHaveProperty('auth')
    expect(config).toHaveProperty('from')
  })

  test('delegates to getEmailConfigFromEffect', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_PORT = '587'

    const config = getEmailConfig()

    expect(config.host).toBe('smtp.example.com')
    expect(config.port).toBe(587)
  })

  test('auth object has user and pass fields', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_USER = 'test-user'
    process.env.SMTP_PASS = 'test-pass'

    const config = getEmailConfig()

    expect(config.auth).toHaveProperty('user')
    expect(config.auth).toHaveProperty('pass')
    expect(config.auth.user).toBe('test-user')
    expect(config.auth.pass).toBe('test-pass')
  })

  test('from object has email and name fields', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_FROM = 'noreply@example.com'
    process.env.SMTP_FROM_NAME = 'Test App'

    const config = getEmailConfig()

    expect(config.from).toHaveProperty('email')
    expect(config.from).toHaveProperty('name')
    expect(config.from.email).toBe('noreply@example.com')
    expect(config.from.name).toBe('Test App')
  })
})

describe('createTransporter', () => {
  test('creates transporter with config values', () => {
    const config = {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test-user',
        pass: 'test-pass',
      },
      from: {
        email: 'noreply@example.com',
        name: 'Test App',
      },
    }

    const transporter = createTransporter(config)

    expect(transporter).toBeDefined()
    expect(transporter.options).toBeDefined()
  })

  test('transporter has host from config', () => {
    const config = {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'user@gmail.com',
        pass: 'password',
      },
      from: {
        email: 'noreply@example.com',
        name: 'Test',
      },
    }

    const transporter = createTransporter(config)

    expect(transporter.options.host).toBe('smtp.gmail.com')
  })

  test('transporter has port from config', () => {
    const config = {
      host: 'smtp.example.com',
      port: 2525,
      secure: false,
      auth: {
        user: 'user',
        pass: 'pass',
      },
      from: {
        email: 'noreply@example.com',
        name: 'Test',
      },
    }

    const transporter = createTransporter(config)

    expect(transporter.options.port).toBe(2525)
  })

  test('transporter has secure flag from config', () => {
    const config = {
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: {
        user: 'user',
        pass: 'pass',
      },
      from: {
        email: 'noreply@example.com',
        name: 'Test',
      },
    }

    const transporter = createTransporter(config)

    expect(transporter.options.secure).toBe(true)
  })

  test('transporter has auth credentials from config', () => {
    const config = {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'myuser',
        pass: 'mypass',
      },
      from: {
        email: 'noreply@example.com',
        name: 'Test',
      },
    }

    const transporter = createTransporter(config)

    expect(transporter.options.auth).toEqual({
      user: 'myuser',
      pass: 'mypass',
    })
  })
})

describe('getDefaultFrom', () => {
  test('formats from address with RFC 5322 mailbox format', () => {
    const from = getDefaultFrom()

    // Should follow format: "Display Name" <email@example.com>
    const rfc5322Pattern = /^"[^"]+"\s+<[^@]+@[^>]+>$/
    expect(from).toMatch(rfc5322Pattern)
  })

  test('returns consistent format on multiple calls', () => {
    const from1 = getDefaultFrom()
    const from2 = getDefaultFrom()

    expect(from1).toBe(from2)
    expect(from1).toMatch(/"[^"]+"\s+<[^>]+>/)
  })

  test('includes quotes around name', () => {
    const from = getDefaultFrom()

    expect(from).toMatch(/^"[^"]+"/)
  })

  test('includes angle brackets around email', () => {
    const from = getDefaultFrom()

    expect(from).toMatch(/<[^>]+>$/)
  })

  test('name and email are properly separated', () => {
    const from = getDefaultFrom()

    // Format: "Name" <email> - name and email should be distinct parts
    const parts = from.match(/^"([^"]+)"\s+<([^>]+)>$/)
    expect(parts).not.toBeNull()
    expect(parts![1]).toBeTruthy() // Name part exists
    expect(parts![2]).toBeTruthy() // Email part exists
    expect(parts![2]).toContain('@') // Email has @ symbol
  })
})
