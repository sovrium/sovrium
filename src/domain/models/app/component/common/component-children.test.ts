/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { ComponentChildElementSchema, ComponentChildrenSchema } from './component-children'

describe('ComponentChildElementSchema', () => {
  test('should accept element with only type', () => {
    // GIVEN: Minimal child element (only type required)
    const element = {
      type: 'div',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentChildElementSchema)(element)

    // THEN: Element should be accepted
    expect(result.type).toBe('div')
  })

  test('should accept element with type and props', () => {
    // GIVEN: Element with props
    const element = {
      type: 'icon',
      props: {
        name: '$icon',
        color: '$color',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentChildElementSchema)(element)

    // THEN: Element with props should be accepted
    expect(result.type).toBe('icon')
    expect(result.props).toEqual({
      name: '$icon',
      color: '$color',
    })
  })

  test('should accept element with type and content', () => {
    // GIVEN: Element with text content
    const element = {
      type: 'text',
      content: '$label',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentChildElementSchema)(element)

    // THEN: Element with content should be accepted
    expect(result.type).toBe('text')
    expect(result.content).toBe('$label')
  })

  test('should accept element with nested children', () => {
    // GIVEN: Element with children array
    const element = {
      type: 'div',
      props: { className: 'container' },
      children: [
        {
          type: 'icon',
          props: { name: 'star' },
        },
        {
          type: 'text',
          content: 'Hello',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentChildElementSchema)(element)

    // THEN: Element with children should be accepted
    expect(result.type).toBe('div')
    expect(result.children).toHaveLength(2)
    expect(result.children?.[0]?.type).toBe('icon')
    expect(result.children?.[1]?.type).toBe('text')
  })

  test('should reject element without type', () => {
    // GIVEN: Element missing required type property
    const element = {
      content: 'text',
    }

    // WHEN: Schema validation is performed
    // THEN: Element should be rejected
    expect(() => Schema.decodeUnknownSync(ComponentChildElementSchema)(element)).toThrow()
  })
})

describe('ComponentChildrenSchema', () => {
  test('should accept array of child elements', () => {
    // GIVEN: Array of child elements
    const children = [
      {
        type: 'icon',
        props: {
          name: '$icon',
          color: '$color',
        },
      },
      {
        type: 'text',
        content: '$label',
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentChildrenSchema)(children)

    // THEN: Children array should be accepted
    expect(result).toHaveLength(2)
    expect(result[0]!.type).toBe('icon')
    expect(result[1]!.type).toBe('text')
  })

  test('should accept deeply nested children', () => {
    // GIVEN: Deeply nested child structure
    const children = [
      {
        type: 'div',
        props: { className: 'outer' },
        children: [
          {
            type: 'div',
            props: { className: 'middle' },
            children: [
              {
                type: 'text',
                content: 'Nested',
              },
            ],
          },
        ],
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentChildrenSchema)(children)

    // THEN: Deeply nested structure should be accepted
    expect(result).toHaveLength(1)
    expect(result[0]!.type).toBe('div')
    expect(result[0]!.children).toHaveLength(1)
  })

  test('should accept empty children array', () => {
    // GIVEN: Empty children array
    const children: unknown[] = []

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentChildrenSchema)(children)

    // THEN: Empty array should be accepted
    expect(result).toEqual([])
  })

  test('should accept children with various component types', () => {
    // GIVEN: Children with different types
    const children = [{ type: 'button' }, { type: 'input' }, { type: 'span' }, { type: 'div' }]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentChildrenSchema)(children)

    // THEN: All component types should be accepted
    expect(result).toHaveLength(4)
    expect(result.map((c) => c.type)).toEqual(['button', 'input', 'span', 'div'])
  })
})
