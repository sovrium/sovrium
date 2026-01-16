/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Effect } from 'effect'
import {
  importFsModule,
  importTranslationReplacer,
  importPathModule,
  importCopyDirectory,
  generateHydrationFiles,
  copyPublicAssets,
} from './generate-static-helpers'

describe('generate-static-helpers', () => {
  describe('importFsModule', () => {
    test('should successfully import fs module', async () => {
      const program = importFsModule()
      const result = await Effect.runPromise(program)

      expect(result).toBeDefined()
      expect(result.writeFile).toBeDefined()
      expect(result.readFile).toBeDefined()
    })
  })

  describe('importTranslationReplacer', () => {
    test('should successfully import translation replacer', async () => {
      const program = importTranslationReplacer()
      const result = await Effect.runPromise(program)

      expect(result).toBeDefined()
      expect(result.replaceAppTokens).toBeDefined()
    })
  })

  describe('importPathModule', () => {
    test('should successfully import path module', async () => {
      const program = importPathModule()
      const result = await Effect.runPromise(program)

      expect(result).toBeDefined()
      expect(result.join).toBeDefined()
      expect(result.resolve).toBeDefined()
    })
  })

  describe('importCopyDirectory', () => {
    test('should successfully import copy directory module', async () => {
      const program = importCopyDirectory()
      const result = await Effect.runPromise(program)

      expect(result).toBeDefined()
      expect(result.copyDirectory).toBeDefined()
    })
  })

  describe('generateHydrationFiles', () => {
    test('should generate hydration file when enabled', async () => {
      const mockFs = {
        writeFile: async () => {},
      }

      const program = generateHydrationFiles('/output', true, mockFs)
      const result = await Effect.runPromise(program)

      expect(result).toEqual(['assets/client.js'])
    })

    test('should return empty array when disabled', async () => {
      const mockFs = {
        writeFile: async () => {},
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

    test('should copy assets when publicDir is defined', async () => {
      const program = copyPublicAssets('/public', '/output')

      // Just verify it returns an array (actual copy directory logic is tested separately)
      const result = await Effect.runPromise(program)

      expect(Array.isArray(result)).toBe(true)
    })
  })
})
