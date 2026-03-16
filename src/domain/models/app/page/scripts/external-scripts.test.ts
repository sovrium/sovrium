/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import {
  CrossOriginSchema,
  ScriptPositionSchema,
  ExternalScriptSchema,
  ExternalScriptsSchema,
} from './external-scripts'

describe('CrossOriginSchema', () => {
  test('should accept anonymous', () => {
    // GIVEN: Anonymous CORS setting
    const crossOrigin = 'anonymous'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(CrossOriginSchema)(crossOrigin)

    // THEN: Anonymous should be accepted
    expect(result).toBe('anonymous')
  })

  test('should accept use-credentials', () => {
    // GIVEN: Use-credentials CORS setting
    const crossOrigin = 'use-credentials'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(CrossOriginSchema)(crossOrigin)

    // THEN: Use-credentials should be accepted
    expect(result).toBe('use-credentials')
  })

  test('should reject invalid CORS setting', () => {
    // GIVEN: Invalid CORS setting
    const crossOrigin = 'invalid'

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(CrossOriginSchema)(crossOrigin)).toThrow()
  })
})

describe('ScriptPositionSchema', () => {
  test('should accept position head', () => {
    // GIVEN: Head position
    const position = 'head'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScriptPositionSchema)(position)

    // THEN: Head position should be accepted
    expect(result).toBe('head')
  })

  test('should accept position body-start', () => {
    // GIVEN: Body-start position
    const position = 'body-start'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScriptPositionSchema)(position)

    // THEN: Body-start position should be accepted
    expect(result).toBe('body-start')
  })

  test('should accept position body-end', () => {
    // GIVEN: Body-end position (default)
    const position = 'body-end'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScriptPositionSchema)(position)

    // THEN: Body-end position should be accepted
    expect(result).toBe('body-end')
  })

  test('should reject invalid position', () => {
    // GIVEN: Invalid position
    const position = 'invalid'

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(ScriptPositionSchema)(position)).toThrow()
  })
})

describe('ExternalScriptSchema', () => {
  test('should accept external script with src URL', () => {
    // GIVEN: External script from CDN
    const externalScript = {
      src: 'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ExternalScriptSchema)(externalScript)

    // THEN: CDN script should be accepted
    expect(result.src).toBe('https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js')
  })

  test('should accept external script with async true', () => {
    // GIVEN: Async script loading
    const externalScript = {
      src: 'https://cdn.jsdelivr.net/npm/chart.js',
      async: true,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ExternalScriptSchema)(externalScript)

    // THEN: Async flag should be accepted
    expect(result.async).toBe(true)
  })

  test('should accept external script with defer true', () => {
    // GIVEN: Deferred script execution
    const externalScript = {
      src: 'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
      defer: true,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ExternalScriptSchema)(externalScript)

    // THEN: Defer flag should be accepted
    expect(result.defer).toBe(true)
  })

  test('should accept external script as ES module', () => {
    // GIVEN: ES module script
    const externalScript = {
      src: './js/app.js',
      module: true,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ExternalScriptSchema)(externalScript)

    // THEN: Module flag should be accepted
    expect(result.module).toBe(true)
  })

  test('should accept external script with integrity hash', () => {
    // GIVEN: Script with SRI hash
    const externalScript = {
      src: 'https://cdn.example.com/lib.js',
      integrity: 'sha384-abc123...',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ExternalScriptSchema)(externalScript)

    // THEN: Integrity hash should be accepted
    expect(result.integrity).toBe('sha384-abc123...')
  })

  test('should accept external script with crossorigin anonymous', () => {
    // GIVEN: Script with anonymous CORS
    const externalScript = {
      src: 'https://cdn.example.com/lib.js',
      crossorigin: 'anonymous' as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ExternalScriptSchema)(externalScript)

    // THEN: Anonymous CORS should be accepted
    expect(result.crossorigin).toBe('anonymous')
  })

  test('should accept external script with crossorigin use-credentials', () => {
    // GIVEN: Script with credentials CORS
    const externalScript = {
      src: 'https://cdn.example.com/lib.js',
      crossorigin: 'use-credentials' as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ExternalScriptSchema)(externalScript)

    // THEN: Use-credentials CORS should be accepted
    expect(result.crossorigin).toBe('use-credentials')
  })

  test('should accept external script with position head', () => {
    // GIVEN: Script in head
    const externalScript = {
      src: 'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
      defer: true,
      position: 'head' as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ExternalScriptSchema)(externalScript)

    // THEN: Head position should be accepted
    expect(result.position).toBe('head')
  })

  test('should accept external script with position body-end', () => {
    // GIVEN: Script at end of body (default)
    const externalScript = {
      src: './js/app.js',
      module: true,
      position: 'body-end' as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ExternalScriptSchema)(externalScript)

    // THEN: Body-end position should be accepted
    expect(result.position).toBe('body-end')
  })

  test('should accept external script with position body-start', () => {
    // GIVEN: Script at start of body
    const externalScript = {
      src: 'https://cdn.example.com/lib.js',
      position: 'body-start' as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ExternalScriptSchema)(externalScript)

    // THEN: Body-start position should be accepted
    expect(result.position).toBe('body-start')
  })

  test('should accept external script with relative src', () => {
    // GIVEN: Local JavaScript file
    const externalScript = {
      src: './js/app.js',
      module: true,
      position: 'body-end' as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ExternalScriptSchema)(externalScript)

    // THEN: Relative path should be accepted
    expect(result.src).toBe('./js/app.js')
  })

  test('should accept external script with required src only', () => {
    // GIVEN: Minimal script configuration
    const externalScript = {
      src: 'https://cdn.example.com/lib.js',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ExternalScriptSchema)(externalScript)

    // THEN: Minimal configuration should be accepted
    expect(result.src).toBe('https://cdn.example.com/lib.js')
    expect(result.async).toBeUndefined()
    expect(result.defer).toBeUndefined()
  })

  test('should reject external script without required src', () => {
    // GIVEN: Script missing src property
    const externalScript = {
      async: true,
    }

    // WHEN: Schema validation is performed
    // THEN: Should be rejected (src is required)
    expect(() => Schema.decodeUnknownSync(ExternalScriptSchema)(externalScript)).toThrow()
  })
})

describe('ExternalScriptsSchema', () => {
  test('should accept array with multiple external scripts', () => {
    // GIVEN: Multiple external libraries
    const externalScripts = [
      {
        src: 'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
        defer: true,
        position: 'head' as const,
      },
      {
        src: 'https://cdn.jsdelivr.net/npm/chart.js',
        async: true,
      },
      {
        src: './js/app.js',
        module: true,
        position: 'body-end' as const,
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ExternalScriptsSchema)(externalScripts)

    // THEN: All scripts should be accepted
    expect(result.length).toBe(3)
    expect(result[0]?.src).toBe('https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js')
    expect(result[1]?.src).toBe('https://cdn.jsdelivr.net/npm/chart.js')
    expect(result[2]?.src).toBe('./js/app.js')
  })

  test('should accept empty external scripts array', () => {
    // GIVEN: No external scripts
    const externalScripts: unknown[] = []

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ExternalScriptsSchema)(externalScripts)

    // THEN: Empty array should be accepted
    expect(result).toEqual([])
  })
})
