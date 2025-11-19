/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { findMatchingRoute, matchRoute } from './route-matcher'

describe('matchRoute', () => {
  test('matches static route exactly', () => {
    const result = matchRoute('/about', '/about')
    expect(result.matched).toBe(true)
    expect(result.params).toEqual({})
  })

  test('does not match different static route', () => {
    const result = matchRoute('/about', '/contact')
    expect(result.matched).toBe(false)
    expect(result.params).toEqual({})
  })

  test('matches root path', () => {
    const result = matchRoute('/', '/')
    expect(result.matched).toBe(true)
    expect(result.params).toEqual({})
  })

  test('matches dynamic route with single parameter', () => {
    const result = matchRoute('/blog/:slug', '/blog/hello-world')
    expect(result.matched).toBe(true)
    expect(result.params).toEqual({ slug: 'hello-world' })
  })

  test('matches dynamic route with numeric parameter', () => {
    const result = matchRoute('/products/:id', '/products/123')
    expect(result.matched).toBe(true)
    expect(result.params).toEqual({ id: '123' })
  })

  test('matches dynamic route with multiple parameters', () => {
    const result = matchRoute('/users/:userId/posts/:postId', '/users/123/posts/456')
    expect(result.matched).toBe(true)
    expect(result.params).toEqual({ userId: '123', postId: '456' })
  })

  test('does not match dynamic route with wrong prefix', () => {
    const result = matchRoute('/blog/:slug', '/products/hello-world')
    expect(result.matched).toBe(false)
    expect(result.params).toEqual({})
  })

  test('does not match dynamic route with missing segment', () => {
    const result = matchRoute('/blog/:slug', '/blog')
    expect(result.matched).toBe(false)
    expect(result.params).toEqual({})
  })

  test('does not match dynamic route with extra segment', () => {
    const result = matchRoute('/blog/:slug', '/blog/hello-world/extra')
    expect(result.matched).toBe(false)
    expect(result.params).toEqual({})
  })

  test('matches dynamic parameter with hyphens', () => {
    const result = matchRoute('/blog/:slug', '/blog/hello-world-test')
    expect(result.matched).toBe(true)
    expect(result.params).toEqual({ slug: 'hello-world-test' })
  })

  test('matches nested static path with dynamic parameter', () => {
    const result = matchRoute('/api/v1/users/:id', '/api/v1/users/123')
    expect(result.matched).toBe(true)
    expect(result.params).toEqual({ id: '123' })
  })
})

describe('findMatchingRoute', () => {
  test('finds matching static route', () => {
    const patterns = ['/about', '/contact', '/pricing']
    const result = findMatchingRoute(patterns, '/contact')
    expect(result).toEqual({ index: 1, params: {} })
  })

  test('finds matching dynamic route', () => {
    const patterns = ['/about', '/blog/:slug', '/products/:id']
    const result = findMatchingRoute(patterns, '/blog/hello-world')
    expect(result).toEqual({ index: 1, params: { slug: 'hello-world' } })
  })

  test('returns first match when multiple patterns could match', () => {
    const patterns = ['/blog/:slug', '/blog/featured']
    const result = findMatchingRoute(patterns, '/blog/featured')
    // First pattern matches (dynamic route)
    expect(result).toEqual({ index: 0, params: { slug: 'featured' } })
  })

  test('returns undefined when no route matches', () => {
    const patterns = ['/about', '/blog/:slug', '/products/:id']
    const result = findMatchingRoute(patterns, '/not-found')
    expect(result).toBeUndefined()
  })

  test('handles empty patterns array', () => {
    const result = findMatchingRoute([], '/about')
    expect(result).toBeUndefined()
  })

  test('finds route with multiple parameters', () => {
    const patterns = ['/about', '/users/:userId/posts/:postId']
    const result = findMatchingRoute(patterns, '/users/123/posts/456')
    expect(result).toEqual({ index: 1, params: { userId: '123', postId: '456' } })
  })
})
