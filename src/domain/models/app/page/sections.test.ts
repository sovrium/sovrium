/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { ComponentTypeSchema, ComponentSchema, SectionItemSchema, SectionsSchema } from './sections'

describe('ComponentTypeSchema', () => {
  test('should accept all layout component types', () => {
    // GIVEN: Layout component types
    const layoutTypes = ['section', 'container', 'flex', 'grid'] as const

    // WHEN: Schema validation is performed on each
    const results = layoutTypes.map((type) => Schema.decodeUnknownSync(ComponentTypeSchema)(type))

    // THEN: All layout types should be accepted
    expect(results).toEqual([...layoutTypes])
  })

  test('should accept all content component types', () => {
    // GIVEN: Content component types
    const contentTypes = ['text', 'icon', 'image', 'customHTML'] as const

    // WHEN: Schema validation is performed on each
    const results = contentTypes.map((type) => Schema.decodeUnknownSync(ComponentTypeSchema)(type))

    // THEN: All content types should be accepted
    expect(results).toEqual([...contentTypes])
  })

  test('should accept all interactive component types', () => {
    // GIVEN: Interactive component types
    const interactiveTypes = ['button', 'link', 'accordion'] as const

    // WHEN: Schema validation is performed on each
    const results = interactiveTypes.map((type) =>
      Schema.decodeUnknownSync(ComponentTypeSchema)(type)
    )

    // THEN: All interactive types should be accepted
    expect(results).toEqual([...interactiveTypes])
  })

  test('should accept all grouping component types', () => {
    // GIVEN: Grouping component types
    const groupingTypes = ['card', 'badge', 'timeline'] as const

    // WHEN: Schema validation is performed on each
    const results = groupingTypes.map((type) => Schema.decodeUnknownSync(ComponentTypeSchema)(type))

    // THEN: All grouping types should be accepted
    expect(results).toEqual([...groupingTypes])
  })

  test('should accept all media component types', () => {
    // GIVEN: Media component types
    const mediaTypes = ['video', 'audio', 'iframe'] as const

    // WHEN: Schema validation is performed on each
    const results = mediaTypes.map((type) => Schema.decodeUnknownSync(ComponentTypeSchema)(type))

    // THEN: All media types should be accepted
    expect(results).toEqual([...mediaTypes])
  })

  test('should accept all form component types', () => {
    // GIVEN: Form component types
    const formTypes = ['form', 'input'] as const

    // WHEN: Schema validation is performed on each
    const results = formTypes.map((type) => Schema.decodeUnknownSync(ComponentTypeSchema)(type))

    // THEN: All form types should be accepted
    expect(results).toEqual([...formTypes])
  })

  test('should reject invalid component type', () => {
    // GIVEN: Invalid component type
    const componentType = 'invalid'

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(ComponentTypeSchema)(componentType)).toThrow()
  })
})

