/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import {
  FontWeightSchema,
  FontStyleSchema,
  FontTransformSchema,
  FontCategoryKeySchema,
  FontConfigItemSchema,
  FontsConfigSchema,
} from './fonts'

describe('FontWeightSchema', () => {
  test('should accept valid font weights (100-900)', () => {
    // GIVEN: Valid font weight values
    const weights = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const

    // WHEN: Schema validation is performed on each
    const results = weights.map((w) => Schema.decodeUnknownSync(FontWeightSchema)(w))

    // THEN: All weights should be accepted
    expect(results).toEqual([...weights])
  })

  test('should reject invalid font weights', () => {
    // GIVEN: Invalid font weight values
    const invalidWeights = [0, 50, 150, 450, 1000, -100]

    // WHEN: Schema validation is performed on each
    // THEN: All should be rejected
    invalidWeights.forEach((weight) => {
      expect(() => Schema.decodeUnknownSync(FontWeightSchema)(weight)).toThrow()
    })
  })
})

describe('FontStyleSchema', () => {
  test('should accept valid font styles', () => {
    // GIVEN: Valid font styles
    const styles = ['normal', 'italic', 'oblique'] as const

    // WHEN: Schema validation is performed on each
    const results = styles.map((s) => Schema.decodeUnknownSync(FontStyleSchema)(s))

    // THEN: All styles should be accepted
    expect(results).toEqual([...styles])
  })

  test('should reject invalid font styles', () => {
    // GIVEN: Invalid font styles
    const invalidStyles = ['bold', 'underline', 'ITALIC', '']

    // WHEN: Schema validation is performed on each
    // THEN: All should be rejected
    invalidStyles.forEach((style) => {
      expect(() => Schema.decodeUnknownSync(FontStyleSchema)(style)).toThrow()
    })
  })
})

describe('FontTransformSchema', () => {
  test('should accept valid text transformations', () => {
    // GIVEN: Valid text transformations
    const transforms = ['none', 'uppercase', 'lowercase', 'capitalize'] as const

    // WHEN: Schema validation is performed on each
    const results = transforms.map((t) => Schema.decodeUnknownSync(FontTransformSchema)(t))

    // THEN: All transformations should be accepted
    expect(results).toEqual([...transforms])
  })

  test('should reject invalid transformations', () => {
    // GIVEN: Invalid transformations
    const invalidTransforms = ['UPPERCASE', 'Capitalize', 'title-case', '']

    // WHEN: Schema validation is performed on each
    // THEN: All should be rejected
    invalidTransforms.forEach((transform) => {
      expect(() => Schema.decodeUnknownSync(FontTransformSchema)(transform)).toThrow()
    })
  })
})

describe('FontCategoryKeySchema', () => {
  test('should accept alphabetic category keys', () => {
    // GIVEN: Valid alphabetic keys
    const keys = ['title', 'body', 'mono', 'heading', 'label', 'TITLE', 'Body']

    // WHEN: Schema validation is performed on each
    const results = keys.map((k) => Schema.decodeUnknownSync(FontCategoryKeySchema)(k))

    // THEN: All keys should be accepted
    expect(results).toEqual(keys)
  })

  test('should reject non-alphabetic keys', () => {
    // GIVEN: Invalid keys with numbers, hyphens, underscores, or spaces
    const invalidKeys = ['title1', 'body-text', 'mono_space', 'heading 1', '', '123']

    // WHEN: Schema validation is performed on each
    // THEN: All should be rejected
    invalidKeys.forEach((key) => {
      expect(() => Schema.decodeUnknownSync(FontCategoryKeySchema)(key)).toThrow()
    })
  })
})

