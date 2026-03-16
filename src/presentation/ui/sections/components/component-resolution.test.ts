/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { resolveComponent } from './component-resolution'
import type { Components } from '@/domain/models/app/components'

describe('Component Resolution', () => {
  describe('resolveComponent', () => {
    test('returns undefined when components array is undefined', () => {
      const result = resolveComponent('hero', undefined)
      expect(result).toBeUndefined()
    })

    test('returns undefined when components array is empty', () => {
      const result = resolveComponent('hero', [])
      expect(result).toBeUndefined()
    })

    test('returns undefined when component not found', () => {
      const components: Components = [{ name: 'card', type: 'div', props: {} }]
      const result = resolveComponent('hero', components)
      expect(result).toBeUndefined()
    })

    test('resolves component by name', () => {
      const components: Components = [
        { name: 'hero', type: 'section', props: { className: 'hero-section' } },
      ]
      const result = resolveComponent('hero', components)

      expect(result).toBeDefined()
      expect(result?.name).toBe('hero')
      expect(result?.component).toMatchObject({
        type: 'section',
        props: { className: 'hero-section' },
      })
    })

    test('resolves component with content', () => {
      const components: Components = [
        { name: 'text', type: 'p', props: {}, content: 'Static text' },
      ]
      const result = resolveComponent('text', components)

      expect(result?.component).toMatchObject({
        type: 'p',
        content: 'Static text',
      })
    })

    test('resolves component with children', () => {
      const components: Components = [
        {
          name: 'container',
          type: 'div',
          props: {},
          children: [
            { type: 'span', props: {}, content: 'Child 1' },
            { type: 'span', props: {}, content: 'Child 2' },
          ],
        },
      ]
      const result = resolveComponent('container', components)

      expect(result?.component.children).toHaveLength(2)
      expect(result?.component.children?.[0]).toMatchObject({
        type: 'span',
        content: 'Child 1',
      })
    })

    test('substitutes variables in props', () => {
      const components: Components = [
        { name: 'card', type: 'div', props: { className: 'card-$variant' } },
      ]
      const result = resolveComponent('card', components, { variant: 'primary' })

      expect(result?.component.props).toEqual({ className: 'card-primary' })
    })

    test('substitutes variables in content', () => {
      const components: Components = [
        { name: 'greeting', type: 'p', props: {}, content: '$message' },
      ]
      const result = resolveComponent('greeting', components, { message: 'Hello World' })

      expect(result?.component.content).toBe('Hello World')
    })

    test('substitutes variables in children', () => {
      const components: Components = [
        {
          name: 'list',
          type: 'ul',
          props: {},
          children: [
            { type: 'li', props: {}, content: '$item1' },
            { type: 'li', props: {}, content: '$item2' },
          ],
        },
      ]
      const result = resolveComponent('list', components, { item1: 'First', item2: 'Second' })

      expect(result?.component.children?.[0]).toMatchObject({
        type: 'li',
        content: 'First',
      })
      expect(result?.component.children?.[1]).toMatchObject({
        type: 'li',
        content: 'Second',
      })
    })

    test('substitutes variables in nested structures', () => {
      const components: Components = [
        {
          name: 'complex',
          type: 'div',
          props: { className: '$containerClass' },
          children: [
            {
              type: 'h1',
              props: { className: '$headingClass' },
              content: '$title',
            },
            {
              type: 'p',
              props: {},
              content: '$description',
            },
          ],
        },
      ]
      const result = resolveComponent('complex', components, {
        containerClass: 'container',
        headingClass: 'heading',
        title: 'Welcome',
        description: 'This is a test',
      })

      expect(result?.component.props).toEqual({ className: 'container' })
      expect(result?.component.children?.[0]).toMatchObject({
        type: 'h1',
        props: { className: 'heading' },
        content: 'Welcome',
      })
      expect(result?.component.children?.[1]).toMatchObject({
        type: 'p',
        content: 'This is a test',
      })
    })

    test('resolves component without variables when vars not provided', () => {
      const components: Components = [
        {
          name: 'static',
          type: 'div',
          props: { className: 'static-class' },
          content: 'Static content',
        },
      ]
      const result = resolveComponent('static', components)

      expect(result?.component).toMatchObject({
        type: 'div',
        props: { className: 'static-class' },
        content: 'Static content',
      })
    })

    test('leaves variables unsubstituted when vars empty', () => {
      const components: Components = [
        { name: 'template', type: 'div', props: {}, content: '$placeholder' },
      ]
      const result = resolveComponent('template', components, {})

      expect(result?.component.content).toBe('$placeholder')
    })

    test('handles numeric and boolean variables', () => {
      const components: Components = [
        {
          name: 'data',
          type: 'div',
          props: { className: 'count-$count', role: '$active' },
          content: 'Count: $count',
        },
      ]
      const result = resolveComponent('data', components, { count: 42, active: 'status' })

      expect(result?.component.props).toMatchObject({
        className: 'count-42',
        role: 'status',
      })
      expect(result?.component.content).toBe('Count: 42')
    })

    test('finds correct component from multiple components', () => {
      const components: Components = [
        { name: 'first', type: 'div', props: {} },
        { name: 'second', type: 'section', props: {} },
        { name: 'third', type: 'article', props: {} },
      ]
      const result = resolveComponent('second', components)

      expect(result?.name).toBe('second')
      expect(result?.component.type).toBe('section')
    })

    test('handles component with empty props', () => {
      const components: Components = [{ name: 'simple', type: 'div', props: {} }]
      const result = resolveComponent('simple', components)

      expect(result?.component).toMatchObject({
        type: 'div',
        props: {},
      })
    })

    test('handles component with undefined content', () => {
      const components: Components = [{ name: 'empty', type: 'div', props: {}, content: undefined }]
      const result = resolveComponent('empty', components)

      expect(result?.component.content).toBeUndefined()
    })

    test('handles component with undefined children', () => {
      const components: Components = [
        { name: 'leaf', type: 'span', props: {}, children: undefined },
      ]
      const result = resolveComponent('leaf', components)

      expect(result?.component.children).toBeUndefined()
    })
  })
})
