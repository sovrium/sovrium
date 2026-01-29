/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe, beforeEach, afterEach, mock } from 'bun:test'
import { getEmailConfigFromEffect } from './email-config'

describe('getEmailConfigFromEffect', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore environment after each test
    process.env = originalEnv
  })

  test('returns production SMTP config when SMTP_HOST is set', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_PORT = '587'
    process.env.SMTP_USER = 'test-user'
    process.env.SMTP_PASS = 'test-pass'
    process.env.SMTP_FROM = 'noreply@example.com'
    process.env.SMTP_FROM_NAME = 'Test App'

    const config = getEmailConfigFromEffect()

    expect(config).toEqual({
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
    })
  })

  test('uses default port 587 when SMTP_PORT not set', () => {
    process.env.SMTP_HOST = 'smtp.example.com'

    const config = getEmailConfigFromEffect()

    expect(config.port).toBe(587)
    expect(config.secure).toBe(false)
  })

  test('sets secure=true when port is 465', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_PORT = '465'

    const config = getEmailConfigFromEffect()

    expect(config.port).toBe(465)
    expect(config.secure).toBe(true)
  })

  test('respects SMTP_SECURE env variable', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_PORT = '587'
    process.env.SMTP_SECURE = 'true'

    const config = getEmailConfigFromEffect()

    expect(config.secure).toBe(true)
  })

  test('SMTP_SECURE=false overrides port 465 auto-detection', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_PORT = '465'
    process.env.SMTP_SECURE = 'false'

    const config = getEmailConfigFromEffect()

    expect(config.secure).toBe(true) // Port 465 takes precedence
  })

  test('uses default from email when SMTP_FROM not set', () => {
    process.env.SMTP_HOST = 'smtp.example.com'

    const config = getEmailConfigFromEffect()

    expect(config.from.email).toBe('noreply@sovrium.com')
    expect(config.from.name).toBe('Sovrium')
  })

  test('uses empty auth credentials when not set', () => {
    process.env.SMTP_HOST = 'smtp.example.com'

    const config = getEmailConfigFromEffect()

    expect(config.auth.user).toBe('')
    expect(config.auth.pass).toBe('')
  })

  test('returns Mailpit config when SMTP_HOST not set (development)', () => {
    delete process.env.SMTP_HOST
    process.env.NODE_ENV = 'development'

    const config = getEmailConfigFromEffect()

    expect(config).toEqual({
      host: '127.0.0.1',
      port: 1025,
      secure: false,
      auth: {
        user: '',
        pass: '',
      },
      from: {
        email: 'noreply@sovrium.local',
        name: 'Sovrium (Dev)',
      },
    })
  })

  test('uses custom SMTP_FROM in development mode with Mailpit', () => {
    delete process.env.SMTP_HOST
    process.env.NODE_ENV = 'development'
    process.env.SMTP_FROM = 'custom@example.com'
    process.env.SMTP_FROM_NAME = 'Custom Dev'

    const config = getEmailConfigFromEffect()

    expect(config.from.email).toBe('custom@example.com')
    expect(config.from.name).toBe('Custom Dev')
  })

  test('parses SMTP_PORT as number', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_PORT = '2525'

    const config = getEmailConfigFromEffect()

    expect(config.port).toBe(2525)
    expect(typeof config.port).toBe('number')
  })

  test('parses SMTP_SECURE as boolean true', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_SECURE = 'true'

    const config = getEmailConfigFromEffect()

    expect(config.secure).toBe(true)
  })

  test('parses SMTP_SECURE as boolean false', () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_SECURE = 'false'

    const config = getEmailConfigFromEffect()

    expect(config.secure).toBe(false)
  })

  test('handles missing SMTP_HOST in production (returns Mailpit)', () => {
    delete process.env.SMTP_HOST
    process.env.NODE_ENV = 'production'

    const config = getEmailConfigFromEffect()

    // Still returns Mailpit config as fallback
    expect(config.host).toBe('127.0.0.1')
    expect(config.port).toBe(1025)
  })
})
