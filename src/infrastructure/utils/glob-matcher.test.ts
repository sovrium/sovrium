/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { matchGlobPattern, matchesAnyGlobPattern } from './glob-matcher'

describe('matchGlobPattern', () => {
  test('exact match', () => {
    expect(matchGlobPattern('/admin', '/admin')).toBe(true)
    expect(matchGlobPattern('/admin', '/admin/dashboard')).toBe(false)
    expect(matchGlobPattern('/admin', '/other')).toBe(false)
  })

  test('wildcard suffix', () => {
    expect(matchGlobPattern('/admin/*', '/admin/dashboard')).toBe(true)
    expect(matchGlobPattern('/admin/*', '/admin/users/123')).toBe(true)
    expect(matchGlobPattern('/admin/*', '/admin/')).toBe(true)
    expect(matchGlobPattern('/admin/*', '/admin')).toBe(false)
    expect(matchGlobPattern('/admin/*', '/other/dashboard')).toBe(false)
  })

  test('wildcard prefix', () => {
    expect(matchGlobPattern('*/api', '/v1/api')).toBe(true)
    expect(matchGlobPattern('*/api', '/public/api')).toBe(true)
    expect(matchGlobPattern('*/api', '/api')).toBe(true)
    expect(matchGlobPattern('*/api', '/api/users')).toBe(false)
  })

  test('wildcard in middle', () => {
    expect(matchGlobPattern('/admin/*/users', '/admin/123/users')).toBe(true)
    expect(matchGlobPattern('/admin/*/users', '/admin/abc/users')).toBe(true)
    expect(matchGlobPattern('/admin/*/users', '/admin/users')).toBe(false)
  })

  test('multiple wildcards', () => {
    expect(matchGlobPattern('/api/*/v*', '/api/users/v1')).toBe(true)
    expect(matchGlobPattern('/api/*/v*', '/api/posts/v2')).toBe(true)
    expect(matchGlobPattern('/api/*/v*', '/api/users/other')).toBe(false)
  })

  test('special regex characters are escaped', () => {
    expect(matchGlobPattern('/api/users.json', '/api/users.json')).toBe(true)
    expect(matchGlobPattern('/api/users.json', '/api/usersxjson')).toBe(false)
    expect(matchGlobPattern('/api/[users]', '/api/[users]')).toBe(true)
  })
})

describe('matchesAnyGlobPattern', () => {
  test('returns false for empty patterns array', () => {
    expect(matchesAnyGlobPattern([], '/admin/dashboard')).toBe(false)
  })

  test('returns false for undefined patterns', () => {
    expect(matchesAnyGlobPattern(undefined, '/admin/dashboard')).toBe(false)
  })

  test('returns true if any pattern matches', () => {
    const patterns = ['/api/*', '/admin/*', '/internal/*']
    expect(matchesAnyGlobPattern(patterns, '/admin/dashboard')).toBe(true)
    expect(matchesAnyGlobPattern(patterns, '/api/users')).toBe(true)
    expect(matchesAnyGlobPattern(patterns, '/internal/tools')).toBe(true)
  })

  test('returns false if no pattern matches', () => {
    const patterns = ['/api/*', '/admin/*']
    expect(matchesAnyGlobPattern(patterns, '/public/page')).toBe(false)
  })

  test('works with single pattern', () => {
    expect(matchesAnyGlobPattern(['/admin/*'], '/admin/dashboard')).toBe(true)
    expect(matchesAnyGlobPattern(['/admin/*'], '/other/page')).toBe(false)
  })
})
