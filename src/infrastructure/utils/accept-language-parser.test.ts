/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { parseAcceptLanguage, detectLanguageFromHeader } from './accept-language-parser'

describe('parseAcceptLanguage', () => {
  test('should parse simple language list', () => {
    const result = parseAcceptLanguage('en-US,fr-FR,es-ES')
    expect(result).toEqual(['en-US', 'fr-FR', 'es-ES'])
  })

  test('should parse with quality values', () => {
    const result = parseAcceptLanguage('en-US,en;q=0.9,fr;q=0.8')
    expect(result).toEqual(['en-US', 'en', 'fr'])
  })

  test('should sort by quality descending', () => {
    const result = parseAcceptLanguage('fr;q=0.8,en-US;q=1.0,es;q=0.5')
    expect(result).toEqual(['en-US', 'fr', 'es'])
  })

  test('should handle missing quality as 1.0', () => {
    const result = parseAcceptLanguage('en-US,fr;q=0.9')
    expect(result).toEqual(['en-US', 'fr'])
  })

  test('should filter out invalid entries', () => {
    const result = parseAcceptLanguage('en-US,;q=0.9,fr-FR')
    expect(result).toEqual(['en-US', 'fr-FR'])
  })

  test('should handle null/undefined', () => {
    expect(parseAcceptLanguage(null)).toEqual([])
    expect(parseAcceptLanguage(undefined)).toEqual([])
    expect(parseAcceptLanguage('')).toEqual([])
  })

  test('should handle whitespace', () => {
    const result = parseAcceptLanguage(' en-US , fr-FR ; q=0.9 ')
    expect(result).toEqual(['en-US', 'fr-FR'])
  })
})

describe('detectLanguageFromHeader', () => {
  const supported = ['en-US', 'fr-FR', 'es-ES']

  test('should match exact language', () => {
    const result = detectLanguageFromHeader('fr-FR,en-US', supported)
    expect(result).toBe('fr-FR')
  })

  test('should match base language', () => {
    const result = detectLanguageFromHeader('fr-CA,en-GB', supported)
    expect(result).toBe('fr-FR') // 'fr' base matches 'fr-FR'
  })

  test('should respect quality order', () => {
    const result = detectLanguageFromHeader('es;q=0.5,fr;q=1.0', supported)
    expect(result).toBe('fr-FR')
  })

  test('should return undefined if no match', () => {
    const result = detectLanguageFromHeader('de-DE,ja-JP', supported)
    expect(result).toBeUndefined()
  })

  test('should handle null/undefined', () => {
    expect(detectLanguageFromHeader(null, supported)).toBeUndefined()
    expect(detectLanguageFromHeader(undefined, supported)).toBeUndefined()
    expect(detectLanguageFromHeader('', supported)).toBeUndefined()
  })

  test('should prefer exact match over base match', () => {
    const result = detectLanguageFromHeader('fr-CA,fr-FR;q=0.9', supported)
    expect(result).toBe('fr-FR') // Exact match wins even with lower quality
  })
})
