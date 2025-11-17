/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { HttpUrlSchema } from './url'

describe('HttpUrlSchema', () => {
  describe('Valid URLs', () => {
    test('should accept HTTPS URL with domain', () => {
      // Given
      const url = 'https://example.com'

      // When
      const result = Schema.decodeUnknownSync(HttpUrlSchema)(url)

      // Then
      expect(result).toBe(url)
    })

    test('should accept HTTP URL with domain', () => {
      // Given
      const url = 'http://example.com'

      // When
      const result = Schema.decodeUnknownSync(HttpUrlSchema)(url)

      // Then
      expect(result).toBe(url)
    })

    test('should accept HTTPS URL with path', () => {
      // Given
      const url = 'https://example.com/path/to/resource'

      // When
      const result = Schema.decodeUnknownSync(HttpUrlSchema)(url)

      // Then
      expect(result).toBe(url)
    })

    test('should accept HTTPS URL with query parameters', () => {
      // Given
      const url = 'https://example.com/search?q=test&page=1'

      // When
      const result = Schema.decodeUnknownSync(HttpUrlSchema)(url)

      // Then
      expect(result).toBe(url)
    })

    test('should accept HTTPS URL with fragment', () => {
      // Given
      const url = 'https://example.com/page#section'

      // When
      const result = Schema.decodeUnknownSync(HttpUrlSchema)(url)

      // Then
      expect(result).toBe(url)
    })

    test('should accept HTTPS URL with port', () => {
      // Given
      const url = 'https://example.com:8080/api'

      // When
      const result = Schema.decodeUnknownSync(HttpUrlSchema)(url)

      // Then
      expect(result).toBe(url)
    })

    test('should accept HTTP URL with subdomain', () => {
      // Given
      const url = 'http://api.example.com/endpoint'

      // When
      const result = Schema.decodeUnknownSync(HttpUrlSchema)(url)

      // Then
      expect(result).toBe(url)
    })

    test('should accept HTTPS URL with multiple subdomains', () => {
      // Given
      const url = 'https://www.blog.example.com'

      // When
      const result = Schema.decodeUnknownSync(HttpUrlSchema)(url)

      // Then
      expect(result).toBe(url)
    })

    test('should accept HTTPS URL with authentication', () => {
      // Given
      const url = 'https://user:pass@example.com/secure'

      // When
      const result = Schema.decodeUnknownSync(HttpUrlSchema)(url)

      // Then
      expect(result).toBe(url)
    })

    test('should accept localhost URLs', () => {
      // Given
      const httpUrl = 'http://localhost:3000'
      const httpsUrl = 'https://localhost:8080/api'

      // When
      const httpResult = Schema.decodeUnknownSync(HttpUrlSchema)(httpUrl)
      const httpsResult = Schema.decodeUnknownSync(HttpUrlSchema)(httpsUrl)

      // Then
      expect(httpResult).toBe(httpUrl)
      expect(httpsResult).toBe(httpsUrl)
    })

    test('should accept IP address URLs', () => {
      // Given
      const url = 'http://192.168.1.1:8080'

      // When
      const result = Schema.decodeUnknownSync(HttpUrlSchema)(url)

      // Then
      expect(result).toBe(url)
    })

    test('should accept URLs with complex paths', () => {
      // Given
      const url = 'https://cdn.example.com/assets/images/logo-v2.1.0.png'

      // When
      const result = Schema.decodeUnknownSync(HttpUrlSchema)(url)

      // Then
      expect(result).toBe(url)
    })
  })

  describe('Invalid URLs', () => {
    test('should reject FTP protocol', () => {
      // Given
      const url = 'ftp://example.com/file.txt'

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(HttpUrlSchema)(url)
      }).toThrow('URL must start with http:// or https://')
    })

    test('should reject file protocol', () => {
      // Given
      const url = 'file:///path/to/file.html'

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(HttpUrlSchema)(url)
      }).toThrow('URL must start with http:// or https://')
    })

    test('should reject relative paths', () => {
      // Given
      const url = '/path/to/resource'

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(HttpUrlSchema)(url)
      }).toThrow('URL must start with http:// or https://')
    })

    test('should reject URLs without protocol', () => {
      // Given
      const url = 'example.com'

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(HttpUrlSchema)(url)
      }).toThrow('URL must start with http:// or https://')
    })

    test('should reject mailto links', () => {
      // Given
      const url = 'mailto:user@example.com'

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(HttpUrlSchema)(url)
      }).toThrow('URL must start with http:// or https://')
    })

    test('should reject tel links', () => {
      // Given
      const url = 'tel:+1234567890'

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(HttpUrlSchema)(url)
      }).toThrow('URL must start with http:// or https://')
    })

    test('should reject data URLs', () => {
      // Given
      const url = 'data:text/plain;base64,SGVsbG8gV29ybGQ='

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(HttpUrlSchema)(url)
      }).toThrow('URL must start with http:// or https://')
    })

    test('should reject WebSocket protocol', () => {
      // Given
      const url = 'ws://example.com/socket'

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(HttpUrlSchema)(url)
      }).toThrow('URL must start with http:// or https://')
    })

    test('should reject empty string', () => {
      // Given
      const url = ''

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(HttpUrlSchema)(url)
      }).toThrow('URL must start with http:// or https://')
    })

    test('should reject non-string values', () => {
      // Given
      const invalidInputs = [null, undefined, 123, true, {}, []]

      // When/Then
      invalidInputs.forEach((input) => {
        expect(() => {
          Schema.decodeUnknownSync(HttpUrlSchema)(input)
        }).toThrow()
      })
    })
  })

  describe('Schema metadata', () => {
    test('should have correct annotations', () => {
      // When
      const ast = HttpUrlSchema.ast
      const annotations = ast.annotations

      // Then
      expect(annotations.description).toBe('HTTP/HTTPS URL')
      expect(annotations.format).toBe('uri')
    })
  })
})