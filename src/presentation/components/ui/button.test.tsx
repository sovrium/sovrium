/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Button } from './button'

describe('Button Component', () => {
  describe('Basic rendering', () => {
    test('renders button with text content', () => {
      // When
      const html = renderToStaticMarkup(<Button>Click me</Button>)
      // Then
      expect(html).toContain('<button')
      expect(html).toContain('>Click me</button>')
    })

    test('renders button with custom className', () => {
      // When
      const html = renderToStaticMarkup(<Button className="custom-class">Button</Button>)
      // Then
      expect(html).toContain('class="')
      expect(html).toContain('custom-class')
    })

    test('renders disabled button', () => {
      // When
      const html = renderToStaticMarkup(<Button disabled>Disabled</Button>)
      // Then
      expect(html).toContain('disabled=""')
      expect(html).toContain('disabled:opacity-50')
    })

    test('renders button with type attribute', () => {
      // When
      const html = renderToStaticMarkup(<Button type="submit">Submit</Button>)
      // Then
      expect(html).toContain('type="submit"')
    })
  })

  describe('Button variants', () => {
    test('renders primary variant by default', () => {
      // When
      const html = renderToStaticMarkup(<Button>Primary</Button>)
      // Then
      expect(html).toContain('btn-primary')
      expect(html).toContain('bg-primary')
      expect(html).toContain('text-primary-foreground')
      expect(html).toContain('hover:bg-primary/90')
    })

    test('renders secondary variant', () => {
      // When
      const html = renderToStaticMarkup(<Button variant="secondary">Secondary</Button>)
      // Then
      expect(html).toContain('btn-secondary')
      expect(html).toContain('bg-secondary')
      expect(html).toContain('text-secondary-foreground')
      expect(html).toContain('hover:bg-secondary/80')
    })

    test('renders outline variant', () => {
      // When
      const html = renderToStaticMarkup(<Button variant="outline">Outline</Button>)
      // Then
      expect(html).toContain('btn-outline')
      expect(html).toContain('border')
      expect(html).toContain('border-input')
      expect(html).toContain('bg-background')
      expect(html).toContain('hover:bg-accent')
    })

    test('renders ghost variant', () => {
      // When
      const html = renderToStaticMarkup(<Button variant="ghost">Ghost</Button>)
      // Then
      expect(html).toContain('btn-ghost')
      expect(html).toContain('hover:bg-accent')
      expect(html).toContain('hover:text-accent-foreground')
    })

    test('renders link variant', () => {
      // When
      const html = renderToStaticMarkup(<Button variant="link">Link</Button>)
      // Then
      expect(html).toContain('btn-link')
      expect(html).toContain('text-primary')
      expect(html).toContain('underline-offset-4')
      expect(html).toContain('hover:underline')
    })
  })

  describe('Button sizes', () => {
    test('renders medium size by default', () => {
      // When
      const html = renderToStaticMarkup(<Button>Medium</Button>)
      // Then
      expect(html).toContain('btn-md')
      expect(html).toContain('h-10')
      expect(html).toContain('px-4')
      expect(html).toContain('py-2')
    })

    test('renders small size', () => {
      // When
      const html = renderToStaticMarkup(<Button size="sm">Small</Button>)
      // Then
      expect(html).toContain('btn-sm')
      expect(html).toContain('h-9')
      expect(html).toContain('px-3')
    })

    test('renders large size', () => {
      // When
      const html = renderToStaticMarkup(<Button size="lg">Large</Button>)
      // Then
      expect(html).toContain('btn-lg')
      expect(html).toContain('h-11')
      expect(html).toContain('px-8')
    })
  })

  describe('Class merging', () => {
    test('merges custom className with default classes', () => {
      // When
      const html = renderToStaticMarkup(<Button className="bg-purple-500">Custom</Button>)
      // Then
      expect(html).toContain('bg-purple-500')
      expect(html).toContain('btn-primary') // Default variant
    })

    test('preserves non-conflicting classes', () => {
      // When
      const html = renderToStaticMarkup(<Button className="mt-4 mb-2">Spaced</Button>)
      // Then
      expect(html).toContain('mt-4')
      expect(html).toContain('mb-2')
      expect(html).toContain('bg-primary') // Default bg color
    })

    test('handles responsive classes', () => {
      // When
      const html = renderToStaticMarkup(<Button className="md:px-8 lg:px-10">Responsive</Button>)
      // Then
      expect(html).toContain('md:px-8')
      expect(html).toContain('lg:px-10')
      expect(html).toContain('px-4')
    })
  })

  describe('Edge cases', () => {
    test('handles empty string children', () => {
      // When
      const html = renderToStaticMarkup(<Button>{''}</Button>)
      // Then
      expect(html).toContain('<button')
      expect(html).toContain('</button>')
    })

    test('handles multiple children', () => {
      // When
      const html = renderToStaticMarkup(
        <Button>
          <span>Icon</span> Text
        </Button>
      )
      // Then
      expect(html).toContain('<span>Icon</span>')
      expect(html).toContain(' Text')
    })

    test('handles undefined variant', () => {
      // When
      const html = renderToStaticMarkup(<Button variant={undefined}>Default</Button>)
      // Then
      expect(html).toContain('bg-primary') // Default is primary
    })

    test('handles undefined size', () => {
      // When
      const html = renderToStaticMarkup(<Button size={undefined}>Default</Button>)
      // Then
      expect(html).toContain('h-10') // Default is medium
      expect(html).toContain('px-4')
      expect(html).toContain('py-2')
    })

    test('renders with all props combined', () => {
      // When
      const html = renderToStaticMarkup(
        <Button
          variant="secondary"
          size="lg"
          disabled
          className="mt-8"
          type="button"
        >
          Complex Button
        </Button>
      )
      // Then
      expect(html).toContain('bg-secondary')
      expect(html).toContain('btn-lg')
      expect(html).toContain('h-11')
      expect(html).toContain('px-8')
      expect(html).toContain('mt-8')
      expect(html).toContain('disabled=""')
      expect(html).toContain('type="button"')
      expect(html).toContain('Complex Button')
    })
  })
})
