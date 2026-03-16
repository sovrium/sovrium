/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import {
  userSchema,
  userWithRoleSchema,
  sessionSchema,
  sessionWithUserSchema,
  signInResponseSchema,
  signUpResponseSchema,
  signOutResponseSchema,
  getSessionResponseSchema,
  listSessionsResponseSchema,
  revokeSessionResponseSchema,
  forgotPasswordResponseSchema,
  resetPasswordResponseSchema,
  changePasswordResponseSchema,
  verifyEmailResponseSchema,
  sendVerificationEmailResponseSchema,
  adminListUsersResponseSchema,
  adminGetUserResponseSchema,
  adminUpdateUserResponseSchema,
  adminDeleteUserResponseSchema,
  adminBanUserResponseSchema,
  adminUnbanUserResponseSchema,
} from './auth'

const validTimestamps = {
  createdAt: '2025-01-15T10:30:00Z',
  updatedAt: '2025-01-15T11:00:00Z',
}

const validUser = {
  id: 'user_1',
  email: 'alice@example.com',
  name: 'Alice',
  emailVerified: true,
  ...validTimestamps,
}

const validSession = {
  id: 'sess_1',
  userId: 'user_1',
  token: 'tok_abc123',
  expiresAt: '2025-02-15T10:30:00Z',
  ...validTimestamps,
}

describe('userSchema', () => {
  test('validates complete user', () => {
    const result = userSchema.parse(validUser)
    expect(result.email).toBe('alice@example.com')
    expect(result.name).toBe('Alice')
  })

  test('accepts nullable name', () => {
    const result = userSchema.parse({ ...validUser, name: null })
    expect(result.name).toBeNull()
  })

  test('accepts optional nullable image', () => {
    const result = userSchema.parse({ ...validUser, image: 'https://example.com/avatar.png' })
    expect(result.image).toBe('https://example.com/avatar.png')
  })

  test('accepts null image', () => {
    const result = userSchema.parse({ ...validUser, image: null })
    expect(result.image).toBeNull()
  })

  test('rejects invalid email', () => {
    expect(() => userSchema.parse({ ...validUser, email: 'not-an-email' })).toThrow()
  })

  test('rejects missing required fields', () => {
    expect(() => userSchema.parse({ id: 'user_1' })).toThrow()
  })
})

describe('userWithRoleSchema', () => {
  const validUserWithRole = { ...validUser, role: 'admin' as const }

  test('validates user with role', () => {
    const result = userWithRoleSchema.parse(validUserWithRole)
    expect(result.role).toBe('admin')
  })

  test('accepts user role', () => {
    const result = userWithRoleSchema.parse({ ...validUser, role: 'user' })
    expect(result.role).toBe('user')
  })

  test('rejects invalid role', () => {
    expect(() => userWithRoleSchema.parse({ ...validUser, role: 'superadmin' })).toThrow()
  })

  test('accepts optional ban fields', () => {
    const result = userWithRoleSchema.parse({
      ...validUserWithRole,
      banned: true,
      banReason: 'Violated TOS',
      banExpiresAt: '2025-06-01T00:00:00Z',
    })
    expect(result.banned).toBe(true)
    expect(result.banReason).toBe('Violated TOS')
  })

  test('accepts null ban fields', () => {
    const result = userWithRoleSchema.parse({
      ...validUserWithRole,
      banReason: null,
      banExpiresAt: null,
    })
    expect(result.banReason).toBeNull()
    expect(result.banExpiresAt).toBeNull()
  })
})

describe('sessionSchema', () => {
  test('validates complete session', () => {
    const result = sessionSchema.parse(validSession)
    expect(result.userId).toBe('user_1')
    expect(result.token).toBe('tok_abc123')
  })

  test('accepts optional nullable fields', () => {
    const result = sessionSchema.parse({
      ...validSession,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    })
    expect(result.ipAddress).toBe('192.168.1.1')
  })

  test('accepts null for optional fields', () => {
    const result = sessionSchema.parse({
      ...validSession,
      ipAddress: null,
      userAgent: null,
    })
    expect(result.ipAddress).toBeNull()
  })

  test('rejects missing token', () => {
    const { token: _, ...noToken } = validSession
    expect(() => sessionSchema.parse(noToken)).toThrow()
  })
})

describe('sessionWithUserSchema', () => {
  test('validates session with user', () => {
    const result = sessionWithUserSchema.parse({
      session: validSession,
      user: validUser,
    })
    expect(result.session.id).toBe('sess_1')
    expect(result.user.email).toBe('alice@example.com')
  })

  test('rejects missing session', () => {
    expect(() => sessionWithUserSchema.parse({ user: validUser })).toThrow()
  })
})

describe('signInResponseSchema', () => {
  test('validates sign-in response', () => {
    const result = signInResponseSchema.parse({
      user: validUser,
      session: validSession,
    })
    expect(result.user.id).toBe('user_1')
    expect(result.session.token).toBe('tok_abc123')
  })

  test('accepts optional token', () => {
    const result = signInResponseSchema.parse({
      user: validUser,
      session: validSession,
      token: 'bearer_xyz',
    })
    expect(result.token).toBe('bearer_xyz')
  })
})

