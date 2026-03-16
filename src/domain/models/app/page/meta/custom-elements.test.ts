/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { CustomElementsSchema } from './custom-elements'

describe('CustomElementsSchema', () => {
  test('should accept meta element', () => {
    // GIVEN: Custom meta tag
    const customElements = [
      {
        type: 'meta' as const,
        attrs: {
          name: 'theme-color',
          content: '#FFAF00',
        },
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(CustomElementsSchema)(customElements)

    // THEN: Meta element should be accepted
    expect(result[0].type).toBe('meta')
    expect(result[0].attrs?.name).toBe('theme-color')
  })

  test('should accept link element', () => {
    // GIVEN: Custom link tag (preconnect)
    const customElements = [
      {
        type: 'link' as const,
        attrs: {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
        },
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(CustomElementsSchema)(customElements)

    // THEN: Link element should be accepted
    expect(result[0].type).toBe('link')
    expect(result[0].attrs?.rel).toBe('preconnect')
  })

  test('should accept script element with content', () => {
    // GIVEN: Inline script element
    const customElements = [
      {
        type: 'script' as const,
        content: "console.log('Custom script');",
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(CustomElementsSchema)(customElements)

    // THEN: Script with content should be accepted
    expect(result[0].type).toBe('script')
    expect(result[0].content).toContain('console.log')
  })

  test('should accept style element with content', () => {
    // GIVEN: Inline CSS styles
    const customElements = [
      {
        type: 'style' as const,
        content: 'body { margin: 0; padding: 0; }',
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(CustomElementsSchema)(customElements)

    // THEN: Style with content should be accepted
    expect(result[0].type).toBe('style')
    expect(result[0].content).toContain('body')
  })

  test('should accept base element', () => {
    // GIVEN: Base URL element
    const customElements = [
      {
        type: 'base' as const,
        attrs: {
          href: 'https://example.com/',
        },
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(CustomElementsSchema)(customElements)

    // THEN: Base element should be accepted
    expect(result[0].type).toBe('base')
  })

  test('should accept kebab-case attribute names', () => {
    // GIVEN: Element with kebab-case attributes
    const customElements = [
      {
        type: 'meta' as const,
        attrs: {
          'http-equiv': 'X-UA-Compatible',
          content: 'IE=edge',
        },
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(CustomElementsSchema)(customElements)

    // THEN: Kebab-case attributes should be accepted
    expect(result[0].attrs?.['http-equiv']).toBe('X-UA-Compatible')
  })

  test('should accept multiple custom elements', () => {
    // GIVEN: Array of custom elements
    const customElements = [
      {
        type: 'meta' as const,
        attrs: { name: 'theme-color', content: '#FFAF00' },
      },
      {
        type: 'link' as const,
        attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com' },
      },
      {
        type: 'style' as const,
        content: 'body { margin: 0; }',
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(CustomElementsSchema)(customElements)

    // THEN: All custom elements should be accepted
    expect(result).toHaveLength(3)
    expect(result[0].type).toBe('meta')
    expect(result[1].type).toBe('link')
    expect(result[2].type).toBe('style')
  })

  test('should omit invalid attribute name (starting with number)', () => {
    // GIVEN: Attribute name starting with number
    const customElements = [
      {
        type: 'meta' as const,
        attrs: {
          '123name': 'value',
          name: 'valid',
        },
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(CustomElementsSchema)(customElements)

    // THEN: Invalid attribute should be omitted, valid attribute kept
    expect(result[0].attrs?.['123name']).toBeUndefined()
    expect(result[0].attrs?.name).toBe('valid')
  })

  test('should omit invalid attribute name (with special characters)', () => {
    // GIVEN: Attribute name with special characters
    const customElements = [
      {
        type: 'meta' as const,
        attrs: {
          'name@value': 'test',
          content: 'valid',
        },
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(CustomElementsSchema)(customElements)

    // THEN: Invalid attribute should be omitted, valid attribute kept
    expect(result[0].attrs?.['name@value']).toBeUndefined()
    expect(result[0].attrs?.content).toBe('valid')
  })
})
