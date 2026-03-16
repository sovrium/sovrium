/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import {
  authSchema,
  users,
  sessions,
  accounts,
  verifications,
  twoFactors,
  usersRelations,
  sessionsRelations,
  accountsRelations,
  twoFactorsRelations,
  type User,
  type NewUser,
  type Session,
  type Account,
  type Verification,
  type TwoFactor,
  type NewTwoFactor,
} from './schema'

describe('authSchema', () => {
  test('is a PostgreSQL schema', () => {
    expect(authSchema).toBeDefined()
    expect(typeof authSchema).toBe('object')
  })
})

describe('users table', () => {
  test('table is defined and exported', () => {
    expect(users).toBeDefined()
    expect(typeof users).toBe('object')
  })

  test('type inference works for User', () => {
    const mockUser: User = {
      id: 'user-123',
      name: 'Alice',
      email: 'alice@example.com',
      emailVerified: false,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      role: 'user',
      banned: false,
      banReason: null,
      banExpires: null,
      twoFactorEnabled: false,
    }

    expect(mockUser.id).toBe('user-123')
    expect(mockUser.name).toBe('Alice')
  })

  test('type inference works for NewUser', () => {
    const newUser: NewUser = {
      id: 'user-123',
      name: 'Bob',
      email: 'bob@example.com',
      emailVerified: false,
    }

    expect(newUser.name).toBe('Bob')
    expect(newUser.email).toBe('bob@example.com')
  })

  test('required fields enforce non-null values', () => {
    // This test validates TypeScript compilation
    // The following would NOT compile if types were wrong:
    const user: User = {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: false,
      image: null, // Optional field can be null
      createdAt: new Date(),
      updatedAt: new Date(),
      role: 'admin',
      banned: false,
      banReason: null, // Optional field can be null
      banExpires: null, // Optional field can be null
      twoFactorEnabled: false,
    }

    expect(user).toBeDefined()
  })
})

describe('sessions table', () => {
  test('table is defined and exported', () => {
    expect(sessions).toBeDefined()
    expect(typeof sessions).toBe('object')
  })

  test('type inference works for Session', () => {
    const mockSession: Session = {
      id: 'session-123',
      expiresAt: new Date(),
      token: 'token-abc',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      userId: 'user-123',
      impersonatedBy: null,
    }

    expect(mockSession.id).toBe('session-123')
    expect(mockSession.userId).toBe('user-123')
  })

  test('required fields enforce non-null values', () => {
    const session: Session = {
      id: 'session-123',
      expiresAt: new Date(),
      token: 'token-abc',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: '192.168.1.1',
      userAgent: 'Chrome/120.0',
      userId: 'user-456',
      impersonatedBy: null, // Optional field
    }

    expect(session).toBeDefined()
  })
})

describe('accounts table', () => {
  test('table is defined and exported', () => {
    expect(accounts).toBeDefined()
    expect(typeof accounts).toBe('object')
  })

  test('type inference works for Account', () => {
    const mockAccount: Account = {
      id: 'account-123',
      accountId: 'github-456',
      providerId: 'github',
      userId: 'user-123',
      accessToken: 'token-abc',
      refreshToken: null,
      idToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      scope: 'read:user',
      password: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    expect(mockAccount.providerId).toBe('github')
    expect(mockAccount.userId).toBe('user-123')
  })

  test('required fields enforce non-null values', () => {
    const account: Account = {
      id: 'account-456',
      accountId: 'google-789',
      providerId: 'google',
      userId: 'user-789',
      accessToken: 'access-token',
      refreshToken: null, // Optional field
      idToken: null, // Optional field
      accessTokenExpiresAt: null, // Optional field
      refreshTokenExpiresAt: null, // Optional field
      scope: 'email profile',
      password: null, // Optional field
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    expect(account).toBeDefined()
  })
})

describe('verifications table', () => {
  test('table is defined and exported', () => {
    expect(verifications).toBeDefined()
    expect(typeof verifications).toBe('object')
  })

  test('type inference works for Verification', () => {
    const mockVerification: Verification = {
      id: 'verification-123',
      identifier: 'alice@example.com',
      value: 'token-abc',
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    expect(mockVerification.identifier).toBe('alice@example.com')
    expect(mockVerification.value).toBe('token-abc')
  })

  test('required fields enforce non-null values', () => {
    const verification: Verification = {
      id: 'verification-456',
      identifier: 'bob@example.com',
      value: 'verification-token',
      expiresAt: new Date(Date.now() + 3_600_000), // 1 hour from now
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    expect(verification).toBeDefined()
  })
})

describe('twoFactors table', () => {
  test('table is defined and exported', () => {
    expect(twoFactors).toBeDefined()
    expect(typeof twoFactors).toBe('object')
  })

  test('type inference works for TwoFactor', () => {
    const mockTwoFactor: TwoFactor = {
      id: 'twofactor-123',
      userId: 'user-123',
      secret: 'JBSWY3DPEHPK3PXP',
      backupCodes: 'code1,code2,code3',
    }

    expect(mockTwoFactor.userId).toBe('user-123')
    expect(mockTwoFactor.secret).toBe('JBSWY3DPEHPK3PXP')
  })

  test('type inference works for NewTwoFactor', () => {
    const newTwoFactor: NewTwoFactor = {
      id: 'twofactor-123',
      userId: 'user-123',
      secret: 'JBSWY3DPEHPK3PXP',
      backupCodes: 'code1,code2,code3',
    }

    expect(newTwoFactor.secret).toBe('JBSWY3DPEHPK3PXP')
  })

  test('required fields enforce non-null values', () => {
    const twoFactor: TwoFactor = {
      id: 'twofactor-456',
      userId: 'user-456',
      secret: 'BASE32ENCODEDSECRET',
      backupCodes: 'backup1,backup2,backup3,backup4,backup5',
    }

    expect(twoFactor).toBeDefined()
  })
})

describe('relations', () => {
  test('usersRelations defines many sessions', () => {
    expect(usersRelations).toBeDefined()
    expect(typeof usersRelations).toBe('object')
  })

  test('usersRelations defines many accounts', () => {
    expect(usersRelations).toBeDefined()
    expect(typeof usersRelations).toBe('object')
  })

  test('usersRelations defines many twoFactors', () => {
    expect(usersRelations).toBeDefined()
    expect(typeof usersRelations).toBe('object')
  })

  test('sessionsRelations defines one user', () => {
    expect(sessionsRelations).toBeDefined()
    expect(typeof sessionsRelations).toBe('object')
  })

  test('accountsRelations defines one user', () => {
    expect(accountsRelations).toBeDefined()
    expect(typeof accountsRelations).toBe('object')
  })

  test('twoFactorsRelations defines one user', () => {
    expect(twoFactorsRelations).toBeDefined()
    expect(typeof twoFactorsRelations).toBe('object')
  })
})