describe('FontConfigItemSchema', () => {
  test('APP-THEME-FONTS-001: should validate font with only family (minimal config)', () => {
    // GIVEN: A font with only family defined
    const font = {
      family: 'Inter',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FontConfigItemSchema)(font)

    // THEN: Font should be valid (only family is required)
    expect(result.family).toBe('Inter')
    expect(result.fallback).toBeUndefined()
  })

  test('APP-THEME-FONTS-002: should validate font with family and fallback stack', () => {
    // GIVEN: A font with family and fallback fonts
    const font = {
      family: 'Inter',
      fallback: 'system-ui, sans-serif',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FontConfigItemSchema)(font)

    // THEN: Font should provide graceful fallback
    expect(result.family).toBe('Inter')
    expect(result.fallback).toBe('system-ui, sans-serif')
  })

  test('APP-THEME-FONTS-003: should validate font with multiple weights', () => {
    // GIVEN: A font with multiple weight options
    const font = {
      family: 'Inter',
      weights: [300, 400, 500, 600, 700] as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FontConfigItemSchema)(font)

    // THEN: Font should support various weight options
    expect(result.family).toBe('Inter')
    expect(result.weights).toEqual([300, 400, 500, 600, 700])
  })

  test('APP-THEME-FONTS-004: should validate font with italic style', () => {
    // GIVEN: A font with italic style
    const font = {
      family: 'Georgia',
      style: 'italic' as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FontConfigItemSchema)(font)

    // THEN: Font should support normal, italic, or oblique styles
    expect(result.family).toBe('Georgia')
    expect(result.style).toBe('italic')
  })

  test('APP-THEME-FONTS-005: should validate font with size and lineHeight', () => {
    // GIVEN: A font with default size and line spacing
    const font = {
      family: 'Inter',
      size: '16px',
      lineHeight: '1.5',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FontConfigItemSchema)(font)

    // THEN: Font should establish baseline typography metrics
    expect(result.family).toBe('Inter')
    expect(result.size).toBe('16px')
    expect(result.lineHeight).toBe('1.5')
  })

  test('APP-THEME-FONTS-006: should validate font with letterSpacing', () => {
    // GIVEN: A font with letter spacing for display text
    const font = {
      family: 'Bely Display',
      letterSpacing: '0.05em',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FontConfigItemSchema)(font)

    // THEN: Font should support character spacing for readability
    expect(result.family).toBe('Bely Display')
    expect(result.letterSpacing).toBe('0.05em')
  })

  test('APP-THEME-FONTS-007: should validate font with text transformation', () => {
    // GIVEN: A font with uppercase transformation
    const font = {
      family: 'Inter',
      transform: 'uppercase' as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FontConfigItemSchema)(font)

    // THEN: Font should support text transformations
    expect(result.family).toBe('Inter')
    expect(result.transform).toBe('uppercase')
  })

  test('APP-THEME-FONTS-008: should validate font with Google Fonts URL', () => {
    // GIVEN: A font loaded from external source
    const font = {
      family: 'Inter',
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300..700',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FontConfigItemSchema)(font)

    // THEN: Font URL should be validated for remote loading
    expect(result.family).toBe('Inter')
    expect(result.url).toBe('https://fonts.googleapis.com/css2?family=Inter:wght@300..700')
  })

  test('APP-THEME-FONTS-009: should validate complete font config with all properties', () => {
    // GIVEN: A fully configured font
    const font = {
      family: 'Inter',
      fallback: 'system-ui, sans-serif',
      weights: [400, 700] as const,
      style: 'normal' as const,
      size: '16px',
      lineHeight: '1.5',
      letterSpacing: '0',
      transform: 'none' as const,
      url: 'https://fonts.googleapis.com/css2?family=Inter',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FontConfigItemSchema)(font)

    // THEN: All properties should be validated
    expect(result.family).toBe('Inter')
    expect(result.fallback).toBe('system-ui, sans-serif')
    expect(result.weights).toEqual([400, 700])
  })

  test('should reject font missing required family property', () => {
    // GIVEN: A font config missing family
    const font = {
      fallback: 'sans-serif',
      weights: [400, 700],
    }

    // WHEN: Schema validation is performed
    // THEN: Font should be rejected
    expect(() => Schema.decodeUnknownSync(FontConfigItemSchema)(font)).toThrow()
  })

  test('should reject font with invalid weight', () => {
    // GIVEN: A font with invalid weight value
    const font = {
      family: 'Inter',
      weights: [400, 750 as unknown as 100], // 750 is invalid (must be 100-900 in increments of 100)
    }

    // WHEN: Schema validation is performed
    // THEN: Font should be rejected
    expect(() => Schema.decodeUnknownSync(FontConfigItemSchema)(font)).toThrow()
  })
})

describe('FontsConfigSchema', () => {
  test('APP-THEME-FONTS-010: should validate multiple font categories (title, body, mono)', () => {
    // GIVEN: A theme with different fonts for headings, body, and code
    const fonts = {
      title: {
        family: 'Bely Display',
        fallback: 'Georgia, serif',
      },
      body: {
        family: 'Inter',
        fallback: 'system-ui, sans-serif',
      },
      mono: {
        family: 'JetBrains Mono',
        fallback: 'monospace',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FontsConfigSchema)(fonts)

    // THEN: Semantic font system should be validated for all UI contexts
    expect(result.title!.family).toBe('Bely Display')
    expect(result.body!.family).toBe('Inter')
    expect(result.mono!.family).toBe('JetBrains Mono')
  })

  test('should accept single font category', () => {
    // GIVEN: A fonts config with single category
    const fonts = {
      body: {
        family: 'Inter',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FontsConfigSchema)(fonts)

    // THEN: Single category should be valid
    expect(result.body!.family).toBe('Inter')
  })

  test('should accept empty fonts config', () => {
    // GIVEN: An empty fonts config
    const fonts = {}

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FontsConfigSchema)(fonts)

    // THEN: Empty config should be valid
    expect(result).toEqual({})
  })

  test('should filter out font categories with invalid key format', () => {
    // GIVEN: A fonts config with invalid key (hyphen not allowed)
    const fonts = {
      'body-text': {
        // hyphen not allowed - will be filtered out
        family: 'Inter',
      },
      body: {
        // valid key
        family: 'Arial',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FontsConfigSchema)(fonts)

    // THEN: Invalid keys should be filtered out, valid keys retained
    expect(result['body-text']).toBeUndefined()
    expect(result.body!.family).toBe('Arial')
  })

  test('should accept complex typography system', () => {
    // GIVEN: A comprehensive typography system
    const fonts = {
      title: {
        family: 'Bely Display',
        fallback: 'Georgia, serif',
        weights: [400, 700],
        transform: 'lowercase' as const,
        letterSpacing: '0.05em',
      },
      body: {
        family: 'Inter',
        fallback: 'system-ui, sans-serif',
        weights: [300, 400, 500, 600, 700],
        size: '16px',
        lineHeight: '1.5',
      },
      mono: {
        family: 'JetBrains Mono',
        fallback: 'monospace',
        weights: [400, 700],
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FontsConfigSchema)(fonts)

    // THEN: All font categories should be valid
    expect(Object.keys(result)).toEqual(['title', 'body', 'mono'])
    expect(result.title!.family).toBe('Bely Display')
    expect(result.body!.size).toBe('16px')
    expect(result.mono!.fallback).toBe('monospace')
  })
})
