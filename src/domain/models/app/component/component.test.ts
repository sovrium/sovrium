/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { ComponentTemplateNameSchema, ComponentTemplateSchema } from './component'

describe('ComponentTemplateNameSchema', () => {
  test('should accept kebab-case names', () => {
    // GIVEN: Valid kebab-case component template names
    const names = ['icon-badge', 'section-header', 'feature-card', 'cta-button-2']

    // WHEN: Schema validation is performed on each
    const results = names.map((name) => Schema.decodeUnknownSync(ComponentTemplateNameSchema)(name))

    // THEN: All names should be accepted
    expect(results).toEqual(names)
  })

  test('should accept names starting with lowercase letter', () => {
    // GIVEN: Name starting with lowercase
    const name = 'button'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentTemplateNameSchema)(name)

    // THEN: Name should be accepted
    expect(result).toBe('button')
  })

  test('should accept names with numbers', () => {
    // GIVEN: Component template names with numbers
    const names = ['component1', 'section-2', 'card-3']

    // WHEN: Schema validation is performed on each
    const results = names.map((name) => Schema.decodeUnknownSync(ComponentTemplateNameSchema)(name))

    // THEN: All names should be accepted
    expect(results).toEqual(names)
  })

  test('should reject names starting with uppercase', () => {
    // GIVEN: Name starting with uppercase
    const name = 'IconBadge'

    // WHEN: Schema validation is performed
    // THEN: Name should be rejected
    expect(() => Schema.decodeUnknownSync(ComponentTemplateNameSchema)(name)).toThrow()
  })

  test('should reject names with underscores', () => {
    // GIVEN: Name with underscores
    const name = 'icon_badge'

    // WHEN: Schema validation is performed
    // THEN: Name should be rejected (only hyphens allowed)
    expect(() => Schema.decodeUnknownSync(ComponentTemplateNameSchema)(name)).toThrow()
  })

  test('should reject names starting with number', () => {
    // GIVEN: Name starting with number
    const name = '2-columns'

    // WHEN: Schema validation is performed
    // THEN: Name should be rejected
    expect(() => Schema.decodeUnknownSync(ComponentTemplateNameSchema)(name)).toThrow()
  })

  test('should reject names with spaces', () => {
    // GIVEN: Name with spaces
    const name = 'section header'

    // WHEN: Schema validation is performed
    // THEN: Name should be rejected
    expect(() => Schema.decodeUnknownSync(ComponentTemplateNameSchema)(name)).toThrow()
  })

  test('should reject empty string', () => {
    // GIVEN: Empty name
    const name = ''

    // WHEN: Schema validation is performed
    // THEN: Empty name should be rejected
    expect(() => Schema.decodeUnknownSync(ComponentTemplateNameSchema)(name)).toThrow()
  })
})

