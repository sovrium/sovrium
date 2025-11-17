/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Banner } from './banner'

describe('Banner Component', () => {
  describe('Basic rendering', () => {
    test('renders banner when enabled', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Test message"
        />
      )

      // Then
      expect(html).toContain('role="banner"')
      expect(html).toContain('data-testid="banner"')
    })

    test('does not render when disabled', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={false}
          message="Test message"
        />
      )

      // Then
      expect(html).toBe('')
    })

    test('renders when enabled is undefined', () => {
      // When
      const html = renderToStaticMarkup(<Banner message="Test message" />)

      // Then
      expect(html).toContain('role="banner"')
    })

    test('renders with message prop', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Important announcement"
        />
      )

      // Then
      expect(html).toContain('data-testid="banner-text"')
      expect(html).toContain('Important announcement')
    })

    test('renders with text prop (legacy)', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          text="Legacy text prop"
        />
      )

      // Then
      expect(html).toContain('data-testid="banner-text"')
      expect(html).toContain('Legacy text prop')
    })

    test('prefers message over text when both provided', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Message"
          text="Text"
        />
      )

      // Then
      expect(html).toContain('data-testid="banner-text"')
      expect(html).toContain('Message')
      expect(html).not.toContain('Text')
    })
  })

  describe('Banner with link', () => {
    test('renders link when provided', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Check out our sale"
          link={{ href: '/sale', label: 'Shop Now' }}
        />
      )

      // Then
      expect(html).toContain('data-testid="banner-link"')
      expect(html).toContain('href="/sale"')
      expect(html).toContain('Shop Now')
    })

    test('does not render link when not provided', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Simple message"
        />
      )

      // Then
      expect(html).not.toContain('data-testid="banner-link"')
    })

    test('link has correct styling classes', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Message"
          link={{ href: '/test', label: 'Click' }}
        />
      )

      // Then
      expect(html).toContain('data-testid="banner-link"')
      expect(html).toContain('font-semibold')
      expect(html).toContain('underline')
      expect(html).toContain('hover:opacity-80')
    })
  })

  describe('Dismissible banner', () => {
    test('renders dismiss button when dismissible', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Dismissible message"
          dismissible={true}
        />
      )

      // Then
      expect(html).toContain('data-testid="banner-dismiss"')
      expect(html).toContain('×')
    })

    test('does not render dismiss button when not dismissible', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Non-dismissible"
          dismissible={false}
        />
      )

      // Then
      expect(html).not.toContain('data-testid="banner-dismiss"')
    })

    test('dismiss button has accessibility label', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Message"
          dismissible={true}
        />
      )

      // Then
      expect(html).toContain('data-testid="banner-dismiss"')
      expect(html).toContain('aria-label="Dismiss banner"')
    })

    test('dismiss button has correct styling', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Message"
          dismissible={true}
        />
      )

      // Then
      expect(html).toContain('data-testid="banner-dismiss"')
      expect(html).toContain('ml-auto')
      expect(html).toContain('font-bold')
      expect(html).toContain('hover:opacity-80')
    })
  })

  describe('Banner styling', () => {
    test('applies gradient style', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Gradient banner"
          gradient="linear-gradient(to right, red, blue)"
        />
      )

      // Then
      expect(html).toContain('data-testid="banner"')
      expect(html).toContain('background:linear-gradient(to right, red, blue)')
    })

    test('applies backgroundColor when no gradient', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Colored banner"
          backgroundColor="#ff0000"
        />
      )

      // Then
      expect(html).toContain('data-testid="banner"')
      expect(html).toContain('background-color:#ff0000')
    })

    test('gradient takes precedence over backgroundColor', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Banner"
          gradient="linear-gradient(to right, red, blue)"
          backgroundColor="#ff0000"
        />
      )

      // Then
      expect(html).toContain('background:linear-gradient(to right, red, blue)')
      expect(html).not.toContain('background-color:#ff0000')
    })

    test('applies text color', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Colored text"
          textColor="#ffffff"
        />
      )

      // Then
      expect(html).toContain('data-testid="banner"')
      expect(html).toContain('color:#ffffff')
    })

    test('applies sticky positioning', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Sticky banner"
          sticky={true}
        />
      )

      // Then
      expect(html).toContain('data-testid="banner"')
      expect(html).toContain('position:sticky')
      expect(html).toContain('top:0')
      expect(html).toContain('z-index:50')
    })

    test('no inline styles when all style props undefined', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Plain banner"
        />
      )

      // Then
      expect(html).toContain('data-testid="banner"')
      expect(html).not.toContain('style=')
    })

    test('applies multiple styles together', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Multi-styled"
          gradient="linear-gradient(45deg, #000, #fff)"
          textColor="#ff0000"
          sticky={true}
        />
      )

      // Then
      expect(html).toContain('background:linear-gradient(45deg, #000, #fff)')
      expect(html).toContain('color:#ff0000')
      expect(html).toContain('position:sticky')
      expect(html).toContain('top:0')
      expect(html).toContain('z-index:50')
    })
  })

  describe('Container and layout', () => {
    test('has container with flex layout', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Test"
        />
      )

      // Then
      expect(html).toContain('data-testid="banner"')
      expect(html).toContain('class="container')
      expect(html).toContain('flex')
      expect(html).toContain('items-center')
      expect(html).toContain('justify-center')
      expect(html).toContain('gap-4')
    })

    test('banner has vertical padding', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Test"
        />
      )

      // Then
      expect(html).toContain('data-testid="banner"')
      expect(html).toContain('py-3')
    })

    test('text has font-medium class', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Test"
        />
      )

      // Then
      expect(html).toContain('data-testid="banner-text"')
      expect(html).toContain('font-medium')
    })
  })

  describe('Complex banner configurations', () => {
    test('renders full featured banner', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Holiday Sale!"
          link={{ href: '/sale', label: 'Shop 50% Off' }}
          gradient="linear-gradient(90deg, #ff6b6b, #4ecdc4)"
          textColor="#ffffff"
          dismissible={true}
          sticky={true}
        />
      )

      // Then
      expect(html).toContain('data-testid="banner"')
      expect(html).toContain('Holiday Sale!')
      expect(html).toContain('data-testid="banner-link"')
      expect(html).toContain('Shop 50% Off')
      expect(html).toContain('data-testid="banner-dismiss"')
      expect(html).toContain('linear-gradient')
      expect(html).toContain('position:sticky')
    })

    test('renders minimal banner', () => {
      // When
      const html = renderToStaticMarkup(<Banner message="Simple" />)

      // Then
      expect(html).toContain('data-testid="banner"')
      expect(html).toContain('data-testid="banner-text"')
      expect(html).toContain('Simple')
      expect(html).not.toContain('data-testid="banner-link"')
      expect(html).not.toContain('data-testid="banner-dismiss"')
      expect(html).not.toContain('style=')
    })
  })

  describe('Edge cases', () => {
    test('renders with empty message', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message=""
        />
      )

      // Then
      expect(html).toContain('data-testid="banner-text"')
    })

    test('renders with undefined message and text', () => {
      // When
      const html = renderToStaticMarkup(<Banner enabled={true} />)

      // Then
      expect(html).toContain('data-testid="banner-text"')
    })

    test('handles invalid color values gracefully', () => {
      // When
      const html = renderToStaticMarkup(
        <Banner
          enabled={true}
          message="Test"
          backgroundColor="invalid-color"
          textColor="not-a-color"
        />
      )

      // Then
      expect(html).toContain('data-testid="banner"')
    })
  })
})
