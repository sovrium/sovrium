/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { buildClassName, buildElementProps, buildTestId, convertBadgeProps } from './element-props'
import type { Component } from '@/domain/models/app/page/sections'

describe('Element Props', () => {
  describe('buildTestId', () => {
    test('returns block-based testId when blockName provided', () => {
      expect(buildTestId('hero', undefined, 'div')).toBe('block-hero')
    })

    test('includes instance index when provided', () => {
      expect(buildTestId('card', 0, 'div')).toBe('block-card-0')
      expect(buildTestId('card', 5, 'div')).toBe('block-card-5')
    })

    test('returns data-testid from props when no blockName', () => {
      const props = { 'data-testid': 'custom-id' }
      expect(buildTestId(undefined, undefined, 'div', props)).toBe('custom-id')
    })

    test('returns container for container type', () => {
      expect(buildTestId(undefined, undefined, 'container')).toBe('container')
    })

    test('returns flex for flex type', () => {
      expect(buildTestId(undefined, undefined, 'flex')).toBe('flex')
    })

    test('returns undefined for other types', () => {
      expect(buildTestId(undefined, undefined, 'div')).toBeUndefined()
      expect(buildTestId(undefined, undefined, 'section')).toBeUndefined()
    })

    test('prioritizes blockName over other options', () => {
      const props = { 'data-testid': 'custom-id' }
      expect(buildTestId('hero', 0, 'container', props)).toBe('block-hero-0')
    })
  })

  describe('buildClassName', () => {
    test('returns undefined when no classes apply', () => {
      expect(buildClassName('div')).toBeUndefined()
    })

    test('returns flex classes for flex type', () => {
      const result = buildClassName('flex', { align: 'center', gap: 4 })
      expect(result).toContain('flex')
      expect(result).toContain('items-center')
      expect(result).toContain('gap-4')
    })

    test('combines flex classes with custom className', () => {
      const result = buildClassName('flex', { align: 'center', className: 'custom-flex' })
      expect(result).toContain('flex')
      expect(result).toContain('items-center')
      expect(result).toContain('custom-flex')
    })

    test('returns grid classes for grid type', () => {
      const result = buildClassName('grid', { columns: 2, responsive: { md: 3 } })
      expect(result).toContain('grid')
      expect(result).toContain('grid-cols-2')
      expect(result).toContain('md:grid-cols-3')
    })

    test('combines grid classes with custom className', () => {
      const result = buildClassName('grid', {
        columns: 2,
        responsive: { md: 3 },
        className: 'custom-grid',
      })
      expect(result).toContain('grid')
      expect(result).toContain('grid-cols-2')
      expect(result).toContain('md:grid-cols-3')
      expect(result).toContain('custom-grid')
    })

    test('adds type as CSS class for card', () => {
      expect(buildClassName('card')).toBe('card')
    })

    test('adds type as CSS class for badge', () => {
      expect(buildClassName('badge')).toBe('badge')
    })

    test('combines type class with custom className', () => {
      expect(buildClassName('card', { className: 'custom-card' })).toBe('card custom-card')
      expect(buildClassName('badge', { className: 'custom-badge' })).toBe('badge custom-badge')
    })

    test('returns custom className for types without CSS classes', () => {
      expect(buildClassName('div', { className: 'my-class' })).toBe('my-class')
      expect(buildClassName('section', { className: 'section-class' })).toBe('section-class')
    })
  })

  describe('buildElementProps', () => {
    const baseComponent: Component = {
      type: 'div',
      props: {},
    }

    test('returns basic props with className and data-testid', () => {
      const result = buildElementProps({
        component: baseComponent,
        finalClassName: 'my-class',
        testId: 'test-id',
      })

      expect(result).toMatchObject({
        className: 'my-class',
        'data-testid': 'test-id',
      })
    })

    test('includes substituted props', () => {
      const result = buildElementProps({
        component: baseComponent,
        substitutedProps: { id: 'my-id', title: 'My Title' },
        finalClassName: 'my-class',
      })

      expect(result).toMatchObject({
        id: 'my-id',
        title: 'My Title',
        className: 'my-class',
      })
    })

    test('includes style when provided', () => {
      const result = buildElementProps({
        component: baseComponent,
        styleWithShadow: { color: 'red', padding: '10px' },
      })

      expect(result).toHaveProperty('style')
      expect(result.style).toMatchObject({
        color: 'red',
        padding: '10px',
      })
    })

    test('adds block data attributes when blockName provided', () => {
      const result = buildElementProps({
        component: baseComponent,
        blockName: 'hero',
      })

      expect(result).toMatchObject({
        'data-block': 'hero',
        'data-type': 'div',
      })
    })

    test('adds role=group for container types with children', () => {
      const containerComponent: Component = {
        type: 'container',
        props: {},
      }
      const result = buildElementProps({
        component: containerComponent,
        blockName: 'layout',
        hasContent: true,
        children: [{ type: 'div', props: {} }],
      })

      expect(result).toHaveProperty('role', 'group')
    })

    test('does not add role=group for container without children', () => {
      const containerComponent: Component = {
        type: 'container',
        props: {},
      }
      const result = buildElementProps({
        component: containerComponent,
        blockName: 'layout',
        hasContent: true,
        children: [],
      })

      expect(result).not.toHaveProperty('role')
    })

    test('adds translation data attributes when provided', () => {
      const result = buildElementProps({
        component: baseComponent,
        firstTranslationKey: 'common.welcome',
        translationData: { 'en-US': 'Welcome', 'fr-FR': 'Bienvenue' },
      })

      expect(result).toMatchObject({
        'data-translation-key': 'common.welcome',
        'data-translations': JSON.stringify({ 'en-US': 'Welcome', 'fr-FR': 'Bienvenue' }),
      })
    })

    test('adds scroll animation attribute when hasScrollAnimation is true', () => {
      const result = buildElementProps({
        component: baseComponent,
        hasScrollAnimation: true,
      })

      expect(result).toHaveProperty('data-scroll-animation', 'scale-up')
    })

    test('adds empty style for blocks without content', () => {
      const result = buildElementProps({
        component: baseComponent,
        blockName: 'placeholder',
        hasContent: false,
        styleWithShadow: { color: 'blue' },
      })

      expect(result.style).toMatchObject({
        color: 'blue',
        minHeight: '1px',
        minWidth: '1px',
        display: 'inline-block',
      })
    })

    test('adds empty style for grid without content', () => {
      const gridComponent: Component = {
        type: 'grid',
        props: {},
      }
      const result = buildElementProps({
        component: gridComponent,
        hasContent: false,
        styleWithShadow: { padding: '10px' },
      })

      expect(result.style).toMatchObject({
        padding: '10px',
        minHeight: '100px',
        minWidth: '100px',
      })
    })

    test('builds complete props with all features', () => {
      const cardComponent: Component = {
        type: 'card',
        props: {},
      }
      const result = buildElementProps({
        component: cardComponent,
        substitutedProps: { id: 'card-1' },
        finalClassName: 'card elevated',
        styleWithShadow: { padding: '20px', boxShadow: 'var(--shadow-md)' },
        testId: 'block-featured-0',
        blockName: 'featured',
        firstTranslationKey: 'card.title',
        translationData: { 'en-US': 'Title', 'fr-FR': 'Titre' },
        hasScrollAnimation: true,
        hasContent: true,
        children: [{ type: 'div', props: {} }],
      })

      expect(result).toMatchObject({
        id: 'card-1',
        className: 'card elevated',
        'data-testid': 'block-featured-0',
        'data-block': 'featured',
        'data-type': 'card',
        'data-translation-key': 'card.title',
        'data-scroll-animation': 'scale-up',
        role: 'group',
      })
      expect(result).toHaveProperty('style')
      expect(result).toHaveProperty('data-translations')
    })
  })

  describe('convertBadgeProps', () => {
    test('preserves standard HTML attributes', () => {
      const props = {
        className: 'badge-primary',
        style: { color: 'white' },
        id: 'badge-1',
        role: 'status',
      }
      const result = convertBadgeProps(props)
      expect(result).toEqual(props)
    })

    test('preserves data-* attributes', () => {
      const props = {
        'data-testid': 'my-badge',
        'data-custom': 'value',
        'data-block': 'badge-block',
      }
      const result = convertBadgeProps(props)
      expect(result).toEqual(props)
    })

    test('preserves aria-* attributes', () => {
      const props = {
        'aria-label': 'Status badge',
        'aria-live': 'polite',
      }
      const result = convertBadgeProps(props)
      expect(result).toEqual(props)
    })

    test('converts custom props to data-* attributes', () => {
      const props = {
        variant: 'primary',
        size: 'small',
        rounded: true,
      }
      const result = convertBadgeProps(props)
      expect(result).toEqual({
        'data-variant': 'primary',
        'data-size': 'small',
        'data-rounded': true,
      })
    })

    test('handles mixed standard and custom props', () => {
      const props = {
        className: 'badge',
        variant: 'success',
        id: 'status-badge',
        size: 'large',
        'data-custom': 'existing',
        'aria-label': 'Success',
      }
      const result = convertBadgeProps(props)
      expect(result).toEqual({
        className: 'badge',
        'data-variant': 'success',
        id: 'status-badge',
        'data-size': 'large',
        'data-custom': 'existing',
        'aria-label': 'Success',
      })
    })

    test('handles empty props object', () => {
      const result = convertBadgeProps({})
      expect(result).toEqual({})
    })

    test('does not convert already prefixed data- props', () => {
      const props = {
        'data-variant': 'info',
        custom: 'value',
      }
      const result = convertBadgeProps(props)
      expect(result).toEqual({
        'data-variant': 'info',
        'data-custom': 'value',
      })
    })
  })
})
