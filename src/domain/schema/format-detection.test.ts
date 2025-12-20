/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  detectFormat,
  detectFormatFromContentType,
  detectFormatFromUrl,
  getFileExtension,
  isInlineJson,
  isUrl,
} from './format-detection'

describe('detectFormat', () => {
  test('should detect JSON format from .json extension', () => {
    expect(detectFormat('app.json')).toBe('json')
    expect(detectFormat('config.json')).toBe('json')
    expect(detectFormat('/path/to/app.json')).toBe('json')
  })

  test('should detect JSON format case-insensitively', () => {
    expect(detectFormat('app.JSON')).toBe('json')
    expect(detectFormat('app.Json')).toBe('json')
  })

  test('should detect YAML format from .yaml extension', () => {
    expect(detectFormat('app.yaml')).toBe('yaml')
    expect(detectFormat('config.yaml')).toBe('yaml')
    expect(detectFormat('/path/to/app.yaml')).toBe('yaml')
  })

  test('should detect YAML format from .yml extension', () => {
    expect(detectFormat('app.yml')).toBe('yaml')
    expect(detectFormat('config.yml')).toBe('yaml')
  })

  test('should detect YAML format case-insensitively', () => {
    expect(detectFormat('app.YAML')).toBe('yaml')
    expect(detectFormat('app.YML')).toBe('yaml')
  })

  test('should return unsupported for unknown extensions', () => {
    expect(detectFormat('app.txt')).toBe('unsupported')
    expect(detectFormat('app.xml')).toBe('unsupported')
    expect(detectFormat('app.toml')).toBe('unsupported')
    expect(detectFormat('app')).toBe('unsupported')
  })
})

describe('getFileExtension', () => {
  test('should extract file extension', () => {
    expect(getFileExtension('app.json')).toBe('json')
    expect(getFileExtension('app.yaml')).toBe('yaml')
    expect(getFileExtension('app.yml')).toBe('yml')
  })

  test('should extract extension from paths', () => {
    expect(getFileExtension('/path/to/app.json')).toBe('json')
    expect(getFileExtension('./config.yaml')).toBe('yaml')
  })

  test('should return empty string when no extension', () => {
    expect(getFileExtension('app')).toBe('')
    expect(getFileExtension('/path/to/file')).toBe('')
  })

  test('should handle multiple dots correctly', () => {
    expect(getFileExtension('app.config.json')).toBe('json')
    expect(getFileExtension('my.app.yaml')).toBe('yaml')
  })
})

describe('detectFormatFromContentType', () => {
  test('should detect JSON from application/json', () => {
    expect(detectFormatFromContentType('application/json')).toBe('json')
    expect(detectFormatFromContentType('application/json; charset=utf-8')).toBe('json')
  })

  test('should detect YAML from application/x-yaml', () => {
    expect(detectFormatFromContentType('application/x-yaml')).toBe('yaml')
    expect(detectFormatFromContentType('application/x-yaml; charset=utf-8')).toBe('yaml')
  })

  test('should detect YAML from text/yaml', () => {
    expect(detectFormatFromContentType('text/yaml')).toBe('yaml')
    expect(detectFormatFromContentType('text/yaml; charset=utf-8')).toBe('yaml')
  })

  test('should return undefined for unknown content types', () => {
    expect(detectFormatFromContentType('text/plain')).toBeUndefined()
    expect(detectFormatFromContentType('text/html')).toBeUndefined()
    expect(detectFormatFromContentType('application/xml')).toBeUndefined()
    expect(detectFormatFromContentType('')).toBeUndefined()
  })
})

describe('detectFormatFromUrl', () => {
  test('should detect JSON from URL ending with .json', () => {
    expect(detectFormatFromUrl('https://example.com/schema.json')).toBe('json')
    expect(detectFormatFromUrl('http://localhost:3000/app.json')).toBe('json')
  })

  test('should detect YAML from URL ending with .yaml', () => {
    expect(detectFormatFromUrl('https://example.com/schema.yaml')).toBe('yaml')
    expect(detectFormatFromUrl('http://localhost:3000/app.yaml')).toBe('yaml')
  })

  test('should detect YAML from URL ending with .yml', () => {
    expect(detectFormatFromUrl('https://example.com/schema.yml')).toBe('yaml')
  })

  test('should detect format case-insensitively', () => {
    expect(detectFormatFromUrl('https://example.com/schema.JSON')).toBe('json')
    expect(detectFormatFromUrl('https://example.com/schema.YAML')).toBe('yaml')
  })

  test('should return undefined for URLs without recognized extension', () => {
    expect(detectFormatFromUrl('https://example.com/schema')).toBeUndefined()
    expect(detectFormatFromUrl('https://example.com/api/schema')).toBeUndefined()
    expect(detectFormatFromUrl('https://example.com/schema.txt')).toBeUndefined()
  })
})

describe('isInlineJson', () => {
  test('should return true for strings starting with {', () => {
    expect(isInlineJson('{"name":"app"}')).toBe(true)
    expect(isInlineJson('{}')).toBe(true)
  })

  test('should handle leading whitespace', () => {
    expect(isInlineJson('  {"name":"app"}')).toBe(true)
    expect(isInlineJson('\n{"name":"app"}')).toBe(true)
    expect(isInlineJson('\t{"name":"app"}')).toBe(true)
  })

  test('should return false for non-JSON content', () => {
    expect(isInlineJson('name: app')).toBe(false)
    expect(isInlineJson('hello world')).toBe(false)
    expect(isInlineJson('["array"]')).toBe(false)
    expect(isInlineJson('')).toBe(false)
  })
})

describe('isUrl', () => {
  test('should return true for HTTP URLs', () => {
    expect(isUrl('http://example.com')).toBe(true)
    expect(isUrl('http://localhost:3000/schema.json')).toBe(true)
  })

  test('should return true for HTTPS URLs', () => {
    expect(isUrl('https://example.com')).toBe(true)
    expect(isUrl('https://api.example.com/v1/schema.yaml')).toBe(true)
  })

  test('should handle leading whitespace', () => {
    expect(isUrl('  https://example.com')).toBe(true)
    expect(isUrl('\nhttps://example.com')).toBe(true)
  })

  test('should return false for non-URL strings', () => {
    expect(isUrl('example.com')).toBe(false)
    expect(isUrl('file:///path/to/file.json')).toBe(false)
    expect(isUrl('ftp://example.com')).toBe(false)
    expect(isUrl('/path/to/file.json')).toBe(false)
    expect(isUrl('{"name":"app"}')).toBe(false)
    expect(isUrl('')).toBe(false)
  })
})
