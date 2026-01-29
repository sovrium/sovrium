/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe, mock, afterEach } from 'bun:test'
import { fetchRemoteSchema } from './remote-loader'

const validSchema = {
  name: 'Test App',
  description: 'Test description',
  theme: { colors: { primary: '#000' } },
  pages: [],
}

// Save and restore globalThis.fetch to prevent test pollution across files
const originalFetch = globalThis.fetch

describe('remote-loader', () => {
  describe('fetchRemoteSchema', () => {
    afterEach(() => {
      globalThis.fetch = originalFetch
    })
    test('fetches and parses JSON from remote URL with application/json content type', async () => {
      const mockFetch = mock(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify(validSchema),
      }))

      globalThis.fetch = mockFetch as any

      const schema = await fetchRemoteSchema('https://example.com/schema.json')

      expect(schema.name).toBe('Test App')
      expect(schema.description).toBe('Test description')
      expect(schema.theme).toEqual({ colors: { primary: '#000' } })
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/schema.json')
    })

    test('fetches and parses YAML from remote URL with text/yaml content type', async () => {
      const yamlContent = `name: Test App
description: Test description
theme:
  colors:
    primary: '#000'
pages: []`

      const mockFetch = mock(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/yaml' }),
        text: async () => yamlContent,
      }))

      globalThis.fetch = mockFetch as any

      const schema = await fetchRemoteSchema('https://example.com/schema.yaml')

      expect(schema.name).toBe('Test App')
      expect(schema.description).toBe('Test description')
      expect(schema.theme).toEqual({ colors: { primary: '#000' } })
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    test('detects JSON format from URL extension when content type is missing', async () => {
      const mockFetch = mock(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({}), // No content-type header
        text: async () => JSON.stringify(validSchema),
      }))

      globalThis.fetch = mockFetch as any

      const schema = await fetchRemoteSchema('https://example.com/schema.json')

      expect(schema.name).toBe('Test App')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    test('detects YAML format from URL extension when content type is missing', async () => {
      const yamlContent = `name: Test App
description: Test description
theme:
  colors:
    primary: '#000'
pages: []`

      const mockFetch = mock(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({}),
        text: async () => yamlContent,
      }))

      globalThis.fetch = mockFetch as any

      const schema = await fetchRemoteSchema('https://example.com/schema.yaml')

      expect(schema.name).toBe('Test App')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    test('throws error when HTTP response is not ok (404)', async () => {
      const mockFetch = mock(async () => ({
        ok: false,
        status: 404,
        headers: new Headers({}),
        text: async () => 'Not Found',
      }))

      globalThis.fetch = mockFetch as any

      expect(async () => {
        await fetchRemoteSchema('https://example.com/missing.json')
      }).toThrow('Failed to fetch schema from https://example.com/missing.json: HTTP 404')
    })

    test('throws error when HTTP response is not ok (500)', async () => {
      const mockFetch = mock(async () => ({
        ok: false,
        status: 500,
        headers: new Headers({}),
        text: async () => 'Internal Server Error',
      }))

      globalThis.fetch = mockFetch as any

      expect(async () => {
        await fetchRemoteSchema('https://example.com/error.json')
      }).toThrow('Failed to fetch schema from https://example.com/error.json: HTTP 500')
    })

    test('throws error when network request fails', async () => {
      const mockFetch = mock(async () => {
        throw new Error('Network error: Connection refused')
      })

      globalThis.fetch = mockFetch as any

      expect(async () => {
        await fetchRemoteSchema('https://example.com/schema.json')
      }).toThrow('Failed to fetch or parse schema')
    })

    test('throws error when JSON parsing fails', async () => {
      const mockFetch = mock(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => 'invalid json {',
      }))

      globalThis.fetch = mockFetch as any

      expect(async () => {
        await fetchRemoteSchema('https://example.com/invalid.json')
      }).toThrow('Failed to fetch or parse schema')
    })

    test('throws error when YAML parsing fails', async () => {
      const mockFetch = mock(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/yaml' }),
        text: async () => 'invalid: yaml: content: [',
      }))

      globalThis.fetch = mockFetch as any

      expect(async () => {
        await fetchRemoteSchema('https://example.com/invalid.yaml')
      }).toThrow('Failed to fetch or parse schema')
    })
  })
})
