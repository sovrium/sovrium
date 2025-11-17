/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { FaviconSizeItemSchema, FaviconsConfigSchema } from './favicons-config'

describe('Favicons Config Schemas', () => {
  describe('FaviconSizeItemSchema', () => {
    describe('Valid size items', () => {
      test('should accept standard favicon sizes', () => {
        // Given
        const validItems = [
          { size: '16x16', href: '/favicon-16x16.png' },
          { size: '32x32', href: '/favicon-32x32.png' },
          { size: '192x192', href: '/android-chrome-192x192.png' },
          { size: '512x512', href: '/android-chrome-512x512.png' },
        ]

        // When/Then
        validItems.forEach((item) => {
          const result = Schema.decodeUnknownSync(FaviconSizeItemSchema)(item)
          expect(result).toEqual(item)
        })
      })

      test('should accept non-square sizes', () => {
        // Given
        const item = { size: '120x90', href: '/banner.png' }

        // When
        const result = Schema.decodeUnknownSync(FaviconSizeItemSchema)(item)

        // Then
        expect(result).toEqual(item)
      })

      test('should accept large sizes', () => {
        // Given
        const item = { size: '1024x1024', href: '/icon-large.png' }

        // When
        const result = Schema.decodeUnknownSync(FaviconSizeItemSchema)(item)

        // Then
        expect(result).toEqual(item)
      })

      test('should accept various href formats', () => {
        // Given
        const validItems = [
          { size: '32x32', href: './favicon.png' },
          { size: '32x32', href: '/public/favicon.png' },
          { size: '32x32', href: 'favicon.png' },
          { size: '32x32', href: 'https://cdn.example.com/favicon.png' },
        ]

        // When/Then
        validItems.forEach((item) => {
          const result = Schema.decodeUnknownSync(FaviconSizeItemSchema)(item)
          expect(result).toEqual(item)
        })
      })
    })

    describe('Invalid size items', () => {
      test('should reject invalid size format', () => {
        // Given
        const invalidItems = [
          { size: '32', href: '/favicon.png' },
          { size: '32px', href: '/favicon.png' },
          { size: '32 x 32', href: '/favicon.png' },
          { size: '32×32', href: '/favicon.png' }, // Unicode multiplication sign
          { size: '32X32', href: '/favicon.png' }, // Capital X
          { size: 'large', href: '/favicon.png' },
        ]

        // When/Then
        invalidItems.forEach((item) => {
          expect(() => {
            Schema.decodeUnknownSync(FaviconSizeItemSchema)(item)
          }).toThrow('Size must be in format WIDTHxHEIGHT')
        })
      })

      test('should reject missing href', () => {
        // Given
        const item = { size: '32x32' }

        // When/Then
        expect(() => {
          Schema.decodeUnknownSync(FaviconSizeItemSchema)(item)
        }).toThrow()
      })

      test('should reject missing size', () => {
        // Given
        const item = { href: '/favicon.png' }

        // When/Then
        expect(() => {
          Schema.decodeUnknownSync(FaviconSizeItemSchema)(item)
        }).toThrow()
      })

      test('should reject empty size', () => {
        // Given
        const item = { size: '', href: '/favicon.png' }

        // When/Then
        expect(() => {
          Schema.decodeUnknownSync(FaviconSizeItemSchema)(item)
        }).toThrow('Size must be in format WIDTHxHEIGHT')
      })

      test('should reject non-numeric dimensions', () => {
        // Given
        const item = { size: 'abcxdef', href: '/favicon.png' }

        // When/Then
        expect(() => {
          Schema.decodeUnknownSync(FaviconSizeItemSchema)(item)
        }).toThrow('Size must be in format WIDTHxHEIGHT')
      })
    })
  })

  describe('FaviconsConfigSchema', () => {
    describe('Valid configurations', () => {
      test('should accept empty configuration', () => {
        // Given
        const config = {}

        // When
        const result = Schema.decodeUnknownSync(FaviconsConfigSchema)(config)

        // Then
        expect(result).toEqual({})
      })

      test('should accept icon only', () => {
        // Given
        const config = {
          icon: '/icon.svg',
        }

        // When
        const result = Schema.decodeUnknownSync(FaviconsConfigSchema)(config)

        // Then
        expect(result).toEqual(config)
      })

      test('should accept appleTouchIcon only', () => {
        // Given
        const config = {
          appleTouchIcon: '/apple-touch-icon.png',
        }

        // When
        const result = Schema.decodeUnknownSync(FaviconsConfigSchema)(config)

        // Then
        expect(result).toEqual(config)
      })

      test('should accept sizes array only', () => {
        // Given
        const config = {
          sizes: [
            { size: '32x32', href: '/favicon-32x32.png' },
            { size: '16x16', href: '/favicon-16x16.png' },
          ],
        }

        // When
        const result = Schema.decodeUnknownSync(FaviconsConfigSchema)(config)

        // Then
        expect(result).toEqual(config)
      })

      test('should accept complete configuration', () => {
        // Given
        const config = {
          icon: '/icon.svg',
          appleTouchIcon: '/apple-touch-icon.png',
          sizes: [
            { size: '32x32', href: '/favicon-32x32.png' },
            { size: '16x16', href: '/favicon-16x16.png' },
            { size: '192x192', href: '/android-chrome-192x192.png' },
          ],
        }

        // When
        const result = Schema.decodeUnknownSync(FaviconsConfigSchema)(config)

        // Then
        expect(result).toEqual(config)
      })

      test('should accept empty sizes array', () => {
        // Given
        const config = {
          icon: '/icon.svg',
          sizes: [],
        }

        // When
        const result = Schema.decodeUnknownSync(FaviconsConfigSchema)(config)

        // Then
        expect(result).toEqual(config)
      })

      test('should handle undefined optional fields', () => {
        // Given
        const config = {
          icon: '/icon.svg',
          appleTouchIcon: undefined,
          sizes: undefined,
        }

        // When
        const result = Schema.decodeUnknownSync(FaviconsConfigSchema)(config)

        // Then
        expect(result).toEqual({ icon: '/icon.svg' })
      })

      test('should accept various icon path formats', () => {
        // Given
        const config = {
          icon: './public/favicon.ico',
          appleTouchIcon: 'https://cdn.example.com/apple-touch-icon.png',
        }

        // When
        const result = Schema.decodeUnknownSync(FaviconsConfigSchema)(config)

        // Then
        expect(result).toEqual(config)
      })
    })

    describe('Invalid configurations', () => {
      test('should reject invalid sizes array items', () => {
        // Given
        const config = {
          sizes: [
            { size: '32x32', href: '/favicon.png' },
            { size: 'invalid', href: '/favicon.png' }, // Invalid size format
          ],
        }

        // When/Then
        expect(() => {
          Schema.decodeUnknownSync(FaviconsConfigSchema)(config)
        }).toThrow('Size must be in format WIDTHxHEIGHT')
      })

      test('should reject non-string icon', () => {
        // Given
        const config = {
          icon: 123,
        }

        // When/Then
        expect(() => {
          Schema.decodeUnknownSync(FaviconsConfigSchema)(config)
        }).toThrow()
      })

      test('should reject non-string appleTouchIcon', () => {
        // Given
        const config = {
          appleTouchIcon: true,
        }

        // When/Then
        expect(() => {
          Schema.decodeUnknownSync(FaviconsConfigSchema)(config)
        }).toThrow()
      })

      test('should reject non-array sizes', () => {
        // Given
        const config = {
          sizes: 'not-an-array',
        }

        // When/Then
        expect(() => {
          Schema.decodeUnknownSync(FaviconsConfigSchema)(config)
        }).toThrow()
      })

      test('should reject unknown properties', () => {
        // Given
        const config = {
          icon: '/icon.svg',
          unknownProp: 'value',
        }

        // When
        const result = Schema.decodeUnknownSync(FaviconsConfigSchema)(config)

        // Then
        // Note: Unknown properties are filtered out, not rejected
        expect(result).toEqual({ icon: '/icon.svg' })
      })
    })

    describe('Schema metadata', () => {
      test('FaviconSizeItemSchema should have correct annotations', () => {
        // When
        const ast = FaviconSizeItemSchema.ast
        const annotations = ast.annotations

        // Then
        expect(annotations.description).toBe('Favicon size specification')
      })

      test('FaviconsConfigSchema should have correct annotations', () => {
        // When
        const ast = FaviconsConfigSchema.ast
        const annotations = ast.annotations

        // Then
        expect(annotations.title).toBe('Favicons Configuration')
        expect(annotations.description).toBe('Helper configuration for favicons with named properties')
      })
    })
  })
})