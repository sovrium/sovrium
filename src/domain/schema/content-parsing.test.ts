/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { parseJsonContent, parseYamlContent, parseSchemaContent } from './content-parsing'

describe('parseJsonContent', () => {
  test('should parse valid JSON object', () => {
    const content = '{"name": "my-app", "description": "Test app"}'
    const result = parseJsonContent(content)
    expect(result.name).toBe('my-app')
    expect(result.description).toBe('Test app')
  })

  test('should parse JSON with nested objects', () => {
    const content = '{"name": "my-app", "pages": [{"name": "home", "path": "/", "sections": []}]}'
    const result = parseJsonContent(content)
    expect(result.name).toBe('my-app')
    expect(result.pages).toHaveLength(1)
    expect(result.pages?.[0]?.name).toBe('home')
  })

  test('should parse minified JSON', () => {
    const content = '{"name":"app","version":"1.0"}'
    const result = parseJsonContent(content)
    expect(result.name).toBe('app')
    expect(result.version).toBe('1.0')
  })

  test('should parse formatted JSON with whitespace', () => {
    const content = `{
      "name": "my-app",
      "description": "A formatted JSON"
    }`
    const result = parseJsonContent(content)
    expect(result.name).toBe('my-app')
    expect(result.description).toBe('A formatted JSON')
  })

  test('should throw on invalid JSON', () => {
    const content = '{ invalid json }'
    expect(() => parseJsonContent(content)).toThrow()
  })

  test('should throw on empty string', () => {
    expect(() => parseJsonContent('')).toThrow()
  })
})

describe('parseYamlContent', () => {
  test('should parse valid YAML', () => {
    const content = `name: my-app
description: Test app`
    const result = parseYamlContent(content)
    expect(result.name).toBe('my-app')
    expect(result.description).toBe('Test app')
  })

  test('should parse YAML with nested structures', () => {
    const content = `name: my-app
pages:
  - name: home
    path: /
    sections: []`
    const result = parseYamlContent(content)
    expect(result.name).toBe('my-app')
    expect(result.pages).toHaveLength(1)
    expect(result.pages?.[0]?.name).toBe('home')
  })

  test('should parse YAML with quoted strings', () => {
    const content = `name: "my-app"
description: 'Single quoted'`
    const result = parseYamlContent(content)
    expect(result.name).toBe('my-app')
    expect(result.description).toBe('Single quoted')
  })

  test('should parse YAML with multiline strings', () => {
    const content = `name: my-app
description: |
  This is a
  multiline description`
    const result = parseYamlContent(content)
    expect(result.name).toBe('my-app')
    expect(result.description).toContain('multiline')
  })

  test('should handle empty YAML', () => {
    const content = ''
    const result = parseYamlContent(content)
    expect(result).toBeUndefined()
  })
})

describe('parseSchemaContent', () => {
  const jsonContent = '{"name": "json-app"}'
  const yamlContent = 'name: yaml-app'

  test('should parse as JSON when format is json', () => {
    const result = parseSchemaContent(jsonContent, 'json')
    expect(result.name).toBe('json-app')
  })

  test('should parse as YAML when format is yaml', () => {
    const result = parseSchemaContent(yamlContent, 'yaml')
    expect(result.name).toBe('yaml-app')
  })

  test('should try JSON first when format is undefined', () => {
    const result = parseSchemaContent(jsonContent, undefined)
    expect(result.name).toBe('json-app')
  })

  test('should fallback to YAML when JSON fails and format is undefined', () => {
    const result = parseSchemaContent(yamlContent, undefined)
    expect(result.name).toBe('yaml-app')
  })

  test('should handle YAML that looks like JSON (valid in both)', () => {
    // JSON is a subset of YAML, so valid JSON is also valid YAML
    const result = parseSchemaContent(jsonContent, 'yaml')
    expect(result.name).toBe('json-app')
  })

  test('should throw when JSON format specified but content is invalid JSON', () => {
    expect(() => parseSchemaContent(yamlContent, 'json')).toThrow()
  })

  test('should handle unsupported format by falling back to auto-detect', () => {
    // When format is neither 'json' nor 'yaml', it falls through to auto-detect
    const result = parseSchemaContent(jsonContent, 'unsupported' as 'json' | 'yaml')
    expect(result.name).toBe('json-app')
  })
})
