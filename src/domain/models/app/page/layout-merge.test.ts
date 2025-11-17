/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { mergeLayouts } from './layout-merge'
import type { Layout } from './layout'

describe('mergeLayouts', () => {
  const defaultLayout: Layout = {
    navigation: {
      logo: '/default-logo.svg',
      links: { desktop: [{ label: 'Home', href: '/' }] },
    },
    footer: { enabled: true },
  }

  test('should return default layout when pageLayout is undefined', () => {
    const result = mergeLayouts(defaultLayout, undefined)
    expect(result).toEqual(defaultLayout)
  })

  test('should return undefined when pageLayout is null (explicit override)', () => {
    const result = mergeLayouts(defaultLayout, null)
    expect(result).toBeUndefined()
  })

  test('should merge pageLayout with defaultLayout (extends)', () => {
    const pageLayout: Layout = {
      sidebar: { enabled: true, links: [{ label: 'Docs', href: '/docs' }] },
    }
    const result = mergeLayouts(defaultLayout, pageLayout)
    expect(result).toEqual({
      navigation: {
        logo: '/default-logo.svg',
        links: { desktop: [{ label: 'Home', href: '/' }] },
      },
      footer: { enabled: true },
      sidebar: { enabled: true, links: [{ label: 'Docs', href: '/docs' }] },
    })
  })

  test('should override default components when pageLayout provides them (no default footer)', () => {
    const pageLayout: Layout = {
      navigation: { logo: '/custom-logo.svg' },
    }
    const result = mergeLayouts(defaultLayout, pageLayout)
    // Page specifies navigation only, so only navigation is included (default footer is NOT included)
    expect(result).toEqual({
      navigation: { logo: '/custom-logo.svg' },
    })
  })

  test('should return pageLayout when defaultLayout is undefined', () => {
    const pageLayout: Layout = {
      navigation: { logo: '/page-logo.svg' },
    }
    const result = mergeLayouts(undefined, pageLayout)
    expect(result).toEqual(pageLayout)
  })

  test('should return undefined when both are undefined', () => {
    const result = mergeLayouts(undefined, undefined)
    expect(result).toBeUndefined()
  })

  test('should return undefined when defaultLayout exists but pageLayout is null', () => {
    const result = mergeLayouts(defaultLayout, null)
    expect(result).toBeUndefined()
  })
})
