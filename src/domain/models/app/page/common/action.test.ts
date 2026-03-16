/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import {
  ActionSchema,
  AuthActionSchema,
  CrudActionSchema,
  FilterActionSchema,
  ToastSchema,
  ActionResponseSchema,
} from './action'

describe('ToastSchema', () => {
  test('should accept toast with message only', () => {
    const result = Schema.decodeUnknownSync(ToastSchema)({
      message: 'Success!',
    })
    expect(result.message).toBe('Success!')
    expect(result.variant).toBeUndefined()
  })

  test('should accept toast with message and variant', () => {
    const result = Schema.decodeUnknownSync(ToastSchema)({
      message: 'Record saved',
      variant: 'success',
    })
    expect(result.variant).toBe('success')
  })

  test('should accept all toast variants', () => {
    for (const variant of ['success', 'error', 'warning', 'info'] as const) {
      const result = Schema.decodeUnknownSync(ToastSchema)({
        message: 'test',
        variant,
      })
      expect(result.variant).toBe(variant)
    }
  })
})

describe('ActionResponseSchema', () => {
  test('should accept navigate only', () => {
    const result = Schema.decodeUnknownSync(ActionResponseSchema)({
      navigate: '/dashboard',
    })
    expect(result.navigate).toBe('/dashboard')
  })

  test('should accept toast only', () => {
    const result = Schema.decodeUnknownSync(ActionResponseSchema)({
      toast: { message: 'Done!', variant: 'success' },
    })
    expect(result.toast?.message).toBe('Done!')
  })

  test('should accept both navigate and toast', () => {
    const result = Schema.decodeUnknownSync(ActionResponseSchema)({
      navigate: '/home',
      toast: { message: 'Welcome!', variant: 'info' },
    })
    expect(result.navigate).toBe('/home')
    expect(result.toast?.variant).toBe('info')
  })
})

describe('AuthActionSchema', () => {
  test('should accept login action with email strategy', () => {
    const result = Schema.decodeUnknownSync(AuthActionSchema)({
      type: 'auth',
      method: 'login',
      strategy: 'email',
    })
    expect(result.type).toBe('auth')
    expect(result.method).toBe('login')
    expect(result.strategy).toBe('email')
  })

  test('should accept signup action with response handlers', () => {
    const result = Schema.decodeUnknownSync(AuthActionSchema)({
      type: 'auth',
      method: 'signup',
      strategy: 'email',
      onSuccess: { navigate: '/dashboard' },
      onError: { toast: { message: 'Signup failed', variant: 'error' } },
    })
    expect(result.onSuccess?.navigate).toBe('/dashboard')
    expect(result.onError?.toast?.variant).toBe('error')
  })

  test('should accept oauth action with provider', () => {
    const result = Schema.decodeUnknownSync(AuthActionSchema)({
      type: 'auth',
      method: 'login',
      strategy: 'oauth',
      provider: 'google',
    })
    expect(result.strategy).toBe('oauth')
    expect(result.provider).toBe('google')
  })

  test('should accept logout action', () => {
    const result = Schema.decodeUnknownSync(AuthActionSchema)({
      type: 'auth',
      method: 'logout',
      onSuccess: { navigate: '/' },
    })
    expect(result.method).toBe('logout')
  })

  test('should accept all auth methods', () => {
    for (const method of ['login', 'signup', 'logout', 'resetPassword', 'verifyEmail'] as const) {
      const result = Schema.decodeUnknownSync(AuthActionSchema)({
        type: 'auth',
        method,
      })
      expect(result.method).toBe(method)
    }
  })
})

describe('CrudActionSchema', () => {
  test('should accept create action', () => {
    const result = Schema.decodeUnknownSync(CrudActionSchema)({
      type: 'crud',
      operation: 'create',
      table: 'posts',
    })
    expect(result.type).toBe('crud')
    expect(result.operation).toBe('create')
    expect(result.table).toBe('posts')
  })

  test('should accept update action with response handlers', () => {
    const result = Schema.decodeUnknownSync(CrudActionSchema)({
      type: 'crud',
      operation: 'update',
      table: 'posts',
      onSuccess: {
        navigate: '/posts',
        toast: { message: 'Post updated!', variant: 'success' },
      },
    })
    expect(result.onSuccess?.navigate).toBe('/posts')
  })

  test('should accept delete action', () => {
    const result = Schema.decodeUnknownSync(CrudActionSchema)({
      type: 'crud',
      operation: 'delete',
      table: 'comments',
    })
    expect(result.operation).toBe('delete')
    expect(result.table).toBe('comments')
  })

  test('should reject invalid operation', () => {
    expect(() =>
      Schema.decodeUnknownSync(CrudActionSchema)({
        type: 'crud',
        operation: 'upsert',
        table: 'posts',
      })
    ).toThrow()
  })
})

describe('FilterActionSchema', () => {
  test('should accept filter action', () => {
    const result = Schema.decodeUnknownSync(FilterActionSchema)({
      type: 'filter',
      targetDataSource: 'product-list',
      field: 'category',
    })
    expect(result.type).toBe('filter')
    expect(result.targetDataSource).toBe('product-list')
    expect(result.field).toBe('category')
  })

  test('should accept filter action with operator', () => {
    const result = Schema.decodeUnknownSync(FilterActionSchema)({
      type: 'filter',
      targetDataSource: 'product-list',
      field: 'price',
      operator: 'lte',
    })
    expect(result.operator).toBe('lte')
  })
})

describe('ActionSchema (discriminated union)', () => {
  test('should discriminate auth action by type', () => {
    const result = Schema.decodeUnknownSync(ActionSchema)({
      type: 'auth',
      method: 'login',
      strategy: 'email',
    })
    expect(result.type).toBe('auth')
  })

  test('should discriminate crud action by type', () => {
    const result = Schema.decodeUnknownSync(ActionSchema)({
      type: 'crud',
      operation: 'create',
      table: 'posts',
    })
    expect(result.type).toBe('crud')
  })

  test('should discriminate filter action by type', () => {
    const result = Schema.decodeUnknownSync(ActionSchema)({
      type: 'filter',
      targetDataSource: 'list',
      field: 'status',
    })
    expect(result.type).toBe('filter')
  })

  test('should reject unknown action type', () => {
    expect(() =>
      Schema.decodeUnknownSync(ActionSchema)({
        type: 'unknown',
      })
    ).toThrow()
  })

  test('should reject action without type', () => {
    expect(() =>
      Schema.decodeUnknownSync(ActionSchema)({
        method: 'login',
      })
    ).toThrow()
  })
})