describe('ComponentTemplateSchema', () => {
  test('should accept component template with only required properties', () => {
    // GIVEN: Minimal component template with name and type
    const template = {
      name: 'simple-component',
      type: 'div',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentTemplateSchema)(template)

    // THEN: Component template should be accepted
    expect(result.name).toBe('simple-component')
    expect(result.type).toBe('div')
    expect(result.props).toBeUndefined()
    expect(result.children).toBeUndefined()
    expect(result.content).toBeUndefined()
  })

  test('should accept component template with type variations', () => {
    // GIVEN: Component templates with different types
    const types = ['container', 'flex', 'grid', 'card', 'text', 'button']

    // WHEN: Schema validation is performed on each
    const results = types.map((type) =>
      Schema.decodeUnknownSync(ComponentTemplateSchema)({ name: 'test', type })
    )

    // THEN: All types should be accepted
    expect(results.map((r) => r.type)).toEqual(types)
  })

  test('should accept component template with props', () => {
    // GIVEN: Component template with props containing variable placeholders
    const template = {
      name: 'styled-box',
      type: 'div',
      props: {
        className: 'box-$variant',
        id: '$boxId',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentTemplateSchema)(template)

    // THEN: Component template with props should be accepted
    expect(result.props?.className).toBe('box-$variant')
    expect(result.props?.id).toBe('$boxId')
  })

  test('should accept component template with children', () => {
    // GIVEN: Component template with nested children
    const template = {
      name: 'card-header',
      type: 'div',
      children: [
        {
          type: 'text',
          props: { level: 'h3' },
          content: '$title',
        },
        {
          type: 'text',
          props: { level: 'p' },
          content: '$subtitle',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentTemplateSchema)(template)

    // THEN: Component template with children should be accepted
    expect(result.children).toHaveLength(2)
    expect(result.children?.[0]?.type).toBe('text')
    expect(result.children?.[1]?.type).toBe('text')
  })

  test('should accept component template with content', () => {
    // GIVEN: Component template with text content
    const template = {
      name: 'alert-message',
      type: 'div',
      content: '$message',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentTemplateSchema)(template)

    // THEN: Component template with content should be accepted
    expect(result.content).toBe('$message')
  })

  test('should accept simple text component example', () => {
    // GIVEN: Simple text component template with className and content variables
    const template = {
      name: 'simple-text',
      type: 'text',
      props: {
        className: 'text-$color text-lg',
      },
      content: '$message',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentTemplateSchema)(template)

    // THEN: Component template should be accepted
    expect(result.name).toBe('simple-text')
    expect(result.type).toBe('text')
    expect(result.props?.className).toBe('text-$color text-lg')
    expect(result.content).toBe('$message')
  })

  test('should accept feature-list-item component example', () => {
    // GIVEN: Feature list item component with icon and text children
    const template = {
      name: 'feature-list-item',
      type: 'flex',
      props: {
        align: 'start',
        gap: 3,
      },
      children: [
        {
          type: 'icon',
          props: {
            name: '$icon',
            color: '$iconColor',
          },
        },
        {
          type: 'text',
          content: '$text',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentTemplateSchema)(template)

    // THEN: Component template should be accepted
    expect(result.name).toBe('feature-list-item')
    expect(result.type).toBe('flex')
    expect(result.props?.align).toBe('start')
    expect(result.children).toHaveLength(2)
  })

  test('should accept component template with complete composition', () => {
    // GIVEN: Complete component template with layout, styling, and content
    const template = {
      name: 'complete-card',
      type: 'card',
      props: {
        className: 'card-$variant p-6 rounded-lg',
      },
      children: [
        {
          type: 'text',
          props: {
            level: 'h3',
            className: 'mb-2',
          },
          content: '$title',
        },
        {
          type: 'text',
          props: {
            level: 'p',
          },
          content: '$description',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentTemplateSchema)(template)

    // THEN: All aspects should be accepted
    expect(result.name).toBe('complete-card')
    expect(result.type).toBe('card')
    expect(result.props?.className).toBe('card-$variant p-6 rounded-lg')
    expect(result.children).toHaveLength(2)
  })

  test('should accept icon-badge component example', () => {
    // GIVEN: Icon badge component from examples
    const template = {
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
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentTemplateSchema)(template)

    // THEN: Component template should be accepted
    expect(result.name).toBe('icon-badge')
    expect(result.type).toBe('badge')
    expect(result.props?.color).toBe('$color')
    expect(result.children).toHaveLength(2)
  })

  test('should accept section-header component example', () => {
    // GIVEN: Section header component from examples
    const template = {
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
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentTemplateSchema)(template)

    // THEN: Component template should be accepted
    expect(result.name).toBe('section-header')
    expect(result.type).toBe('container')
    expect(result.children).toHaveLength(2)
  })

  test('should reject component template without name', () => {
    // GIVEN: Component template missing required name
    const template = {
      type: 'div',
    }

    // WHEN: Schema validation is performed
    // THEN: Component template should be rejected
    expect(() => Schema.decodeUnknownSync(ComponentTemplateSchema)(template)).toThrow()
  })

  test('should reject component template without type', () => {
    // GIVEN: Component template missing required type
    const template = {
      name: 'simple-component',
    }

    // WHEN: Schema validation is performed
    // THEN: Component template should be rejected
    expect(() => Schema.decodeUnknownSync(ComponentTemplateSchema)(template)).toThrow()
  })
})
