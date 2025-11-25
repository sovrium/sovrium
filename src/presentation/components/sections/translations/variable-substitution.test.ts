/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  substituteBlockVariables,
  substituteChildrenVariables,
  substitutePropsVariables,
} from './variable-substitution'
import type { Component } from '@/domain/models/app/page/sections'

describe('Variable Substitution', () => {
  describe('substituteBlockVariables', () => {
    test('returns non-string values unchanged', () => {
      const vars = { title: 'Hello' }
      expect(substituteBlockVariables(123, vars)).toBe(123)
      expect(substituteBlockVariables(true, vars)).toBe(true)
      expect(substituteBlockVariables(undefined, vars)).toBeUndefined()
    })

    test('returns string unchanged when no variables', () => {
      expect(substituteBlockVariables('static text', undefined)).toBe('static text')
      expect(substituteBlockVariables('static text', {})).toBe('static text')
    })

    test('returns string unchanged when no $ placeholder', () => {
      const vars = { title: 'Hello' }
      expect(substituteBlockVariables('no placeholders', vars)).toBe('no placeholders')
    })

    test('substitutes single variable', () => {
      const vars = { title: 'Hello' }
      expect(substituteBlockVariables('$title', vars)).toBe('Hello')
    })

    test('substitutes variable in middle of string', () => {
      const vars = { price: '49' }
      expect(substituteBlockVariables('$price/month', vars)).toBe('49/month')
    })

    test('substitutes variable with prefix', () => {
      const vars = { variant: 'primary' }
      expect(substituteBlockVariables('box-$variant', vars)).toBe('box-primary')
    })

    test('substitutes multiple variables', () => {
      const vars = { first: 'Hello', last: 'World' }
      expect(substituteBlockVariables('$first $last', vars)).toBe('Hello World')
    })

    test('substitutes numeric values', () => {
      const vars = { count: 42 }
      expect(substituteBlockVariables('Count: $count', vars)).toBe('Count: 42')
    })

    test('substitutes boolean values', () => {
      const vars = { active: true }
      expect(substituteBlockVariables('Active: $active', vars)).toBe('Active: true')
    })

    test('avoids partial matches with word boundaries', () => {
      const vars = { icon: 'star' }
      // $icon should match, but $iconColor should not match $icon
      expect(substituteBlockVariables('$icon', vars)).toBe('star')
      expect(substituteBlockVariables('$iconColor', vars)).toBe('$iconColor')
    })

    test('handles multiple occurrences of same variable', () => {
      const vars = { name: 'Alice' }
      expect(substituteBlockVariables('$name says: Hello, $name!', vars)).toBe(
        'Alice says: Hello, Alice!'
      )
    })

    // Edge case tests added from audit recommendations
    test('handles empty string variable values', () => {
      const vars = { prefix: '', suffix: '' }
      expect(substituteBlockVariables('$prefix text $suffix', vars)).toBe(' text ')
    })

    test('handles null values gracefully', () => {
      const vars = { value: null as unknown as string }
      expect(substituteBlockVariables('Value: $value', vars)).toBe('Value: null')
    })

    test('handles variables with underscores', () => {
      const vars = { my_var: 'value', another_long_var: 'text' }
      expect(substituteBlockVariables('$my_var and $another_long_var', vars)).toBe('value and text')
    })

    test('handles variables starting with numbers after letter', () => {
      const vars = { color1: 'red', size2x: 'large' }
      expect(substituteBlockVariables('$color1 $size2x', vars)).toBe('red large')
    })

    test('avoids matching variable names that are prefixes', () => {
      const vars = { color: 'blue', colorPrimary: 'red', colorCode: 'abc' }
      expect(substituteBlockVariables('$color', vars)).toBe('blue')
      expect(substituteBlockVariables('$colorPrimary', vars)).toBe('red')
      expect(substituteBlockVariables('$colorCode', vars)).toBe('abc')
      // Should not substitute if exact match doesn't exist
      expect(substituteBlockVariables('$colors', vars)).toBe('$colors')
    })

    test('handles very long variable names', () => {
      const vars = { thisIsAVeryLongVariableNameForTesting: 'works' }
      expect(substituteBlockVariables('$thisIsAVeryLongVariableNameForTesting', vars)).toBe('works')
    })

    test('handles special characters in values', () => {
      const vars = { special: '<div>&"\'</div>' }
      expect(substituteBlockVariables('HTML: $special', vars)).toBe('HTML: <div>&"\'</div>')
    })

    test('handles undefined variable references (leaves unchanged)', () => {
      const vars = { defined: 'value' }
      expect(substituteBlockVariables('$defined $undefined', vars)).toBe('value $undefined')
    })

    test('handles empty vars object', () => {
      const vars = {}
      expect(substituteBlockVariables('$anyVariable', vars)).toBe('$anyVariable')
    })

    test('handles consecutive variables without separator', () => {
      const vars = { first: 'A', second: 'B' }
      expect(substituteBlockVariables('$first$second', vars)).toBe('AB')
    })
  })

  describe('substitutePropsVariables', () => {
    test('returns undefined when props is undefined', () => {
      expect(substitutePropsVariables(undefined, { title: 'Hello' })).toBeUndefined()
    })

    test('returns props unchanged when vars is undefined', () => {
      const props = { className: '$variant' }
      expect(substitutePropsVariables(props, undefined)).toEqual(props)
    })

    test('substitutes variables in string props', () => {
      const vars = { variant: 'primary', id: 'main' }
      const props = { className: 'box-$variant', id: '$id' }
      const result = substitutePropsVariables(props, vars)
      expect(result).toEqual({
        className: 'box-primary',
        id: 'main',
      })
    })

    test('preserves non-string props', () => {
      const vars = { title: 'Hello' }
      const props = { width: 100, visible: true }
      const result = substitutePropsVariables(props, vars)
      expect(result).toEqual(props)
    })

    test('recursively substitutes in nested objects', () => {
      const vars = { color: 'red', padding: '10px' }
      const props = {
        style: {
          color: '$color',
          padding: '$padding',
        },
      }
      const result = substitutePropsVariables(props, vars)
      expect(result).toEqual({
        style: {
          color: 'red',
          padding: '10px',
        },
      })
    })

    test('normalizes ariaLabel to aria-label', () => {
      const vars = { label: 'Main content' }
      const props = { ariaLabel: '$label' }
      const result = substitutePropsVariables(props, vars)
      expect(result).toEqual({ 'aria-label': 'Main content' })
    })

    test('normalizes dataTestId to data-test-id', () => {
      const vars = { id: 'component-1' }
      const props = { dataTestId: '$id' }
      const result = substitutePropsVariables(props, vars)
      expect(result).toEqual({ 'data-test-id': 'component-1' })
    })

    test('does not normalize regular props', () => {
      const vars = { name: 'input' }
      const props = { className: '$name', id: 'main-$name' }
      const result = substitutePropsVariables(props, vars)
      expect(result).toEqual({
        className: 'input',
        id: 'main-input',
      })
    })

    test('handles mixed props with normalization and substitution', () => {
      const vars = { variant: 'primary', label: 'Button' }
      const props = {
        className: 'btn-$variant',
        ariaLabel: '$label',
        id: 'btn-1',
        width: 200,
      }
      const result = substitutePropsVariables(props, vars)
      expect(result).toEqual({
        className: 'btn-primary',
        'aria-label': 'Button',
        id: 'btn-1',
        width: 200,
      })
    })

    test('creates new object (immutable)', () => {
      const vars = { variant: 'primary' }
      const props = { className: '$variant' }
      const result = substitutePropsVariables(props, vars)

      expect(result).not.toBe(props)
      expect(props).toEqual({ className: '$variant' })
    })

    // Edge case tests added from audit recommendations
    test('handles deeply nested objects (stress test)', () => {
      const vars = { color: 'red', size: 'large' }
      const props = {
        level1: {
          level2: {
            level3: {
              level4: {
                color: '$color',
                size: '$size',
              },
            },
          },
        },
      }
      const result = substitutePropsVariables(props, vars)
      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              level4: {
                color: 'red',
                size: 'large',
              },
            },
          },
        },
      })
    })

    test('handles null prop values', () => {
      const vars = { title: 'Hello' }
      const props = { className: '$title', value: null }
      const result = substitutePropsVariables(props, vars)
      expect(result).toEqual({ className: 'Hello', value: null })
    })

    test('handles array values in props (preserves arrays)', () => {
      const vars = { color: 'red' }
      const props = { classes: ['static', '$color'] }
      const result = substitutePropsVariables(props, vars)
      expect(result).toEqual({ classes: ['static', '$color'] }) // Arrays not substituted
    })

    test('handles empty string props', () => {
      const vars = { value: 'replaced' }
      const props = { className: '', placeholder: '$value' }
      const result = substitutePropsVariables(props, vars)
      expect(result).toEqual({ className: '', placeholder: 'replaced' })
    })
  })

  describe('substituteChildrenVariables', () => {
    test('returns undefined when children is undefined', () => {
      expect(substituteChildrenVariables(undefined, { title: 'Hello' })).toBeUndefined()
    })

    test('returns children unchanged when vars is undefined', () => {
      const children = ['$title']
      expect(substituteChildrenVariables(children, undefined)).toEqual(children)
    })

    test('substitutes variables in string children', () => {
      const vars = { greeting: 'Hello', name: 'World' }
      const children = ['$greeting', ' ', '$name']
      const result = substituteChildrenVariables(children, vars)
      expect(result).toEqual(['Hello', ' ', 'World'])
    })

    test('substitutes variables in component props', () => {
      const vars = { variant: 'primary' }
      const children: readonly Component[] = [
        {
          type: 'div',
          props: { className: 'box-$variant' },
        },
      ]
      const result = substituteChildrenVariables(children, vars)
      expect(result).toEqual([
        {
          type: 'div',
          props: { className: 'box-primary' },
        },
      ])
    })

    test('recursively substitutes in nested children', () => {
      const vars = { title: 'Hello', subtitle: 'World' }
      const children: readonly Component[] = [
        {
          type: 'div',
          props: {},
          children: ['$title', { type: 'span', props: {}, content: '$subtitle' }],
        },
      ]
      const result = substituteChildrenVariables(children, vars)
      expect(result).toEqual([
        {
          type: 'div',
          props: {},
          children: ['Hello', { type: 'span', props: {}, content: 'World' }],
        },
      ])
    })

    test('substitutes in component content', () => {
      const vars = { text: 'Button text' }
      const children: readonly Component[] = [
        {
          type: 'button',
          props: {},
          content: '$text',
        },
      ]
      const result = substituteChildrenVariables(children, vars)
      expect(result).toEqual([
        {
          type: 'button',
          props: {},
          content: 'Button text',
        },
      ])
    })

    test('handles mixed string and component children', () => {
      const vars = { greeting: 'Hello', name: 'Alice' }
      const children: readonly (Component | string)[] = [
        '$greeting',
        { type: 'strong', props: {}, content: '$name' },
        '!',
      ]
      const result = substituteChildrenVariables(children, vars)
      expect(result).toEqual(['Hello', { type: 'strong', props: {}, content: 'Alice' }, '!'])
    })

    test('preserves components without variables', () => {
      const vars = { unused: 'value' }
      const children: readonly Component[] = [
        {
          type: 'div',
          props: { className: 'static' },
          content: 'Static content',
        },
      ]
      const result = substituteChildrenVariables(children, vars)
      expect(result).toEqual(children)
    })

    test('creates new array (immutable)', () => {
      const vars = { title: 'Hello' }
      const children = ['$title']
      const result = substituteChildrenVariables(children, vars)

      expect(result).not.toBe(children)
      expect(children).toEqual(['$title'])
    })

    // Edge case tests added from audit recommendations
    test('handles empty children array', () => {
      const vars = { title: 'Hello' }
      const children: readonly (Component | string)[] = []
      const result = substituteChildrenVariables(children, vars)
      expect(result).toEqual([])
    })

    test('handles deeply nested component children (stress test)', () => {
      const vars = { text: 'deep' }
      const children: readonly Component[] = [
        {
          type: 'div',
          props: {},
          children: [
            {
              type: 'div',
              props: {},
              children: [
                {
                  type: 'span',
                  props: {},
                  content: '$text',
                },
              ],
            },
          ],
        },
      ]
      const result = substituteChildrenVariables(children, vars)
      expect(result).toEqual([
        {
          type: 'div',
          props: {},
          children: [
            {
              type: 'div',
              props: {},
              children: [
                {
                  type: 'span',
                  props: {},
                  content: 'deep',
                },
              ],
            },
          ],
        },
      ])
    })

    test('handles components with both content and children', () => {
      const vars = { content: 'Content', child: 'Child' }
      const children: readonly Component[] = [
        {
          type: 'div',
          props: {},
          content: '$content',
          children: ['$child'],
        },
      ]
      const result = substituteChildrenVariables(children, vars)
      expect(result).toEqual([
        {
          type: 'div',
          props: {},
          content: 'Content',
          children: ['Child'],
        },
      ])
    })

    test('handles very large children arrays (performance test)', () => {
      const vars = { item: 'text' }
      const children: readonly string[] = Array.from({ length: 100 }, () => '$item')
      const result = substituteChildrenVariables(children, vars)
      expect(result).toHaveLength(100)
      expect(result.every((child) => child === 'text')).toBe(true)
    })
  })
})
