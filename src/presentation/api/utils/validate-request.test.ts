/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect, mock } from 'bun:test'
import { z } from 'zod'
import { validateRequest } from './validate-request'
import type { Context } from 'hono'

// Helper to create a mock Hono context with request body
const createMockContext = (body: unknown) => {
  const jsonResponses: Array<{ data: unknown; status: number }> = []

  return {
    req: {
      json: mock(async () => {
        if (typeof body === 'string' && body.startsWith('INVALID_JSON')) {
          throw new SyntaxError('Unexpected token in JSON')
        }
        return body
      }),
    },
    json: mock((data: unknown, status: number) => {
      jsonResponses.push({ data, status })
      return { data, status } as any
    }),
    getJsonResponses: () => jsonResponses,
  } as unknown as Context & { getJsonResponses: () => Array<{ data: unknown; status: number }> }
}

describe('validateRequest', () => {
  describe('successful validation', () => {
    test('returns success with validated data for valid input', async () => {
      const c = createMockContext({ name: 'John', age: 30 })
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ name: 'John', age: 30 })
      }
    })

    test('validates complex nested objects', async () => {
      const c = createMockContext({
        user: {
          profile: {
            name: 'Jane',
            email: 'jane@example.com',
          },
          preferences: {
            theme: 'dark',
          },
        },
      })
      const schema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string(),
            email: z.string().email(),
          }),
          preferences: z.object({
            theme: z.enum(['light', 'dark']),
          }),
        }),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.user.profile.email).toBe('jane@example.com')
        expect(result.data.user.preferences.theme).toBe('dark')
      }
    })

    test('validates arrays', async () => {
      const c = createMockContext({ items: [1, 2, 3], tags: ['a', 'b'] })
      const schema = z.object({
        items: z.array(z.number()),
        tags: z.array(z.string()),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.items).toEqual([1, 2, 3])
        expect(result.data.tags).toEqual(['a', 'b'])
      }
    })

    test('handles optional fields', async () => {
      const c = createMockContext({ required: 'value' })
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.required).toBe('value')
        expect(result.data.optional).toBeUndefined()
      }
    })

    test('applies default values', async () => {
      const c = createMockContext({ name: 'John' })
      const schema = z.object({
        name: z.string(),
        status: z.string().default('active'),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('active')
      }
    })

    test('validates empty object when schema allows', async () => {
      const c = createMockContext({})
      const schema = z.object({})

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({})
      }
    })

    test('validates with schema transforms', async () => {
      const c = createMockContext({ count: '42' })
      const schema = z.object({
        count: z.string().transform((val) => parseInt(val, 10)),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.count).toBe(42)
      }
    })
  })

  describe('validation failures', () => {
    test('returns error response for missing required field', async () => {
      const c = createMockContext({ name: 'John' })
      const schema = z.object({
        name: z.string(),
        email: z.string(),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(false)
      if (!result.success) {
        const responses = c.getJsonResponses()
        expect(responses).toHaveLength(1)
        expect(responses[0]?.status).toBe(400)
        expect(responses[0]?.data).toMatchObject({
          success: false,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
        })
      }
    })

    test('formats Zod error with field path', async () => {
      const c = createMockContext({ age: 'not a number' })
      const schema = z.object({
        age: z.number(),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(false)
      if (!result.success) {
        const responses = c.getJsonResponses()
        expect(responses[0]?.data).toHaveProperty('errors')
        const errors = (responses[0]?.data as any).errors
        expect(errors).toBeArray()
        expect(errors[0]).toHaveProperty('field', 'age')
        expect(errors[0]).toHaveProperty('message')
        expect(errors[0]).toHaveProperty('code')
      }
    })

    test('formats nested field errors with dot notation', async () => {
      const c = createMockContext({
        user: {
          profile: {
            email: 'invalid-email',
          },
        },
      })
      const schema = z.object({
        user: z.object({
          profile: z.object({
            email: z.string().email(),
          }),
        }),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(false)
      if (!result.success) {
        const responses = c.getJsonResponses()
        const errors = (responses[0]?.data as any).errors
        expect(errors[0].field).toBe('user.profile.email')
      }
    })

    test('returns multiple validation errors', async () => {
      const c = createMockContext({
        name: '',
        age: -5,
        email: 'invalid',
      })
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        age: z.number().positive('Age must be positive'),
        email: z.string().email('Invalid email format'),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(false)
      if (!result.success) {
        const responses = c.getJsonResponses()
        const errors = (responses[0]?.data as any).errors
        expect(errors.length).toBeGreaterThanOrEqual(2)
      }
    })

    test('handles type mismatch errors', async () => {
      const c = createMockContext({
        count: 'not a number',
        enabled: 'not a boolean',
      })
      const schema = z.object({
        count: z.number(),
        enabled: z.boolean(),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(false)
      if (!result.success) {
        const responses = c.getJsonResponses()
        expect(responses[0]?.status).toBe(400)
        const errors = (responses[0]?.data as any).errors
        expect(errors.length).toBe(2)
      }
    })

    test('handles enum validation failures', async () => {
      const c = createMockContext({ role: 'invalid-role' })
      const schema = z.object({
        role: z.enum(['admin', 'user', 'guest']),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(false)
      if (!result.success) {
        const responses = c.getJsonResponses()
        const errors = (responses[0]?.data as any).errors
        expect(errors[0].field).toBe('role')
      }
    })

    test('handles array validation failures', async () => {
      const c = createMockContext({ items: [1, 'invalid', 3] })
      const schema = z.object({
        items: z.array(z.number()),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(false)
      if (!result.success) {
        const responses = c.getJsonResponses()
        const errors = (responses[0]?.data as any).errors
        expect(errors[0].field).toContain('items')
      }
    })

    test('handles array length validation', async () => {
      const c = createMockContext({ tags: [] })
      const schema = z.object({
        tags: z.array(z.string()).min(1, 'At least one tag required'),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(false)
      if (!result.success) {
        const responses = c.getJsonResponses()
        const errors = (responses[0]?.data as any).errors
        expect(errors[0].field).toBe('tags')
        expect(errors[0].message).toContain('At least one tag required')
      }
    })
  })

  describe('JSON parse errors', () => {
    test('returns error for invalid JSON', async () => {
      const c = createMockContext('INVALID_JSON')
      const schema = z.object({ name: z.string() })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(false)
      if (!result.success) {
        const responses = c.getJsonResponses()
        expect(responses[0]?.status).toBe(400)
        expect(responses[0]?.data).toMatchObject({
          success: false,
          message: 'Invalid JSON body',
          code: 'VALIDATION_ERROR',
        })
      }
    })

    test('formats JSON parse error with field: body', async () => {
      const c = createMockContext('INVALID_JSON_MALFORMED')
      const schema = z.object({ data: z.string() })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(false)
      if (!result.success) {
        const responses = c.getJsonResponses()
        const errors = (responses[0]?.data as any).errors
        expect(errors).toBeArray()
        expect(errors[0]).toMatchObject({
          field: 'body',
          message: 'Request body must be valid JSON',
        })
      }
    })
  })

  describe('edge cases', () => {
    test('handles null values in request', async () => {
      const c = createMockContext({ value: null })
      const schema = z.object({
        value: z.null(),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.value).toBeNull()
      }
    })

    test('handles very large objects', async () => {
      const largeObject = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          value: `item-${i}`,
        })),
      }
      const c = createMockContext(largeObject)
      const schema = z.object({
        items: z.array(
          z.object({
            id: z.number(),
            value: z.string(),
          })
        ),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.items).toHaveLength(1000)
      }
    })

    test('handles deeply nested objects', async () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'deep',
                },
              },
            },
          },
        },
      }
      const c = createMockContext(deepObject)
      const schema = z.object({
        level1: z.object({
          level2: z.object({
            level3: z.object({
              level4: z.object({
                level5: z.object({
                  value: z.string(),
                }),
              }),
            }),
          }),
        }),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.level1.level2.level3.level4.level5.value).toBe('deep')
      }
    })

    test('handles schemas with refinements', async () => {
      const c = createMockContext({ password: '12345', confirmPassword: '12345' })
      const schema = z
        .object({
          password: z.string().min(5),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: 'Passwords must match',
          path: ['confirmPassword'],
        })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(true)
    })

    test('handles refinement failures', async () => {
      const c = createMockContext({ password: '12345', confirmPassword: '54321' })
      const schema = z
        .object({
          password: z.string().min(5),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: 'Passwords must match',
          path: ['confirmPassword'],
        })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(false)
      if (!result.success) {
        const responses = c.getJsonResponses()
        const errors = (responses[0]?.data as any).errors
        expect(errors[0].field).toBe('confirmPassword')
        expect(errors[0].message).toBe('Passwords must match')
      }
    })

    test('handles union types', async () => {
      const c = createMockContext({ value: 'string-value' })
      const schema = z.object({
        value: z.union([z.string(), z.number()]),
      })

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.value).toBe('string-value')
      }
    })

    test('handles discriminated unions', async () => {
      const c = createMockContext({
        type: 'email',
        email: 'test@example.com',
      })
      const schema = z.discriminatedUnion('type', [
        z.object({ type: z.literal('email'), email: z.string().email() }),
        z.object({ type: z.literal('phone'), phone: z.string() }),
      ])

      const result = await validateRequest(c, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('email')
        expect((result.data as any).email).toBe('test@example.com')
      }
    })
  })

  describe('return type behavior', () => {
    test('success result has data property', async () => {
      const c = createMockContext({ value: 'test' })
      const schema = z.object({ value: z.string() })

      const result = await validateRequest(c, schema)

      if (result.success) {
        // TypeScript should recognize data property
        expect(result.data).toBeDefined()
        expect(result.data.value).toBe('test')
        // @ts-expect-error - response should not exist on success
        expect(result.response).toBeUndefined()
      }
    })

    test('failure result has response property', async () => {
      const c = createMockContext({ invalid: 'data' })
      const schema = z.object({ required: z.string() })

      const result = await validateRequest(c, schema)

      if (!result.success) {
        // TypeScript should recognize response property
        expect(result.response).toBeDefined()
        // @ts-expect-error - data should not exist on failure
        expect(result.data).toBeUndefined()
      }
    })
  })
})