describe('signUpResponseSchema', () => {
  test('validates sign-up with session', () => {
    const result = signUpResponseSchema.parse({
      user: validUser,
      session: validSession,
    })
    expect(result.user.email).toBe('alice@example.com')
  })

  test('validates sign-up without session (no auto-login)', () => {
    const result = signUpResponseSchema.parse({ user: validUser })
    expect(result.session).toBeUndefined()
    expect(result.token).toBeUndefined()
  })
})

describe('signOutResponseSchema', () => {
  test('validates sign-out response', () => {
    const result = signOutResponseSchema.parse({ success: true })
    expect(result.success).toBe(true)
  })

  test('rejects false success', () => {
    expect(() => signOutResponseSchema.parse({ success: false })).toThrow()
  })
})

describe('getSessionResponseSchema', () => {
  test('validates get session response', () => {
    const result = getSessionResponseSchema.parse({
      session: validSession,
      user: validUser,
    })
    expect(result.session.userId).toBe('user_1')
    expect(result.user.name).toBe('Alice')
  })
})

describe('listSessionsResponseSchema', () => {
  test('validates sessions list', () => {
    const result = listSessionsResponseSchema.parse({
      sessions: [validSession],
    })
    expect(result.sessions).toHaveLength(1)
  })

  test('validates empty sessions list', () => {
    const result = listSessionsResponseSchema.parse({ sessions: [] })
    expect(result.sessions).toEqual([])
  })
})

describe('revokeSessionResponseSchema', () => {
  test('validates revoke response', () => {
    const result = revokeSessionResponseSchema.parse({ success: true })
    expect(result.success).toBe(true)
  })
})

describe('password response schemas', () => {
  test('forgotPasswordResponseSchema validates', () => {
    const result = forgotPasswordResponseSchema.parse({ success: true })
    expect(result.success).toBe(true)
  })

  test('resetPasswordResponseSchema validates', () => {
    const result = resetPasswordResponseSchema.parse({ success: true })
    expect(result.success).toBe(true)
  })

  test('changePasswordResponseSchema validates', () => {
    const result = changePasswordResponseSchema.parse({ success: true })
    expect(result.success).toBe(true)
  })

  test('all reject false success', () => {
    expect(() => forgotPasswordResponseSchema.parse({ success: false })).toThrow()
    expect(() => resetPasswordResponseSchema.parse({ success: false })).toThrow()
    expect(() => changePasswordResponseSchema.parse({ success: false })).toThrow()
  })
})

describe('verification response schemas', () => {
  test('verifyEmailResponseSchema validates', () => {
    const result = verifyEmailResponseSchema.parse({ user: validUser })
    expect(result.user.emailVerified).toBe(true)
  })

  test('sendVerificationEmailResponseSchema validates', () => {
    const result = sendVerificationEmailResponseSchema.parse({ success: true })
    expect(result.success).toBe(true)
  })
})

describe('admin response schemas', () => {
  const validAdminUser = { ...validUser, role: 'admin' as const }

  test('adminListUsersResponseSchema validates paginated list', () => {
    const result = adminListUsersResponseSchema.parse({
      users: [validAdminUser],
      total: 1,
      page: 1,
      limit: 20,
    })
    expect(result.users).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  test('adminListUsersResponseSchema validates empty list', () => {
    const result = adminListUsersResponseSchema.parse({
      users: [],
      total: 0,
      page: 1,
      limit: 20,
    })
    expect(result.users).toEqual([])
  })

  test('adminListUsersResponseSchema validates list with banned user', () => {
    const bannedUser = {
      ...validAdminUser,
      banned: true,
      banReason: 'Spam activity',
      banExpiresAt: '2025-06-01T00:00:00Z',
    }
    const result = adminListUsersResponseSchema.parse({
      users: [validAdminUser, bannedUser],
      total: 2,
      page: 1,
      limit: 20,
    })
    expect(result.users).toHaveLength(2)
    expect(result.users[1]?.banned).toBe(true)
    expect(result.users[1]?.banReason).toBe('Spam activity')
  })

  test('adminGetUserResponseSchema validates', () => {
    const result = adminGetUserResponseSchema.parse({ user: validAdminUser })
    expect(result.user.role).toBe('admin')
  })

  test('adminUpdateUserResponseSchema validates', () => {
    const result = adminUpdateUserResponseSchema.parse({ user: validAdminUser })
    expect(result.user.id).toBe('user_1')
  })

  test('adminDeleteUserResponseSchema validates', () => {
    const result = adminDeleteUserResponseSchema.parse({ success: true })
    expect(result.success).toBe(true)
  })

  test('adminBanUserResponseSchema validates banned user', () => {
    const bannedUser = { ...validAdminUser, banned: true, banReason: 'Spam' }
    const result = adminBanUserResponseSchema.parse({ user: bannedUser })
    expect(result.user.banned).toBe(true)
  })

  test('adminUnbanUserResponseSchema validates', () => {
    const result = adminUnbanUserResponseSchema.parse({ user: validAdminUser })
    expect(result.user.role).toBe('admin')
  })
})
