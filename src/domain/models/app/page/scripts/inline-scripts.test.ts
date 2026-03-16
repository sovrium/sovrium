/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { InlineScriptSchema, InlineScriptsSchema } from './inline-scripts'

describe('InlineScriptSchema', () => {
  test('should accept inline script with code', () => {
    // GIVEN: Inline JavaScript code
    const inlineScript = {
      code: "console.log('Page loaded');",
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InlineScriptSchema)(inlineScript)

    // THEN: Code should be accepted
    expect(result.code).toBe("console.log('Page loaded');")
  })

  test('should accept inline script with position body-end', () => {
    // GIVEN: Script at end of body (default)
    const inlineScript = {
      code: "console.log('Page loaded');",
      position: 'body-end' as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InlineScriptSchema)(inlineScript)

    // THEN: Body-end position should be accepted
    expect(result.position).toBe('body-end')
  })

  test('should accept inline script with position head', () => {
    // GIVEN: Script in document head
    const inlineScript = {
      code: "window.config = { apiUrl: 'https://api.example.com' };",
      position: 'head' as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InlineScriptSchema)(inlineScript)

    // THEN: Head position should be accepted
    expect(result.position).toBe('head')
  })

  test('should accept inline script with position body-start', () => {
    // GIVEN: Script at start of body
    const inlineScript = {
      code: "console.log('Body starting');",
      position: 'body-start' as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InlineScriptSchema)(inlineScript)

    // THEN: Body-start position should be accepted
    expect(result.position).toBe('body-start')
  })

  test('should accept inline script with async true', () => {
    // GIVEN: Async IIFE wrapper
    const inlineScript = {
      code: 'await fetch("/api/data");',
      async: true,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InlineScriptSchema)(inlineScript)

    // THEN: Async flag should be accepted
    expect(result.async).toBe(true)
  })

  test('should accept inline script setting window config', () => {
    // GIVEN: Global configuration
    const inlineScript = {
      code: "window.config = { apiUrl: 'https://api.example.com' };",
      position: 'head' as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InlineScriptSchema)(inlineScript)

    // THEN: Config code should be accepted
    expect(result.code).toBe("window.config = { apiUrl: 'https://api.example.com' };")
  })

  test('should accept inline script with required code only', () => {
    // GIVEN: Minimal script configuration
    const inlineScript = {
      code: "console.log('Hello');",
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InlineScriptSchema)(inlineScript)

    // THEN: Minimal configuration should be accepted
    expect(result.code).toBe("console.log('Hello');")
    expect(result.position).toBeUndefined()
    expect(result.async).toBeUndefined()
  })

  test('should reject inline script without required code', () => {
    // GIVEN: Script missing code property
    const inlineScript = {
      position: 'body-end',
    }

    // WHEN: Schema validation is performed
    // THEN: Should be rejected (code is required)
    expect(() => Schema.decodeUnknownSync(InlineScriptSchema)(inlineScript)).toThrow()
  })
})

describe('InlineScriptsSchema', () => {
  test('should accept array with multiple inline scripts', () => {
    // GIVEN: Multiple inline scripts
    const inlineScripts = [
      {
        code: "console.log('Page loaded');",
        position: 'body-end' as const,
      },
      {
        code: "window.config = { apiUrl: 'https://api.example.com' };",
        position: 'head' as const,
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InlineScriptsSchema)(inlineScripts)

    // THEN: All scripts should be accepted
    expect(result.length).toBe(2)
    expect(result[0]?.code).toBe("console.log('Page loaded');")
    expect(result[1]?.code).toBe("window.config = { apiUrl: 'https://api.example.com' };")
  })

  test('should accept inline scripts for analytics tracking', () => {
    // GIVEN: Analytics initialization code
    const inlineScripts = [
      {
        code: 'window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);}',
        position: 'head' as const,
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InlineScriptsSchema)(inlineScripts)

    // THEN: Analytics code should be accepted
    expect(result[0]?.code).toContain('gtag')
  })

  test('should accept inline scripts with different positions', () => {
    // GIVEN: Scripts with different positions
    const inlineScripts = [
      {
        code: "console.log('head');",
        position: 'head' as const,
      },
      {
        code: "console.log('body-start');",
        position: 'body-start' as const,
      },
      {
        code: "console.log('body-end');",
        position: 'body-end' as const,
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InlineScriptsSchema)(inlineScripts)

    // THEN: Different positions should be accepted
    expect(result[0]?.position).toBe('head')
    expect(result[1]?.position).toBe('body-start')
    expect(result[2]?.position).toBe('body-end')
  })

  test('should accept empty inline scripts array', () => {
    // GIVEN: No inline scripts
    const inlineScripts: unknown[] = []

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(InlineScriptsSchema)(inlineScripts)

    // THEN: Empty array should be accepted
    expect(result).toEqual([])
  })
})
