/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Icon } from './icon'

describe('Icon Component', () => {
  describe('Rendering valid icons', () => {
    test('renders download icon', () => {
      // When
      const html = renderToStaticMarkup(<Icon name="download" />)

      // Then
      expect(html).toContain('data-testid="icon"')
      expect(html).toContain('<svg')
    })

    test('renders arrow-right icon', () => {
      // When
      const html = renderToStaticMarkup(<Icon name="arrow-right" />)

      // Then
      expect(html).toContain('data-testid="icon"')
      expect(html).toContain('<svg')
    })

    test('renders rocket icon', () => {
      // When
      const html = renderToStaticMarkup(<Icon name="rocket" />)

      // Then
      expect(html).toContain('data-testid="icon"')
      expect(html).toContain('<svg')
    })

    test('renders external-link icon', () => {
      // When
      const html = renderToStaticMarkup(<Icon name="external-link" />)

      // Then
      expect(html).toContain('data-testid="icon"')
      expect(html).toContain('<svg')
    })
  })

  describe('Handling invalid icons', () => {
    test('returns undefined for unknown icon name', () => {
      // When
      const html = renderToStaticMarkup(<Icon name="unknown-icon" />)

      // Then
      expect(html).toBe('')
    })

    test('returns undefined for empty icon name', () => {
      // When
      const html = renderToStaticMarkup(<Icon name="" />)

      // Then
      expect(html).toBe('')
    })

    test('returns undefined for numeric icon name', () => {
      // When
      const html = renderToStaticMarkup(<Icon name="123" />)

      // Then
      expect(html).toBe('')
    })
  })

  describe('Icon props', () => {
    test('applies custom size prop', () => {
      // When
      const html = renderToStaticMarkup(
        <Icon
          name="download"
          size={32}
        />
      )

      // Then
      expect(html).toContain('width="32"')
      expect(html).toContain('height="32"')
    })

    test('applies custom className', () => {
      // When
      const html = renderToStaticMarkup(
        <Icon
          name="rocket"
          className="text-red-500"
        />
      )

      // Then
      expect(html).toContain('text-red-500')
    })

    test('applies stroke width', () => {
      // When
      const html = renderToStaticMarkup(
        <Icon
          name="arrow-right"
          strokeWidth={3}
        />
      )

      // Then
      expect(html).toContain('stroke-width="3"')
    })

    test('applies custom color prop', () => {
      // When
      const html = renderToStaticMarkup(
        <Icon
          name="external-link"
          color="blue"
        />
      )

      // Then
      expect(html).toContain('stroke="blue"')
    })

    test('applies multiple Lucide props', () => {
      // When
      const html = renderToStaticMarkup(
        <Icon
          name="download"
          size={24}
          strokeWidth={2}
          className="custom-icon"
          color="green"
        />
      )

      // Then
      expect(html).toContain('width="24"')
      expect(html).toContain('height="24"')
      expect(html).toContain('stroke-width="2"')
      expect(html).toContain('custom-icon')
      expect(html).toContain('stroke="green"')
    })
  })

  describe('Icon accessibility', () => {
    test('includes data-testid for testing', () => {
      // When
      const html = renderToStaticMarkup(<Icon name="download" />)

      // Then
      expect(html).toContain('data-testid="icon"')
    })

    test('renders as SVG element', () => {
      // When
      const html = renderToStaticMarkup(<Icon name="rocket" />)

      // Then
      expect(html).toContain('<svg')
      expect(html).toContain('xmlns="http://www.w3.org/2000/svg"')
    })

    test('includes default Lucide icon attributes', () => {
      // When
      const html = renderToStaticMarkup(<Icon name="arrow-right" />)

      // Then
      expect(html).toContain('viewBox="0 0 24 24"')
      expect(html).toContain('fill="none"')
      expect(html).toContain('stroke="currentColor"')
    })

    test('applies aria-hidden by default', () => {
      // When
      const html = renderToStaticMarkup(<Icon name="download" />)

      // Then
      expect(html).toContain('aria-hidden="true"')
    })
  })

  describe('Icon composition', () => {
    test('works within button component', () => {
      // When
      const html = renderToStaticMarkup(
        <button>
          <Icon name="download" />
          <span>Download</span>
        </button>
      )

      // Then
      expect(html).toContain('<button>')
      expect(html).toContain('data-testid="icon"')
      expect(html).toContain('Download')
    })

    test('works with multiple icons in same component', () => {
      // When
      const html = renderToStaticMarkup(
        <div>
          <Icon name="download" />
          <Icon name="rocket" />
          <Icon name="arrow-right" />
        </div>
      )

      // Then
      const matches = html.match(/data-testid="icon"/g)
      expect(matches?.length).toBe(3)
    })

    test('maintains icon identity with same test id', () => {
      // When
      const html = renderToStaticMarkup(
        <div>
          <Icon name="download" />
          <Icon name="rocket" />
        </div>
      )

      // Then
      const matches = html.match(/data-testid="icon"/g)
      expect(matches?.length).toBe(2)
    })
  })

  describe('Type safety', () => {
    test('accepts valid icon names from iconMap', () => {
      // Given
      const validNames = ['download', 'arrow-right', 'rocket', 'external-link']

      // When/Then
      validNames.forEach((name) => {
        const html = renderToStaticMarkup(<Icon name={name} />)
        expect(html).toContain('data-testid="icon"')
      })
    })

    test('handles case-sensitive icon names', () => {
      // When
      const html1 = renderToStaticMarkup(<Icon name="Download" />)
      const html2 = renderToStaticMarkup(<Icon name="DOWNLOAD" />)

      // Then
      expect(html1).toBe('')
      expect(html2).toBe('')
    })
  })
})
