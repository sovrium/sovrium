/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { validateTableName, validateColumnName } from './validation'

describe('validateTableName', () => {
  describe('valid table names', () => {
    test('accepts simple lowercase table name', () => {
      expect(() => validateTableName('users')).not.toThrow()
    })

    test('accepts table name with underscores', () => {
      expect(() => validateTableName('user_profiles')).not.toThrow()
    })

    test('accepts table name starting with underscore', () => {
      expect(() => validateTableName('_internal_table')).not.toThrow()
    })

    test('accepts table name with numbers', () => {
      expect(() => validateTableName('table123')).not.toThrow()
      expect(() => validateTableName('user_v2')).not.toThrow()
    })

    test('accepts uppercase letters', () => {
      expect(() => validateTableName('Users')).not.toThrow()
      expect(() => validateTableName('USER_PROFILES')).not.toThrow()
    })

    test('accepts mixed case', () => {
      expect(() => validateTableName('UserProfiles')).not.toThrow()
    })

    test('accepts maximum length (63 characters)', () => {
      const maxLengthName = 'a'.repeat(63)
      expect(() => validateTableName(maxLengthName)).not.toThrow()
    })
  })

  describe('invalid table names (SQL injection prevention)', () => {
    test('rejects table name with spaces', () => {
      expect(() => validateTableName('user profiles')).toThrow('Invalid table name')
    })

    test('rejects table name with hyphens', () => {
      expect(() => validateTableName('user-profiles')).toThrow('Invalid table name')
    })

    test('rejects table name with dots', () => {
      expect(() => validateTableName('schema.users')).toThrow('Invalid table name')
    })

    test('rejects table name with semicolons (SQL injection attempt)', () => {
      expect(() => validateTableName('users; DROP TABLE users;--')).toThrow('Invalid table name')
    })

    test('rejects table name with quotes (SQL injection attempt)', () => {
      expect(() => validateTableName("users' OR '1'='1")).toThrow('Invalid table name')
      expect(() => validateTableName('users" OR "1"="1')).toThrow('Invalid table name')
    })

    test('rejects table name with parentheses', () => {
      expect(() => validateTableName('users()')).toThrow('Invalid table name')
    })

    test('rejects table name with SQL keywords', () => {
      expect(() => validateTableName('SELECT * FROM users')).toThrow('Invalid table name')
    })

    test('rejects table name starting with number', () => {
      expect(() => validateTableName('123users')).toThrow('Invalid table name')
    })

    test('rejects table name with special characters', () => {
      expect(() => validateTableName('users@domain')).toThrow('Invalid table name')
      expect(() => validateTableName('users#hash')).toThrow('Invalid table name')
      expect(() => validateTableName('users$money')).toThrow('Invalid table name')
      expect(() => validateTableName('users%percent')).toThrow('Invalid table name')
    })

    test('rejects table name exceeding PostgreSQL limit (64+ characters)', () => {
      const tooLongName = 'a'.repeat(64)
      expect(() => validateTableName(tooLongName)).toThrow('Invalid table name')
    })

    test('rejects empty table name', () => {
      expect(() => validateTableName('')).toThrow('Invalid table name')
    })

    test('rejects table name with backslashes', () => {
      expect(() => validateTableName('users\\escape')).toThrow('Invalid table name')
    })

    test('rejects table name with forward slashes', () => {
      expect(() => validateTableName('users/profiles')).toThrow('Invalid table name')
    })
  })
})

describe('validateColumnName', () => {
  describe('valid column names', () => {
    test('accepts simple lowercase column name', () => {
      expect(() => validateColumnName('email')).not.toThrow()
    })

    test('accepts column name with underscores', () => {
      expect(() => validateColumnName('first_name')).not.toThrow()
    })

    test('accepts column name starting with underscore', () => {
      expect(() => validateColumnName('_id')).not.toThrow()
    })

    test('accepts column name with numbers', () => {
      expect(() => validateColumnName('field123')).not.toThrow()
      expect(() => validateColumnName('version_2')).not.toThrow()
    })

    test('accepts uppercase letters', () => {
      expect(() => validateColumnName('Email')).not.toThrow()
      expect(() => validateColumnName('FIRST_NAME')).not.toThrow()
    })

    test('accepts mixed case', () => {
      expect(() => validateColumnName('firstName')).not.toThrow()
    })

    test('accepts maximum length (63 characters)', () => {
      const maxLengthName = 'a'.repeat(63)
      expect(() => validateColumnName(maxLengthName)).not.toThrow()
    })
  })

  describe('invalid column names (SQL injection prevention)', () => {
    test('rejects column name with spaces', () => {
      expect(() => validateColumnName('first name')).toThrow('Invalid column name')
    })

    test('rejects column name with hyphens', () => {
      expect(() => validateColumnName('first-name')).toThrow('Invalid column name')
    })

    test('rejects column name with dots', () => {
      expect(() => validateColumnName('table.column')).toThrow('Invalid column name')
    })

    test('rejects column name with semicolons (SQL injection attempt)', () => {
      expect(() => validateColumnName('email; DROP TABLE users;--')).toThrow('Invalid column name')
    })

    test('rejects column name with quotes (SQL injection attempt)', () => {
      expect(() => validateColumnName("email' OR '1'='1")).toThrow('Invalid column name')
      expect(() => validateColumnName('email" OR "1"="1')).toThrow('Invalid column name')
    })

    test('rejects column name with parentheses', () => {
      expect(() => validateColumnName('count()')).toThrow('Invalid column name')
    })

    test('rejects column name with SQL keywords', () => {
      expect(() => validateColumnName('SELECT email FROM users')).toThrow('Invalid column name')
    })

    test('rejects column name starting with number', () => {
      expect(() => validateColumnName('123field')).toThrow('Invalid column name')
    })

    test('rejects column name with special characters', () => {
      expect(() => validateColumnName('email@domain')).toThrow('Invalid column name')
      expect(() => validateColumnName('field#hash')).toThrow('Invalid column name')
      expect(() => validateColumnName('price$amount')).toThrow('Invalid column name')
      expect(() => validateColumnName('percent%value')).toThrow('Invalid column name')
    })

    test('rejects column name exceeding PostgreSQL limit (64+ characters)', () => {
      const tooLongName = 'a'.repeat(64)
      expect(() => validateColumnName(tooLongName)).toThrow('Invalid column name')
    })

    test('rejects empty column name', () => {
      expect(() => validateColumnName('')).toThrow('Invalid column name')
    })

    test('rejects column name with backslashes', () => {
      expect(() => validateColumnName('field\\escape')).toThrow('Invalid column name')
    })

    test('rejects column name with forward slashes', () => {
      expect(() => validateColumnName('field/path')).toThrow('Invalid column name')
    })
  })
})
