/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */
import { describe, test, expect } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Hero } from './hero'
import type { Theme } from '@/domain/models/app/theme'

describe('Hero Component', () => {
  describe('Basic rendering', () => {
    test('renders hero section', () => {
      // When
      const html = renderToStaticMarkup(<Hero />)
      // Then
      expect(html).toContain('<section')
    })
    test('renders with test id', () => {
      // When
      const html = renderToStaticMarkup(<Hero data-testid="hero-section" />)
      // Then
      expect(html).toContain('data-testid="hero-section"')
    })
    test('renders default content when no children', () => {
      // When
      const html = renderToStaticMarkup(<Hero />)
      // Then
      expect(html).toContain('<h1')
      expect(html).toContain('Welcome to Sovrium')
      expect(html).toContain('<button')
      expect(html).toContain('Get Started')
    })
    test('renders custom children when provided', () => {
      // When
      const html = renderToStaticMarkup(
        <Hero>
          <h2>Custom Heading</h2>
          <p>Custom content</p>
        </Hero>
      )

      // Then
      expect(html).toContain('<h2')
      expect(html).toContain('Custom Heading')
      expect(html).toContain('Custom content')
    })
    test('renders empty hero with empty array children', () => {
      // When
      const html = renderToStaticMarkup(<Hero>{[]}</Hero>)
      // Then
      // Should render default content
      expect(html).toContain('<h1')
      expect(html).toContain('Welcome to Sovrium')
    })
  })
  describe('Theme integration', () => {
    test('applies default theme values', () => {
      // When
      const html = renderToStaticMarkup(<Hero />)
      // Then
      expect(html).toContain('style=')
      expect(html).toContain('padding:2rem')
      expect(html).toContain('min-height:200px')
    })
    test('applies custom theme colors', () => {
      // Given
      const theme: Theme = {
        colors: {
          background: '#f0f0f0',
          text: '#333333',
          primary: '#ff6600',
        },
      }
      // When
      const html = renderToStaticMarkup(<Hero theme={theme} />)
      // Then
      expect(html).toContain('background-color:#f0f0f0')
      expect(html).toContain('color:#333333')
      expect(html).toContain('background-color:#ff6600')
    })
    test('applies custom theme fonts', () => {
      // Given
      const theme: Theme = {
        fonts: {
          title: {
            family: 'Helvetica',
            size: '3rem',
            weights: [900],
          },
          body: {
            family: 'Arial',
          },
        },
      }
      // When
      const html = renderToStaticMarkup(<Hero theme={theme} />)
      // Then
      expect(html).toContain('font-family:Helvetica')
      expect(html).toContain('font-size:3rem')
      expect(html).toContain('font-weight:900')
      expect(html).toContain('font-family:Arial')
    })
    test('handles legacy font weight format', () => {
      // Given
      const theme: Theme = {
        fonts: {
          title: {
            family: 'Helvetica',
            // @ts-expect-error - testing legacy format
            weight: 600,
          },
        },
      }
      // When
      const html = renderToStaticMarkup(<Hero theme={theme} />)
      // Then
      expect(html).toContain('font-weight:600')
    })
    test('applies custom theme spacing', () => {
      // Given
      const theme: Theme = {
        spacing: {
          section: '6rem',
        },
      }
      // When
      const html = renderToStaticMarkup(<Hero theme={theme} />)
      // Then
      expect(html).toContain('padding:6rem')
    })
    test('applies custom theme border radius', () => {
      // Given
      const theme: Theme = {
        borderRadius: {
          lg: '1rem',
        },
      }
      // When
      const html = renderToStaticMarkup(<Hero theme={theme} />)
      // Then
      expect(html).toContain('border-radius:1rem')
    })
    test('applies fadeInUp animation class when configured', () => {
      // Given
      const theme: Theme = {
        animations: {
          fadeInUp: 'fadeInUp 1s ease-in-out',
        },
      }
      // When
      const html = renderToStaticMarkup(<Hero theme={theme} />)
      // Then
      expect(html).toContain('class="animate-fadeInUp"')
    })
    test('does not apply animation class when not configured', () => {
      // When
      const html = renderToStaticMarkup(<Hero />)
      // Then
      expect(html).not.toContain('animate-fadeInUp')
    })
  })
  describe('Button content configuration', () => {
    test('renders custom button with text', () => {
      // When
      const html = renderToStaticMarkup(
        <Hero
          content={{
            button: {
              text: 'Click Me',
            },
          }}
        />
      )

      // Then
      expect(html).toContain('data-testid="animated-cta"')
      expect(html).toContain('Click Me')
    })
    test('applies button animation when provided', () => {
      // When
      const html = renderToStaticMarkup(
        <Hero
          content={{
            button: {
              text: 'Animated Button',
              animation: 'slideInUp 0.5s ease-out',
            },
          }}
        />
      )

      // Then
      expect(html).toContain('data-testid="animated-cta"')
      expect(html).toContain('animation:slideInUp 0.5s ease-out')
    })
    test('resolves animation tokens with theme', () => {
      // Given
      const theme: Theme = {
        animations: {
          easing: {
            smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
          },
        },
        colors: {
          primary: '#007bff',
        },
      }

      // When
      const html = renderToStaticMarkup(
        <Hero
          theme={theme}
          content={{
            button: {
              text: 'Token Button',
              animation: 'fadeIn 1s $easing.smooth, colorShift 2s $colors.primary',
            },
          }}
        />
      )

      // Then
      expect(html).toContain('data-testid="animated-cta"')
      expect(html).toContain('cubic-bezier(0.4, 0, 0.2, 1)')
    })

    test('preserves unresolved tokens when not in theme', () => {
      // When
      const html = renderToStaticMarkup(
        <Hero
          content={{
            button: {
              text: 'Token Button',
              animation: 'fadeIn 1s $easing.unknown',
            },
          }}
        />
      )

      // Then
      expect(html).toContain('data-testid="animated-cta"')
      expect(html).toContain('animation:fadeIn 1s $easing.unknown')
    })
  })
  describe('Responsive media queries', () => {
    test('generates media query styles', () => {
      // When
      const html = renderToStaticMarkup(<Hero data-testid="hero-test" />)
      // Then
      expect(html).toContain('<style')
      expect(html).toContain('@media')
      expect(html).toContain('@media (min-width: 640px)')
      expect(html).toContain('@media (min-width: 768px)')
      expect(html).toContain('@media (min-width: 1024px)')
    })
    test('uses custom breakpoints in media queries', () => {
      // Given
      const theme: Theme = {
        breakpoints: {
          sm: '480px',
          md: '960px',
          lg: '1200px',
        },
      }

      // When
      const html = renderToStaticMarkup(
        <Hero
          theme={theme}
          data-testid="hero-custom"
        />
      )

      // Then
      expect(html).toContain('<style')
      expect(html).toContain('@media (min-width: 480px)')
      expect(html).toContain('@media (min-width: 960px)')
      expect(html).toContain('@media (min-width: 1200px)')
    })
    test('handles invalid breakpoint values', () => {
      // Given
      const theme: Theme = {
        breakpoints: {
          sm: 'invalid',
          md: 'not-a-number',
        },
      }
      // When
      const html = renderToStaticMarkup(<Hero theme={theme} />)
      // Then
      // Should use default values when parsing fails
      expect(html).toContain('<style')
      expect(html).toContain('@media')
    })
  })
  describe('Layout and styling', () => {
    test('applies flex container styles', () => {
      // When
      const html = renderToStaticMarkup(<Hero />)
      // Then
      expect(html).toContain('display:flex')
      expect(html).toContain('align-items:center')
      expect(html).toContain('justify-content:center')
    })
    test('applies min height', () => {
      // When
      const html = renderToStaticMarkup(<Hero />)
      // Then
      expect(html).toContain('min-height:200px')
    })
    test('default content is centered', () => {
      // When
      const html = renderToStaticMarkup(<Hero />)
      // Then
      expect(html).toContain('text-align:center')
      expect(html).toContain('max-width:800px')
    })
  })
  describe('Complex configurations', () => {
    test('renders with full theme configuration', () => {
      // Given
      const theme: Theme = {
        colors: {
          background: '#1a1a1a',
          text: '#ffffff',
          primary: '#ff00ff',
        },
        fonts: {
          title: {
            family: 'Georgia',
            size: '4rem',
            weights: [700],
          },
          body: {
            family: 'Verdana',
          },
        },
        spacing: {
          section: '8rem',
        },
        borderRadius: {
          lg: '2rem',
        },
        breakpoints: {
          sm: '500px',
          md: '900px',
          lg: '1400px',
        },
        animations: {
          fadeInUp: 'fadeInUp 2s ease',
        },
      }
      // When
      const html = renderToStaticMarkup(<Hero theme={theme} />)
      // Then
      expect(html).toContain('background-color:#1a1a1a')
      expect(html).toContain('padding:8rem')
      expect(html).toContain('class="animate-fadeInUp"')
      expect(html).toContain('font-family:Georgia')
      expect(html).toContain('font-size:4rem')
      expect(html).toContain('color:#ffffff')
      expect(html).toContain('background-color:#ff00ff')
      expect(html).toContain('border-radius:2rem')
      expect(html).toContain('font-family:Verdana')
    })
    test('prioritizes button content over default content', () => {
      // When
      const html = renderToStaticMarkup(
        <Hero
          content={{
            button: {
              text: 'Priority Button',
            },
          }}
        >
          <p>This should not render</p>
        </Hero>
      )

      // Then
      expect(html).toContain('data-testid="animated-cta"')
      expect(html).toContain('Priority Button')
      expect(html).not.toContain('This should not render')
    })
  })
  describe('Edge cases', () => {
    test('handles undefined theme gracefully', () => {
      // When
      const html = renderToStaticMarkup(<Hero theme={undefined} />)
      // Then
      expect(html).toContain('<section')
    })
    test('handles partial theme objects', () => {
      // Given
      const theme: Theme = {
        colors: {
          primary: '#123456',
        },
        // Missing other properties
      }
      // When
      const html = renderToStaticMarkup(<Hero theme={theme} />)
      // Then
      // Check that the color is applied
      expect(html).toContain('background-color:#123456')
    })
    test('handles empty content object', () => {
      // When
      const html = renderToStaticMarkup(<Hero content={{}} />)
      // Then
      // Should render default content
      expect(html).toContain('<h1')
      expect(html).toContain('Welcome to Sovrium')
    })
    test('handles null children', () => {
      // When
      const html = renderToStaticMarkup(<Hero>{null}</Hero>)
      // Then
      // Should render default content
      expect(html).toContain('<h1')
      expect(html).toContain('Welcome to Sovrium')
    })
  })
})
