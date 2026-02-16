/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import type { UserSession } from './user-session'

describe('UserSession interface', () => {
  test('should have correct shape with all required fields', () => {
    const session: UserSession = {
      id: 'session-123',
      userId: 'user-456',
      token: 'token-789',
      expiresAt: new Date('2025-12-31T23:59:59Z'),
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-15T12:00:00Z'),
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      impersonatedBy: null,
    }

    expect(session.id).toBe('session-123')
    expect(session.userId).toBe('user-456')
    expect(session.token).toBe('token-789')
    expect(session.expiresAt).toBeInstanceOf(Date)
    expect(session.createdAt).toBeInstanceOf(Date)
    expect(session.updatedAt).toBeInstanceOf(Date)
    expect(session.ipAddress).toBe('192.168.1.1')
    expect(session.userAgent).toBe('Mozilla/5.0')
    expect(session.impersonatedBy).toBeNull()
  })

  test('should allow null values for optional fields', () => {
    const session: UserSession = {
      id: 'session-123',
      userId: 'user-456',
      token: 'token-789',
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
      impersonatedBy: null,
    }

    expect(session.ipAddress).toBeNull()
    expect(session.userAgent).toBeNull()
    expect(session.impersonatedBy).toBeNull()
  })

  test('should support impersonation scenario', () => {
    const session: UserSession = {
      id: 'session-123',
      userId: 'user-456',
      token: 'token-789',
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: '127.0.0.1',
      userAgent: 'admin-panel',
      impersonatedBy: 'admin-789',
    }

    expect(session.impersonatedBy).toBe('admin-789')
  })

  test('should be readonly (structural test)', () => {
    const session: UserSession = {
      id: 'session-123',
      userId: 'user-456',
      token: 'token-789',
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      impersonatedBy: null,
    }

    // TypeScript enforces readonly at compile time
    // This test documents the immutability contract
    expect(session).toBeDefined()
    expect(Object.isFrozen(session)).toBe(false) // Not frozen at runtime, but readonly in types
  })

  test('should have valid date objects', () => {
    const now = new Date()
    const future = new Date(Date.now() + 3_600_000) // 1 hour from now

    const session: UserSession = {
      id: 'session-123',
      userId: 'user-456',
      token: 'token-789',
      expiresAt: future,
      createdAt: now,
      updatedAt: now,
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      impersonatedBy: null,
    }

    expect(session.expiresAt.getTime()).toBeGreaterThan(session.createdAt.getTime())
    expect(session.updatedAt.getTime()).toBeGreaterThanOrEqual(session.createdAt.getTime())
  })
})
