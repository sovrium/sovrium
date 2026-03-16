/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { ResponsiveSchema, VariantOverridesSchema } from './responsive'

describe('VariantOverridesSchema', () => {
  test('should accept overrides with props', () => {
    // GIVEN: Overrides with props
    const overrides = {
      props: {
        className: 'text-2xl text-center',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(VariantOverridesSchema)(overrides)

    // THEN: Props override should be accepted
    expect(result.props?.className).toBe('text-2xl text-center')
  })

  test('should accept overrides with content', () => {
    // GIVEN: Overrides with content
    const overrides = {
      content: 'Welcome!',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(VariantOverridesSchema)(overrides)

    // THEN: Content override should be accepted
    expect(result.content).toBe('Welcome!')
  })

  test('should accept overrides with visible flag', () => {
    // GIVEN: Overrides with visibility
    const overrides = {
      visible: false,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(VariantOverridesSchema)(overrides)

    // THEN: Visible flag should be accepted
    expect(result.visible).toBe(false)
  })

  test('should accept overrides with children array', () => {
    // GIVEN: Overrides with different children
    const overrides = {
      children: [{ type: 'icon' }, { type: 'text' }],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(VariantOverridesSchema)(overrides)

    // THEN: Children override should be accepted
    expect(result.children).toHaveLength(2)
  })

  test('should accept overrides with all properties', () => {
    // GIVEN: Complete overrides
    const overrides = {
      props: { className: 'text-4xl' },
      content: 'Welcome to Our Platform',
      visible: true,
      children: [],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(VariantOverridesSchema)(overrides)

    // THEN: All properties should be accepted
    expect(result.props?.className).toBe('text-4xl')
    expect(result.content).toBe('Welcome to Our Platform')
    expect(result.visible).toBe(true)
    expect(result.children).toEqual([])
  })
})

describe('ResponsiveSchema', () => {
  test('should accept responsive with mobile breakpoint', () => {
    // GIVEN: Mobile-specific overrides
    const responsive = {
      mobile: {
        props: {
          className: 'text-2xl text-center',
        },
        content: 'Welcome!',
        visible: true,
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ResponsiveSchema)(responsive)

    // THEN: Mobile overrides should be accepted
    expect(result.mobile?.props?.className).toBe('text-2xl text-center')
    expect(result.mobile?.content).toBe('Welcome!')
    expect(result.mobile?.visible).toBe(true)
  })

  test('should accept responsive with multiple breakpoints', () => {
    // GIVEN: Overrides for mobile, md, and lg
    const responsive = {
      mobile: {
        props: { className: 'text-2xl text-center' },
        content: 'Welcome!',
      },
      md: {
        props: { className: 'text-4xl text-left' },
        content: 'Welcome to Our Platform',
      },
      lg: {
        props: { className: 'text-6xl text-left font-bold' },
        content: 'Welcome to Our Amazing Platform',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ResponsiveSchema)(responsive)

    // THEN: All breakpoints should be accepted
    expect(result.mobile?.content).toBe('Welcome!')
    expect(result.md?.content).toBe('Welcome to Our Platform')
    expect(result.lg?.content).toBe('Welcome to Our Amazing Platform')
  })

  test('should accept responsive with sm breakpoint', () => {
    // GIVEN: Small breakpoint override
    const responsive = {
      sm: {
        props: {
          className: 'text-3xl',
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ResponsiveSchema)(responsive)

    // THEN: Sm breakpoint should be accepted
    expect(result.sm?.props?.className).toBe('text-3xl')
  })

  test('should accept responsive with xl and 2xl breakpoints', () => {
    // GIVEN: Extra large breakpoints
    const responsive = {
      xl: {
        props: { className: 'text-7xl' },
      },
      '2xl': {
        props: { className: 'text-8xl' },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ResponsiveSchema)(responsive)

    // THEN: XL and 2XL breakpoints should be accepted
    expect(result.xl?.props?.className).toBe('text-7xl')
    expect(result['2xl']?.props?.className).toBe('text-8xl')
  })

  test('should accept responsive with visibility control', () => {
    // GIVEN: Visibility toggles at different breakpoints
    const responsive = {
      mobile: {
        visible: false,
      },
      lg: {
        visible: true,
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ResponsiveSchema)(responsive)

    // THEN: Visibility controls should be accepted
    expect(result.mobile?.visible).toBe(false)
    expect(result.lg?.visible).toBe(true)
  })

  test('should accept responsive with all six breakpoints', () => {
    // GIVEN: Complete responsive configuration
    const responsive = {
      mobile: { content: 'Mobile' },
      sm: { content: 'Small' },
      md: { content: 'Medium' },
      lg: { content: 'Large' },
      xl: { content: 'XL' },
      '2xl': { content: '2XL' },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ResponsiveSchema)(responsive)

    // THEN: All six breakpoints should be accepted
    expect(result.mobile?.content).toBe('Mobile')
    expect(result.sm?.content).toBe('Small')
    expect(result.md?.content).toBe('Medium')
    expect(result.lg?.content).toBe('Large')
    expect(result.xl?.content).toBe('XL')
    expect(result['2xl']?.content).toBe('2XL')
  })

  test('should accept empty responsive object', () => {
    // GIVEN: Empty responsive config
    const responsive = {}

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ResponsiveSchema)(responsive)

    // THEN: Empty object should be accepted
    expect(result).toEqual({})
  })
})