describe('ComponentSchema', () => {
  test('should accept component with type only', () => {
    // GIVEN: Minimal component with only type
    const component = {
      type: 'section',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentSchema)(component)

    // THEN: Component should be accepted
    expect(result.type).toBe('section')
  })

  test('should accept component with type and props', () => {
    // GIVEN: Component with props
    const component = {
      type: 'section',
      props: {
        id: 'hero',
        className: 'min-h-screen',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentSchema)(component)

    // THEN: Component with props should be accepted
    expect(result.type).toBe('section')
    expect(result.props?.id).toBe('hero')
    expect(result.props?.className).toBe('min-h-screen')
  })

  test('should accept component with content', () => {
    // GIVEN: Text component with content
    const component = {
      type: 'text',
      content: 'Welcome to our platform',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentSchema)(component)

    // THEN: Component with content should be accepted
    expect(result.type).toBe('text')
    expect(result.content).toBe('Welcome to our platform')
  })

  test('should accept component with interactions', () => {
    // GIVEN: Component with hover interaction
    const component = {
      type: 'button',
      interactions: {
        hover: {
          transform: 'scale(1.05)',
          duration: '200ms',
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentSchema)(component)

    // THEN: Component with interactions should be accepted
    expect(result.type).toBe('button')
    expect(result.interactions?.hover?.transform).toBe('scale(1.05)')
  })

  test('should accept component with responsive overrides', () => {
    // GIVEN: Component with responsive breakpoints
    const component = {
      type: 'section',
      props: {
        className: 'bg-white',
      },
      responsive: {
        md: {
          props: {
            className: 'bg-gray-100',
          },
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentSchema)(component)

    // THEN: Component with responsive should be accepted
    expect(result.type).toBe('section')
    expect(result.responsive?.md?.props?.className).toBe('bg-gray-100')
  })

  test('should accept component with nested children', () => {
    // GIVEN: Component with children array
    const component = {
      type: 'section',
      children: [
        {
          type: 'text',
          content: 'Hello',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentSchema)(component)

    // THEN: Component with children should be accepted
    expect(result.type).toBe('section')
    expect(result.children).toBeDefined()
    expect(result.children?.length).toBe(1)
  })

  test('should accept deeply nested component structure', () => {
    // GIVEN: Deeply nested component tree
    const component = {
      type: 'section',
      props: {
        id: 'hero',
        className: 'min-h-screen',
      },
      children: [
        {
          type: 'container',
          props: {
            maxWidth: 'max-w-7xl',
          },
          children: [
            {
              type: 'flex',
              props: {
                direction: 'column',
              },
              children: [
                {
                  type: 'text',
                  props: {
                    level: 'h1',
                  },
                  content: 'Welcome',
                },
              ],
            },
          ],
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentSchema)(component)

    // THEN: Deeply nested structure should be accepted
    expect(result.type).toBe('section')
    expect(result.children?.[0]?.type).toBe('container')
    expect(result.children?.[0]?.children?.[0]?.type).toBe('flex')
    expect(result.children?.[0]?.children?.[0]?.children?.[0]?.type).toBe('text')
    expect(result.children?.[0]?.children?.[0]?.children?.[0]?.content).toBe('Welcome')
  })

  test('should accept component with all properties configured', () => {
    // GIVEN: Complete component configuration
    const component = {
      type: 'section',
      props: {
        id: 'hero',
        className: 'min-h-screen bg-gradient',
      },
      children: [
        {
          type: 'text',
          props: {
            level: 'h1',
          },
          content: 'Welcome',
        },
      ],
      interactions: {
        entrance: {
          animation: 'fadeIn',
        },
      },
      responsive: {
        md: {
          props: {
            className: 'min-h-screen bg-gradient-2xl',
          },
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentSchema)(component)

    // THEN: All properties should be accepted
    expect(result.type).toBe('section')
    expect(result.props?.id).toBe('hero')
    expect(result.children?.length).toBe(1)
    expect(result.interactions?.entrance?.animation).toBe('fadeIn')
    expect(result.responsive?.md?.props?.className).toBe('min-h-screen bg-gradient-2xl')
  })
})

describe('SectionItemSchema', () => {
  test('should accept direct component definition', () => {
    // GIVEN: Direct component
    const sectionItem = {
      type: 'section',
      props: {
        id: 'hero',
      },
      children: [
        {
          type: 'text',
          content: 'Welcome',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(SectionItemSchema)(sectionItem)

    // THEN: Direct component should be accepted
    expect(result.type).toBe('section')
  })

  test('should accept component reference', () => {
    // GIVEN: Component reference
    const sectionItem = {
      $ref: 'section-header',
      vars: {
        title: 'Our Features',
        subtitle: 'Everything you need',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(SectionItemSchema)(sectionItem)

    // THEN: Component reference should be accepted
    expect(result.$ref).toBe('section-header')
    expect(result.vars?.title).toBe('Our Features')
  })
})

describe('SectionsSchema', () => {
  test('should accept array of direct components', () => {
    // GIVEN: Array of components
    const sections = [
      {
        type: 'section',
        props: {
          id: 'hero',
        },
        children: [
          {
            type: 'text',
            content: 'Welcome',
          },
        ],
      },
      {
        type: 'section',
        props: {
          id: 'features',
        },
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(SectionsSchema)(sections)

    // THEN: Array of components should be accepted
    expect(result.length).toBe(2)
    expect(result[0]?.type).toBe('section')
    expect(result[1]?.type).toBe('section')
  })

  test('should accept array of component references', () => {
    // GIVEN: Array of component references
    const sections = [
      {
        $ref: 'section-header',
        vars: {
          title: 'Welcome',
        },
      },
      {
        $ref: 'section-features',
        vars: {
          title: 'Features',
        },
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(SectionsSchema)(sections)

    // THEN: Array of component references should be accepted
    expect(result.length).toBe(2)
    expect(result[0]?.$ref).toBe('section-header')
    expect(result[1]?.$ref).toBe('section-features')
  })

  test('should accept mixed array of components and component references', () => {
    // GIVEN: Mixed array
    const sections = [
      {
        type: 'section',
        props: {
          id: 'hero',
        },
        children: [
          {
            type: 'text',
            content: 'Welcome',
          },
        ],
      },
      {
        $ref: 'section-header',
        vars: {
          title: 'Our Features',
          subtitle: 'Everything you need to succeed',
        },
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(SectionsSchema)(sections)

    // THEN: Mixed array should be accepted
    expect(result.length).toBe(2)
    expect(result[0]?.type).toBe('section')
    expect(result[1]?.$ref).toBe('section-header')
  })

  test('should accept empty sections array', () => {
    // GIVEN: Empty sections
    const sections: unknown[] = []

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(SectionsSchema)(sections)

    // THEN: Empty array should be accepted
    expect(result).toEqual([])
  })
})
