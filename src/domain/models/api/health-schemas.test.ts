/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { healthResponseSchema } from './health-schemas'

describe('Health Schemas', () => {
  describe('healthResponseSchema', () => {
    describe('Valid health responses', () => {
      test('should accept valid health response', () => {
        // Given
        const response = {
          status: 'ok' as const,
          timestamp: '2024-01-15T10:30:00.000Z',
          app: {
            name: 'My Application',
          },
        }

        // When
        const result = healthResponseSchema.parse(response)

        // Then
        expect(result).toEqual(response)
      })

      test('should accept timestamp with timezone offset', () => {
        // Given
        const response = {
          status: 'ok' as const,
          timestamp: '2024-01-15T10:30:00.000+02:00',
          app: {
            name: 'Test App',
          },
        }

        // When
        const result = healthResponseSchema.parse(response)

        // Then
        expect(result).toEqual(response)
      })

      test('should accept timestamp with negative offset', () => {
        // Given
        const response = {
          status: 'ok' as const,
          timestamp: '2024-01-15T10:30:00.000-05:00',
          app: {
            name: 'Production App',
          },
        }

        // When
        const result = healthResponseSchema.parse(response)

        // Then
        expect(result).toEqual(response)
      })

      test('should accept timestamp with milliseconds', () => {
        // Given
        const response = {
          status: 'ok' as const,
          timestamp: '2024-01-15T10:30:00.123Z',
          app: {
            name: 'App with Milliseconds',
          },
        }

        // When
        const result = healthResponseSchema.parse(response)

        // Then
        expect(result).toEqual(response)
      })

      test('should accept various app names', () => {
        // Given
        const appNames = [
          'Sovrium',
          'My Application',
          'Test-App-123',
          'app_v2.0',
          'Production Service',
          '',
        ]

        // When/Then
        appNames.forEach((name) => {
          const response = {
            status: 'ok' as const,
            timestamp: '2024-01-15T10:30:00.000Z',
            app: { name },
          }
          const result = healthResponseSchema.parse(response)
          expect(result.app.name).toBe(name)
        })
      })

      test('should accept current timestamp', () => {
        // Given
        const response = {
          status: 'ok' as const,
          timestamp: new Date().toISOString(),
          app: {
            name: 'Current Time App',
          },
        }

        // When
        const result = healthResponseSchema.parse(response)

        // Then
        expect(result.timestamp).toBe(response.timestamp)
      })
    })

    describe('Invalid health responses', () => {
      test('should reject status other than "ok"', () => {
        // Given
        const invalidStatuses = ['error', 'healthy', 'OK', 'success', 'true']

        // When/Then
        invalidStatuses.forEach((status) => {
          const response = {
            status,
            timestamp: '2024-01-15T10:30:00.000Z',
            app: { name: 'Test' },
          }
          expect(() => {
            healthResponseSchema.parse(response)
          }).toThrow()
        })
      })

      test('should reject missing status', () => {
        // Given
        const response = {
          timestamp: '2024-01-15T10:30:00.000Z',
          app: { name: 'Test' },
        }

        // When/Then
        expect(() => {
          healthResponseSchema.parse(response)
        }).toThrow()
      })

      test('should reject missing timestamp', () => {
        // Given
        const response = {
          status: 'ok' as const,
          app: { name: 'Test' },
        }

        // When/Then
        expect(() => {
          healthResponseSchema.parse(response)
        }).toThrow()
      })

      test('should reject missing app', () => {
        // Given
        const response = {
          status: 'ok' as const,
          timestamp: '2024-01-15T10:30:00.000Z',
        }

        // When/Then
        expect(() => {
          healthResponseSchema.parse(response)
        }).toThrow()
      })

      test('should reject missing app.name', () => {
        // Given
        const response = {
          status: 'ok' as const,
          timestamp: '2024-01-15T10:30:00.000Z',
          app: {},
        }

        // When/Then
        expect(() => {
          healthResponseSchema.parse(response)
        }).toThrow()
      })

      test('should reject invalid timestamp formats', () => {
        // Given
        const invalidTimestamps = [
          '2024-01-15', // Date only
          '10:30:00', // Time only
          '2024/01/15 10:30:00', // Wrong format
          'January 15, 2024', // Human readable
          '2024-01-15T10:30:00', // No milliseconds/timezone
          '2024-01-15T10:30', // Missing seconds
          'not-a-date',
        ]

        // When/Then
        invalidTimestamps.forEach((timestamp) => {
          const response = {
            status: 'ok' as const,
            timestamp,
            app: { name: 'Test' },
          }
          expect(() => {
            healthResponseSchema.parse(response)
          }).toThrow()
        })
      })

      test('should reject non-string app.name', () => {
        // Given
        const invalidNames = [123, true, null, undefined, {}, []]

        // When/Then
        invalidNames.forEach((name) => {
          const response = {
            status: 'ok' as const,
            timestamp: '2024-01-15T10:30:00.000Z',
            app: { name },
          }
          expect(() => {
            healthResponseSchema.parse(response)
          }).toThrow()
        })
      })

      test('should reject extra properties in root', () => {
        // Given
        const response = {
          status: 'ok' as const,
          timestamp: '2024-01-15T10:30:00.000Z',
          app: { name: 'Test' },
          extraProp: 'should be rejected',
        }

        // When
        const result = healthResponseSchema.parse(response)

        // Then
        // Zod strips unknown keys by default
        expect(result).not.toHaveProperty('extraProp')
        expect(result).toEqual({
          status: 'ok' as const,
          timestamp: '2024-01-15T10:30:00.000Z',
          app: { name: 'Test' },
        })
      })

      test('should reject extra properties in app', () => {
        // Given
        const response = {
          status: 'ok' as const,
          timestamp: '2024-01-15T10:30:00.000Z',
          app: {
            name: 'Test',
            version: '1.0.0', // Extra property
          },
        }

        // When
        const result = healthResponseSchema.parse(response)

        // Then
        // Zod strips unknown keys by default
        expect(result.app).not.toHaveProperty('version')
        expect(result).toEqual({
          status: 'ok' as const,
          timestamp: '2024-01-15T10:30:00.000Z',
          app: { name: 'Test' },
        })
      })

      test('should reject null response', () => {
        // Given
        const response = null

        // When/Then
        expect(() => {
          healthResponseSchema.parse(response)
        }).toThrow()
      })

      test('should reject undefined response', () => {
        // Given
        const response = undefined

        // When/Then
        expect(() => {
          healthResponseSchema.parse(response)
        }).toThrow()
      })

      test('should reject non-object response', () => {
        // Given
        const invalidResponses = ['string', 123, true, []]

        // When/Then
        invalidResponses.forEach((response) => {
          expect(() => {
            healthResponseSchema.parse(response)
          }).toThrow()
        })
      })
    })

    describe('Type safety', () => {
      test('should infer correct TypeScript type', () => {
        // Given
        const response = {
          status: 'ok' as const,
          timestamp: '2024-01-15T10:30:00.000Z',
          app: {
            name: 'Type Test',
          },
        }

        // When
        const parsed = healthResponseSchema.parse(response)

        // Then
        // TypeScript compile-time check (implicit via type inference)
        // Runtime check
        expect(parsed.status).toBe('ok')
        expect(typeof parsed.timestamp).toBe('string')
        expect(typeof parsed.app.name).toBe('string')
      })
    })

    describe('Schema metadata', () => {
      test('should have description for status field', () => {
        // When
        const statusSchema = healthResponseSchema.shape.status

        // Then
        expect(statusSchema.description).toBe('Server health status indicator')
      })

      test('should have description for timestamp field', () => {
        // When
        const timestampSchema = healthResponseSchema.shape.timestamp

        // Then
        expect(timestampSchema.description).toBe('ISO 8601 timestamp of the health check')
      })

      test('should have description for app field', () => {
        // When
        const appSchema = healthResponseSchema.shape.app

        // Then
        expect(appSchema.description).toBe('Application metadata')
      })

      test('should have description for app.name field', () => {
        // When
        const appNameSchema = healthResponseSchema.shape.app.shape.name

        // Then
        expect(appNameSchema.description).toBe('Application name from configuration')
      })
    })
  })
})
