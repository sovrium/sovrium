/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { loadSchemaFromFile, fileExists, readFileContent } from './file-loader'

const TEST_DIR = join(import.meta.dir, '__test_fixtures__')
const TEST_JSON_FILE = join(TEST_DIR, 'test-schema.json')
const TEST_YAML_FILE = join(TEST_DIR, 'test-schema.yaml')
const TEST_YML_FILE = join(TEST_DIR, 'test-schema.yml')
const TEST_UNSUPPORTED_FILE = join(TEST_DIR, 'test-schema.txt')
const NONEXISTENT_FILE = join(TEST_DIR, 'nonexistent.json')

const validSchema = {
  name: 'Test App',
  description: 'Test description',
  metadata: {
    theme: 'default',
    pages: [],
  },
}

describe('file-loader', () => {
  beforeAll(async () => {
    // Create test directory
    await mkdir(TEST_DIR, { recursive: true })

    // Create test JSON file
    await writeFile(TEST_JSON_FILE, JSON.stringify(validSchema, null, 2))

    // Create test YAML file (.yaml)
    const yamlContent = `name: Test App
description: Test description
metadata:
  theme: default
  pages: []`
    await writeFile(TEST_YAML_FILE, yamlContent)

    // Create test YAML file (.yml)
    await writeFile(TEST_YML_FILE, yamlContent)

    // Create unsupported file
    await writeFile(TEST_UNSUPPORTED_FILE, 'This is not a valid format')
  })

  afterAll(async () => {
    // Clean up test directory
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  describe('loadSchemaFromFile', () => {
    test('loads and parses JSON file successfully', async () => {
      const schema = await loadSchemaFromFile(TEST_JSON_FILE)

      expect(schema.name).toBe('Test App')
      expect(schema.description).toBe('Test description')
      expect(schema.metadata.theme).toBe('default')
      expect(schema.metadata.pages).toEqual([])
    })

    test('loads and parses YAML file with .yaml extension', async () => {
      const schema = await loadSchemaFromFile(TEST_YAML_FILE)

      expect(schema.name).toBe('Test App')
      expect(schema.description).toBe('Test description')
      expect(schema.metadata.theme).toBe('default')
      expect(schema.metadata.pages).toEqual([])
    })

    test('loads and parses YAML file with .yml extension', async () => {
      const schema = await loadSchemaFromFile(TEST_YML_FILE)

      expect(schema.name).toBe('Test App')
      expect(schema.description).toBe('Test description')
      expect(schema.metadata.theme).toBe('default')
      expect(schema.metadata.pages).toEqual([])
    })

    test('throws error when file does not exist', async () => {
      expect(async () => {
        await loadSchemaFromFile(NONEXISTENT_FILE)
      }).toThrow('File not found')
    })

    test('throws error for unsupported file format', async () => {
      expect(async () => {
        await loadSchemaFromFile(TEST_UNSUPPORTED_FILE)
      }).toThrow('Unsupported file format: .txt')
    })
  })

  describe('fileExists', () => {
    test('returns true when file exists', async () => {
      const exists = await fileExists(TEST_JSON_FILE)
      expect(exists).toBe(true)
    })

    test('returns false when file does not exist', async () => {
      const exists = await fileExists(NONEXISTENT_FILE)
      expect(exists).toBe(false)
    })
  })

  describe('readFileContent', () => {
    test('returns file content as text', async () => {
      const content = await readFileContent(TEST_JSON_FILE)

      expect(typeof content).toBe('string')
      expect(content).toContain('Test App')
      expect(content).toContain('Test description')
    })

    test('returns YAML content as text', async () => {
      const content = await readFileContent(TEST_YAML_FILE)

      expect(typeof content).toBe('string')
      expect(content).toContain('name: Test App')
      expect(content).toContain('description: Test description')
    })
  })
})
