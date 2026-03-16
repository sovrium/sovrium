/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test'
import { isCssValue, isTailwindClass } from './style-utils'

describe('isCssValue', () => {
  test('should return true for CSS values with rem units', () => {
    expect(isCssValue('4rem')).toBe(true)
    expect(isCssValue('80rem')).toBe(true)
    expect(isCssValue('1.5rem')).toBe(true)
  })

  test('should return true for CSS values with px units', () => {
    expect(isCssValue('100px')).toBe(true)
    expect(isCssValue('1280px')).toBe(true)
    expect(isCssValue('16px')).toBe(true)
  })

  test('should return true for CSS values with em units', () => {
    expect(isCssValue('2em')).toBe(true)
    expect(isCssValue('0.5em')).toBe(true)
  })

  test('should return true for CSS values with percentage units', () => {
    expect(isCssValue('100%')).toBe(true)
    expect(isCssValue('50%')).toBe(true)
  })

  test('should return true for CSS values with vh/vw units', () => {
    expect(isCssValue('100vh')).toBe(true)
    expect(isCssValue('50vw')).toBe(true)
  })

  test('should return false for Tailwind utility classes without spaces', () => {
    expect(isCssValue('py-16')).toBe(false)
    expect(isCssValue('px-4')).toBe(false)
    expect(isCssValue('max-w-7xl')).toBe(false)
  })

  test('should return false for Tailwind utility classes with spaces', () => {
    expect(isCssValue('py-16 sm:py-20')).toBe(false)
    expect(isCssValue('max-w-7xl mx-auto px-4')).toBe(false)
  })

  test('should return false for plain text without units', () => {
    expect(isCssValue('auto')).toBe(false)
    expect(isCssValue('inherit')).toBe(false)
  })
})

describe('isTailwindClass', () => {
  test('should return true for Tailwind classes with spaces (multiple classes)', () => {
    expect(isTailwindClass('max-w-7xl mx-auto px-4')).toBe(true)
    expect(isTailwindClass('py-16 sm:py-20')).toBe(true)
  })

  test('should return true for Tailwind utility classes matching patterns', () => {
    expect(isTailwindClass('max-w-7xl')).toBe(true)
    expect(isTailwindClass('mx-auto')).toBe(true)
    expect(isTailwindClass('px-4')).toBe(true)
    expect(isTailwindClass('py-16')).toBe(true)
    expect(isTailwindClass('p-4')).toBe(true)
    expect(isTailwindClass('m-2')).toBe(true)
    expect(isTailwindClass('w-full')).toBe(true)
    expect(isTailwindClass('h-screen')).toBe(true)
  })

  test('should return false for CSS values with units', () => {
    expect(isTailwindClass('80rem')).toBe(false)
    expect(isTailwindClass('1280px')).toBe(false)
    expect(isTailwindClass('100%')).toBe(false)
    expect(isTailwindClass('4rem')).toBe(false)
  })

  test('should return false for plain text without Tailwind patterns', () => {
    expect(isTailwindClass('auto')).toBe(false)
    expect(isTailwindClass('inherit')).toBe(false)
  })
})
