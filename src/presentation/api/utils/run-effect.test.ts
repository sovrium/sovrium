/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect, mock } from 'bun:test'
import { Effect } from 'effect'
import { z } from 'zod'
import { runEffect } from './run-effect'
import type { Context } from 'hono'

// Helper to create a mock Hono context
const createMockContext = () => {
  const jsonResponses: Array<{ data: unknown; status: number }> = []

  return {
    json: mock((data: unknown, status: number) => {
      jsonResponses.push({ data, status })
      return { data, status } as any
    }),
    getJsonResponses: () => jsonResponses,
  } as unknown as Context & { getJsonResponses: () => Array<{ data: unknown; status: number }> }
}

describe('runEffect', () => {
  describe('successful execution', () => {
    test('runs Effect program and returns validated JSON response', async () => {
      const c = createMockContext()
      const program = Effect.succeed({ message: 'Success', count: 42 })
      const schema = z.object({
        message: z.string(),
        count: z.number(),
      })

      const result = await runEffect(c, program, schema)

      expect(result).toBeDefined()
      const responses = c.getJsonResponses()
      expect(responses).toHaveLength(1)
      expect(responses[0]?.data).toEqual({ message: 'Success', count: 42 })
      expect(responses[0]?.status).toBe(200)
    })

    test('validates response against schema', async () => {
      const c = createMockContext()
      const program = Effect.succeed({ name: 'John', age: 30 })
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.data).toEqual({ name: 'John', age: 30 })
      expect(responses[0]?.status).toBe(200)
    })

    test('handles complex nested schema validation', async () => {
      const c = createMockContext()
      const program = Effect.succeed({
        user: {
          id: '123',
          profile: {
            name: 'Jane',
            email: 'jane@example.com',
          },
        },
        metadata: {
          timestamp: '2025-01-01T00:00:00Z',
        },
      })
      const schema = z.object({
        user: z.object({
          id: z.string(),
          profile: z.object({
            name: z.string(),
            email: z.string().email(),
          }),
        }),
        metadata: z.object({
          timestamp: z.string(),
        }),
      })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(200)
      expect(responses[0]?.data).toHaveProperty('user.profile.email', 'jane@example.com')
    })

    test('handles array responses', async () => {
      const c = createMockContext()
      const program = Effect.succeed({ items: [1, 2, 3], total: 3 })
      const schema = z.object({
        items: z.array(z.number()),
        total: z.number(),
      })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.data).toEqual({ items: [1, 2, 3], total: 3 })
      expect(responses[0]?.status).toBe(200)
    })

    test('handles optional fields in schema', async () => {
      const c = createMockContext()
      const program = Effect.succeed({ required: 'value' })
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.data).toEqual({ required: 'value' })
      expect(responses[0]?.status).toBe(200)
    })
  })

  describe('Effect program failures', () => {
    test('handles Effect failure with Error', async () => {
      const c = createMockContext()
      const program = Effect.fail(new Error('Operation failed'))
      const schema = z.object({ success: z.boolean() })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses).toHaveLength(1)
      expect(responses[0]?.status).toBe(500)
      expect(responses[0]?.data).toMatchObject({
        success: false,
        message: 'Operation failed',
        code: 'INTERNAL_ERROR',
      })
    })

    test('handles Effect die with non-Error', async () => {
      const c = createMockContext()
      const program = Effect.die('Unexpected failure')
      const schema = z.object({ success: z.boolean() })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(500)
      expect(responses[0]?.data).toMatchObject({
        success: false,
        message: 'Unexpected failure',
        code: 'INTERNAL_ERROR',
      })
    })

    test('handles Effect that throws during execution', async () => {
      const c = createMockContext()
      const program = Effect.sync(() => {
        throw new Error('Sync error')
      })
      const schema = z.object({ success: z.boolean() })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(500)
      expect(responses[0]?.data).toMatchObject({
        success: false,
        message: 'Sync error',
        code: 'INTERNAL_ERROR',
      })
    })

    test('includes error message in response', async () => {
      const c = createMockContext()
      const program = Effect.fail(new Error('Database connection lost'))
      const schema = z.object({ data: z.string() })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.data).toHaveProperty('message', 'Database connection lost')
    })
  })

  describe('schema validation failures', () => {
    test('returns error when Effect succeeds but response fails schema validation', async () => {
      const c = createMockContext()
      const program = Effect.succeed({ wrongField: 'value' })
      const schema = z.object({
        requiredField: z.string(),
      })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(500)
      expect(responses[0]?.data).toMatchObject({
        success: false,
        code: 'INTERNAL_ERROR',
      })
    })

    test('handles type mismatch in schema validation', async () => {
      const c = createMockContext()
      const program = Effect.succeed({ count: 'not a number' })
      const schema = z.object({
        count: z.number(),
      })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(500)
      expect(responses[0]?.data).toMatchObject({
        success: false,
        code: 'INTERNAL_ERROR',
      })
    })

    test('handles invalid nested object structure', async () => {
      const c = createMockContext()
      const program = Effect.succeed({ user: 'should be object' })
      const schema = z.object({
        user: z.object({
          id: z.string(),
        }),
      })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(500)
    })
  })

  describe('edge cases', () => {
    test('handles null values in response', async () => {
      const c = createMockContext()
      const program = Effect.succeed({ value: null })
      const schema = z.object({
        value: z.null(),
      })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(200)
      expect(responses[0]?.data).toEqual({ value: null })
    })

    test('handles empty object response', async () => {
      const c = createMockContext()
      const program = Effect.succeed({})
      const schema = z.object({})

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(200)
      expect(responses[0]?.data).toEqual({})
    })

    test('handles schema with default values', async () => {
      const c = createMockContext()
      const program = Effect.succeed({})
      const schema = z.object({
        status: z.string().default('pending'),
      })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(200)
      expect(responses[0]?.data).toEqual({ status: 'pending' })
    })

    test('handles schema with transforms', async () => {
      const c = createMockContext()
      const program = Effect.succeed({ count: '42' })
      const schema = z.object({
        count: z.string().transform((val) => parseInt(val, 10)),
      })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(200)
      expect(responses[0]?.data).toEqual({ count: 42 })
    })

    test('handles very large response objects', async () => {
      const c = createMockContext()
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` }))
      const program = Effect.succeed({ items: largeArray })
      const schema = z.object({
        items: z.array(
          z.object({
            id: z.number(),
            value: z.string(),
          })
        ),
      })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(200)
      expect(responses[0]?.data).toHaveProperty('items')
      expect((responses[0]?.data as any).items).toHaveLength(1000)
    })
  })

  describe('schema compatibility', () => {
    test('works with any Zod-compatible schema that has parse method', async () => {
      const c = createMockContext()
      const program = Effect.succeed({ value: 'test' })

      // Custom schema-like object with parse method
      const customSchema = {
        parse: (data: unknown) => {
          if (
            typeof data === 'object' &&
            data !== null &&
            'value' in data &&
            typeof data.value === 'string'
          ) {
            return data
          }
          throw new Error('Invalid data')
        },
      }

      await runEffect(c, program, customSchema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(200)
      expect(responses[0]?.data).toEqual({ value: 'test' })
    })

    test('handles schema parse throwing error', async () => {
      const c = createMockContext()
      const program = Effect.succeed({ value: 'test' })

      const throwingSchema = {
        parse: () => {
          throw new Error('Schema validation failed')
        },
      }

      await runEffect(c, program, throwingSchema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(500)
      expect(responses[0]?.data).toMatchObject({
        success: false,
        message: 'Schema validation failed',
        code: 'INTERNAL_ERROR',
      })
    })
  })

  describe('async Effect programs', () => {
    test('handles Effect with async operations', async () => {
      const c = createMockContext()
      const program = Effect.promise(() => Promise.resolve({ async: true }))
      const schema = z.object({
        async: z.boolean(),
      })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(200)
      expect(responses[0]?.data).toEqual({ async: true })
    })

    test('handles Effect with delayed execution', async () => {
      const c = createMockContext()
      const program = Effect.gen(function* () {
        yield* Effect.sleep('10 millis')
        return { delayed: true }
      })
      const schema = z.object({
        delayed: z.boolean(),
      })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(200)
      expect(responses[0]?.data).toEqual({ delayed: true })
    })

    test('handles rejected Promise in Effect', async () => {
      const c = createMockContext()
      const program = Effect.promise(() => Promise.reject(new Error('Promise rejected')))
      const schema = z.object({ success: z.boolean() })

      await runEffect(c, program, schema)

      const responses = c.getJsonResponses()
      expect(responses[0]?.status).toBe(500)
      expect(responses[0]?.data).toMatchObject({
        success: false,
        message: 'Promise rejected',
        code: 'INTERNAL_ERROR',
      })
    })
  })
})
