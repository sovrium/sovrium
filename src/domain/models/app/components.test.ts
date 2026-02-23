/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { ComponentsSchema } from './components'

describe('ComponentsSchema', () => {
  test('should accept empty components array', () => {
    // GIVEN: Empty components array
    const components: unknown[] = []

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentsSchema)(components)

    // THEN: Empty array should be accepted
    expect(result).toEqual([])
  })

  test('should accept array with single component template', () => {
    // GIVEN: Array with one component template
    const components = [
      {
        name: 'simple-component',
        type: 'div',
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentsSchema)(components)

    // THEN: Array should be accepted
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('simple-component')
  })

  test('should accept array with multiple component templates', () => {
    // GIVEN: Array with multiple component templates
    const components = [
      {
        name: 'icon-badge',
        type: 'badge',
      },
      {
        name: 'section-header',
        type: 'container',
      },
      {
        name: 'feature-card',
        type: 'card',
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentsSchema)(components)

    // THEN: All component templates should be accepted
    expect(result).toHaveLength(3)
    expect(result[0]?.name).toBe('icon-badge')
    expect(result[1]?.name).toBe('section-header')
    expect(result[2]?.name).toBe('feature-card')
  })

  test('should accept component templates with props', () => {
    // GIVEN: Component templates with props containing variables
    const components = [
      {
        name: 'cta-button',
        type: 'button',
        props: {
          variant: '$variant',
        },
        content: '$label',
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentsSchema)(components)

    // THEN: Component template with props should be accepted
    expect(result[0]?.props?.variant).toBe('$variant')
    expect(result[0]?.content).toBe('$label')
  })

  test('should accept component templates with children', () => {
    // GIVEN: Component templates with nested children
    const components = [
      {
        name: 'card-with-header',
        type: 'card',
        children: [
          {
            type: 'div',
            props: {
              className: 'card-header',
            },
            children: [
              {
                type: 'text',
                props: {
                  level: 'h3',
                },
                content: '$title',
              },
            ],
          },
        ],
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentsSchema)(components)

    // THEN: Component template with children should be accepted
    expect(result[0]?.children).toHaveLength(1)
    expect(result[0]?.children?.[0]?.type).toBe('div')
  })

  test('should accept icon-badge and section-header component template examples', () => {
    // GIVEN: Example component templates from schema
    const components = [
      {
        name: 'icon-badge',
        type: 'badge',
        props: {
          color: '$color',
        },
        children: [
          {
            type: 'icon',
            props: {
              name: '$icon',
              size: 4,
            },
          },
          {
            type: 'text',
            props: {
              level: 'span',
            },
            content: '$text',
          },
        ],
      },
      {
        name: 'section-header',
        type: 'container',
        props: {
          className: 'text-center mb-12',
        },
        children: [
          {
            type: 'text',
            props: {
              level: 'h2',
              className: 'text-$titleColor text-4xl mb-4',
            },
            content: '$title',
          },
          {
            type: 'text',
            props: {
              level: 'p',
            },
            content: '$subtitle',
          },
        ],
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentsSchema)(components)

    // THEN: Both example component templates should be accepted
    expect(result).toHaveLength(2)
    expect(result[0]?.name).toBe('icon-badge')
    expect(result[1]?.name).toBe('section-header')
  })

  test('should accept component templates with various types', () => {
    // GIVEN: Component templates with different types
    const components = [
      { name: 'layout', type: 'container' },
      { name: 'row', type: 'flex' },
      { name: 'columns', type: 'grid' },
      { name: 'panel', type: 'card' },
      { name: 'heading', type: 'text' },
      { name: 'cta', type: 'button' },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentsSchema)(components)

    // THEN: All types should be accepted
    expect(result).toHaveLength(6)
    expect(result.map((c) => c.type)).toEqual([
      'container',
      'flex',
      'grid',
      'card',
      'text',
      'button',
    ])
  })

  test('should accept component templates for DRY principle', () => {
    // GIVEN: Component template that can be reused
    const components = [
      {
        name: 'cta-button',
        type: 'button',
        props: {
          variant: '$variant',
        },
        content: '$label',
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentsSchema)(components)

    // THEN: Reusable component template should be accepted
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('cta-button')
    expect(result[0]?.props?.variant).toBe('$variant')
  })

  test('should accept component templates as component library', () => {
    // GIVEN: Multiple component templates defining UI patterns
    const components = [
      {
        name: 'cta-button',
        type: 'button',
        content: '$label',
      },
      {
        name: 'icon-badge',
        type: 'badge',
        props: {
          color: '$color',
        },
      },
      {
        name: 'feature-card',
        type: 'card',
        children: [],
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentsSchema)(components)

    // THEN: Component template library should be accepted
    expect(result).toHaveLength(3)
    expect(result.map((c) => c.name)).toEqual(['cta-button', 'icon-badge', 'feature-card'])
  })

  test('should accept component templates with complex nested structures', () => {
    // GIVEN: Component template with deeply nested children
    const components = [
      {
        name: 'card-with-header',
        type: 'card',
        children: [
          {
            type: 'div',
            props: {
              className: 'card-header',
            },
            children: [
              {
                type: 'text',
                props: {
                  level: 'h3',
                },
                content: '$title',
              },
              {
                type: 'text',
                props: {
                  level: 'p',
                },
                content: '$subtitle',
              },
            ],
          },
          {
            type: 'div',
            props: {
              className: 'card-body',
            },
            content: '$bodyText',
          },
        ],
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentsSchema)(components)

    // THEN: Complex nested structure should be accepted
    expect(result[0]?.children).toHaveLength(2)
    expect(result[0]?.children?.[0]?.children).toHaveLength(2)
  })

  test('should reject component templates with duplicate names', () => {
    // GIVEN: Components array with duplicate component names
    const components = [
      {
        name: 'duplicate-name',
        type: 'div',
      },
      {
        name: 'duplicate-name',
        type: 'span',
      },
    ]

    // WHEN: Schema validation is performed
    // THEN: Validation should fail with uniqueness error
    expect(() => {
      Schema.decodeUnknownSync(ComponentsSchema)(components)
    }).toThrow(/unique/i)
  })

  test('should accept component templates with unique names', () => {
    // GIVEN: Components array with unique names
    const components = [
      {
        name: 'component-1',
        type: 'div',
      },
      {
        name: 'component-2',
        type: 'span',
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentsSchema)(components)

    // THEN: All component templates should be accepted
    expect(result).toHaveLength(2)
    expect(result[0]?.name).toBe('component-1')
    expect(result[1]?.name).toBe('component-2')
  })
})
