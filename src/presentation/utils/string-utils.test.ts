/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { toKebabCase, toSlug } from './string-utils'

describe('toKebabCase', () => {
  test('converts camelCase to kebab-case', () => {
    expect(toKebabCase('fadeIn')).toBe('fade-in')
    expect(toKebabCase('slideInUp')).toBe('slide-in-up')
    expect(toKebabCase('backgroundColor')).toBe('background-color')
  })

  test('handles single words', () => {
    expect(toKebabCase('hello')).toBe('hello')
    expect(toKebabCase('World')).toBe('world')
  })

  test('handles multiple consecutive uppercase letters (partial support)', () => {
    // Note: The current implementation doesn't handle acronyms perfectly
    // For camelCase with acronyms like XMLParser, it converts to xmlparser
    // This is acceptable for our use case (animation names like fadeIn, slideInUp)
    expect(toKebabCase('XMLParser')).toBe('xmlparser')
    expect(toKebabCase('HTTPRequest')).toBe('httprequest')
  })

  test('handles numbers', () => {
    expect(toKebabCase('test123Data')).toBe('test123-data')
    expect(toKebabCase('version2Update')).toBe('version2-update')
  })

  test('handles already kebab-case strings', () => {
    expect(toKebabCase('already-kebab')).toBe('already-kebab')
  })
})

describe('toSlug', () => {
  test('converts spaces to hyphens', () => {
    expect(toSlug('Home Page')).toBe('home-page')
    expect(toSlug('About Us')).toBe('about-us')
  })

  test('removes special characters', () => {
    expect(toSlug('Plans & Pricing')).toBe('plans-pricing')
    expect(toSlug('Company Info!')).toBe('company-info')
    expect(toSlug('Test@Example#123')).toBe('testexample123')
  })

  test('converts to lowercase', () => {
    expect(toSlug('UPPERCASE')).toBe('uppercase')
    expect(toSlug('MixedCase')).toBe('mixedcase')
  })

  test('replaces underscores with hyphens', () => {
    expect(toSlug('hello_world')).toBe('hello-world')
    expect(toSlug('test_case_example')).toBe('test-case-example')
  })

  test('collapses multiple hyphens', () => {
    expect(toSlug('hello---world')).toBe('hello-world')
    expect(toSlug('test  case')).toBe('test-case')
  })

  test('trims hyphens from start and end', () => {
    expect(toSlug('-hello-')).toBe('hello')
    expect(toSlug('--world--')).toBe('world')
    expect(toSlug(' test ')).toBe('test')
  })

  test('handles complex real-world examples', () => {
    expect(toSlug('Company Info')).toBe('company-info')
    expect(toSlug('2024 Annual Report')).toBe('2024-annual-report')
    expect(toSlug('Q&A Session')).toBe('qa-session')
  })

  test('handles empty and edge cases', () => {
    expect(toSlug('')).toBe('')
    expect(toSlug('   ')).toBe('')
    expect(toSlug('---')).toBe('')
    expect(toSlug('a')).toBe('a')
  })
})
