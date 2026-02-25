/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Effect } from 'effect'
import { generateHydrationFiles, copyPublicAssets } from './generate-static-helpers'

describe('generate-static-helpers', () => {
  describe('generateHydrationFiles', () => {
    test('should generate hydration file when enabled', async () => {
      const mockFs = {
        mkdir: async () => undefined,
        writeFile: async () => {},
        readFile: async () => '',
      }

      const program = generateHydrationFiles('/output', true, mockFs)
      const result = await Effect.runPromise(program)

      expect(result).toEqual(['assets/client.js'])
    })

    test('should return empty array when disabled', async () => {
      const mockFs = {
        mkdir: async () => undefined,
        writeFile: async () => {},
        readFile: async () => '',
      }

      const program = generateHydrationFiles('/output', false, mockFs)
      const result = await Effect.runPromise(program)

      expect(result).toEqual([])
    })
  })

  describe('copyPublicAssets', () => {
    test('should return empty array when publicDir is undefined', async () => {
      const program = copyPublicAssets(undefined, '/output')
      const result = await Effect.runPromise(program)

      expect(result).toEqual([])
    })

    test('should attempt to copy when publicDir is defined (fails if dir does not exist)', async () => {
      const program = copyPublicAssets('/non-existent-directory', '/output')

      // When publicDir is defined, the function attempts to copy
      // This will fail with an error if the directory doesn't exist
      // (actual successful copy logic is tested separately with real directories)
      const result = await Effect.runPromise(Effect.either(program))

      // Verify the copy was attempted (and failed due to non-existent directory)
      expect(result._tag).toBe('Left')
    })
  })
})
