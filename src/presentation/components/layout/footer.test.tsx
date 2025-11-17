/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Footer } from './footer'
import type { Footer as FooterProps } from '@/domain/models/app/page/layout/footer'

describe('Footer Component', () => {
  describe('Basic rendering', () => {
    test('renders footer element when enabled', () => {
      // When
      const html = renderToStaticMarkup(<Footer enabled={true} />)

      // Then
      expect(html).toContain('data-testid="footer"')
      expect(html).toContain('<footer')
    })

    test('renders footer by default when enabled not specified', () => {
      // When
      const html = renderToStaticMarkup(<Footer />)

      // Then
      expect(html).toContain('data-testid="footer"')
    })

    test('does not render when disabled', () => {
      // When
      const html = renderToStaticMarkup(<Footer enabled={false} />)

      // Then
      expect(html).toBe('')
    })

    test('has minimum height and display block', () => {
      // When
      const html = renderToStaticMarkup(<Footer />)

      // Then
      expect(html).toContain('data-testid="footer"')
      expect(html).toContain('display:block')
      expect(html).toContain('min-height:1px')
    })
  })

  describe('Logo rendering', () => {
    test('renders logo when provided', () => {
      // Given
      const props: FooterProps = {
        logo: '/footer-logo.png',
      }

      // When
      const html = renderToStaticMarkup(<Footer {...props} />)

      // Then
      expect(html).toContain('data-testid="footer-logo"')
      expect(html).toContain('src="/footer-logo.png"')
      expect(html).toContain('alt="Footer logo"')
    })

    test('does not render logo when not provided', () => {
      // When
      const html = renderToStaticMarkup(<Footer />)

      // Then
      expect(html).not.toContain('data-testid="footer-logo"')
    })
  })

  describe('Copyright rendering', () => {
    test('renders copyright text when provided', () => {
      // Given
      const props: FooterProps = {
        copyright: '© 2025 ESSENTIAL SERVICES. All rights reserved.',
      }

      // When
      const html = renderToStaticMarkup(<Footer {...props} />)

      // Then
      expect(html).toContain('data-testid="footer-copyright"')
      expect(html).toContain('© 2025 ESSENTIAL SERVICES. All rights reserved.')
    })

    test('does not render copyright when not provided', () => {
      // When
      const html = renderToStaticMarkup(<Footer />)

      // Then
      expect(html).not.toContain('data-testid="footer-copyright"')
    })
  })

  describe('Description rendering', () => {
    test('renders description when provided', () => {
      // Given
      const props: FooterProps = {
        description: 'Building the future of web applications',
      }

      // When
      const html = renderToStaticMarkup(<Footer {...props} />)

      // Then
      expect(html).toContain('data-testid="footer-description"')
      expect(html).toContain('Building the future of web applications')
    })

    test('does not render description when not provided', () => {
      // When
      const html = renderToStaticMarkup(<Footer />)

      // Then
      expect(html).not.toContain('data-testid="footer-description"')
    })
  })

  describe('Email rendering', () => {
    test('renders email link when provided', () => {
      // Given
      const props: FooterProps = {
        email: 'contact@example.com',
      }

      // When
      const html = renderToStaticMarkup(<Footer {...props} />)

      // Then
      expect(html).toContain('href="mailto:contact@example.com"')
      expect(html).toContain('contact@example.com')
    })

    test('does not render email when not provided', () => {
      // When
      const html = renderToStaticMarkup(<Footer />)

      // Then
      expect(html).not.toContain('mailto:')
    })
  })

  describe('Legal links rendering', () => {
    test('renders legal links when provided', () => {
      // Given
      const props: FooterProps = {
        legal: [
          { label: 'Privacy Policy', href: '/privacy' },
          { label: 'Terms of Service', href: '/terms' },
          { label: 'Cookie Policy', href: '/cookies' },
        ],
      }

      // When
      const html = renderToStaticMarkup(<Footer {...props} />)

      // Then
      expect(html).toContain('data-testid="footer-legal"')
      expect(html).toContain('Privacy Policy')
      expect(html).toContain('href="/privacy"')
      expect(html).toContain('Terms of Service')
      expect(html).toContain('href="/terms"')
      expect(html).toContain('Cookie Policy')
      expect(html).toContain('href="/cookies"')
    })

    test('does not render legal section when not provided', () => {
      // When
      const html = renderToStaticMarkup(<Footer />)

      // Then
      expect(html).not.toContain('data-testid="footer-legal"')
    })

    test('does not render legal section when array is empty', () => {
      // Given
      const props: FooterProps = {
        legal: [],
      }

      // When
      const html = renderToStaticMarkup(<Footer {...props} />)

      // Then
      expect(html).not.toContain('data-testid="footer-legal"')
    })
  })

  describe('Columns rendering', () => {
    test('renders columns when provided', () => {
      // Given
      const props: FooterProps = {
        columns: [
          {
            title: 'Products',
            links: [
              { label: 'Features', href: '/features' },
              { label: 'Pricing', href: '/pricing' },
            ],
          },
          {
            title: 'Company',
            links: [
              { label: 'About', href: '/about' },
              { label: 'Careers', href: '/careers' },
            ],
          },
        ],
      }

      // When
      const html = renderToStaticMarkup(<Footer {...props} />)

      // Then
      expect(html).toContain('data-testid="footer-column-0"')
      expect(html).toContain('data-testid="column-title"')
      expect(html).toContain('Products')
      expect(html).toContain('data-testid="footer-column-1"')
      expect(html).toContain('Company')
      expect(html).toContain('Features')
      expect(html).toContain('Pricing')
      expect(html).toContain('About')
      expect(html).toContain('Careers')
    })

    test('does not render columns when not provided', () => {
      // When
      const html = renderToStaticMarkup(<Footer />)

      // Then
      expect(html).not.toContain('data-testid="footer-column-')
    })
  })

  describe('Social links rendering', () => {
    test('renders social links when provided', () => {
      // Given
      const props: FooterProps = {
        social: {
          links: [
            { platform: 'twitter' as const, url: 'https://twitter.com/example' },
            { platform: 'github' as const, url: 'https://github.com/example' },
            { platform: 'linkedin' as const, url: 'https://linkedin.com/company/example' },
          ],
        },
      }

      // When
      const html = renderToStaticMarkup(<Footer {...props} />)

      // Then
      expect(html).toContain('data-testid="footer-social"')
      expect(html).toContain('https://twitter.com/example')
      expect(html).toContain('https://github.com/example')
      expect(html).toContain('https://linkedin.com/company/example')
    })

    test('does not render social section when not provided', () => {
      // When
      const html = renderToStaticMarkup(<Footer />)

      // Then
      expect(html).not.toContain('data-testid="footer-social"')
    })
  })

  describe('Newsletter rendering', () => {
    test('renders newsletter form when provided', () => {
      // Given
      const props: FooterProps = {
        newsletter: {
          enabled: true,
          title: 'Subscribe to our newsletter',
          placeholder: 'Enter your email',
          buttonText: 'Subscribe',
        },
      }

      // When
      const html = renderToStaticMarkup(<Footer {...props} />)

      // Then
      expect(html).toContain('data-testid="footer-newsletter"')
      expect(html).toContain('data-testid="newsletter-title"')
      expect(html).toContain('Subscribe to our newsletter')
      expect(html).toContain('data-testid="newsletter-input"')
      expect(html).toContain('placeholder="Enter your email"')
      expect(html).toContain('data-testid="newsletter-button"')
      expect(html).toContain('Subscribe')
    })

    test('does not render newsletter when disabled', () => {
      // Given
      const props: FooterProps = {
        newsletter: {
          enabled: false,
        },
      }

      // When
      const html = renderToStaticMarkup(<Footer {...props} />)

      // Then
      expect(html).not.toContain('data-testid="footer-newsletter"')
    })

    test('does not render newsletter when not provided', () => {
      // When
      const html = renderToStaticMarkup(<Footer />)

      // Then
      expect(html).not.toContain('data-testid="footer-newsletter"')
    })
  })

  describe('Styling', () => {
    test('applies background color', () => {
      // Given
      const props: FooterProps = {
        backgroundColor: '#333333',
      }

      // When
      const html = renderToStaticMarkup(<Footer {...props} />)

      // Then
      expect(html).toContain('data-testid="footer"')
      expect(html).toContain('background-color:#333333')
    })

    test('applies text color', () => {
      // Given
      const props: FooterProps = {
        textColor: '#ffffff',
      }

      // When
      const html = renderToStaticMarkup(<Footer {...props} />)

      // Then
      expect(html).toContain('data-testid="footer"')
      expect(html).toContain('color:#ffffff')
    })

    test('applies both background and text colors', () => {
      // Given
      const props: FooterProps = {
        backgroundColor: '#1a1a1a',
        textColor: '#cccccc',
      }

      // When
      const html = renderToStaticMarkup(<Footer {...props} />)

      // Then
      expect(html).toContain('data-testid="footer"')
      expect(html).toContain('background-color:#1a1a1a')
      expect(html).toContain('color:#cccccc')
    })
  })

  describe('Complex configurations', () => {
    test('renders fully featured footer', () => {
      // Given
      const props: FooterProps = {
        enabled: true,
        logo: '/logo.svg',
        description: 'Your trusted partner in digital transformation',
        backgroundColor: '#222222',
        textColor: '#eeeeee',
        columns: [
          {
            title: 'Products',
            links: [
              { label: 'Features', href: '/features' },
              { label: 'Pricing', href: '/pricing' },
              { label: 'Documentation', href: '/docs' },
            ],
          },
          {
            title: 'Company',
            links: [
              { label: 'About Us', href: '/about' },
              { label: 'Blog', href: '/blog' },
              { label: 'Careers', href: '/careers' },
            ],
          },
          {
            title: 'Support',
            links: [
              { label: 'Help Center', href: '/help' },
              { label: 'Contact', href: '/contact' },
              { label: 'Status', href: '/status' },
            ],
          },
        ],
        social: {
          links: [
            { platform: 'twitter' as const, url: 'https://twitter.com/company' },
            { platform: 'linkedin' as const, url: 'https://linkedin.com/company' },
            { platform: 'github' as const, url: 'https://github.com/company' },
            { platform: 'youtube' as const, url: 'https://youtube.com/company' },
          ],
        },
        newsletter: {
          enabled: true,
          title: 'Stay updated',
          placeholder: 'your@email.com',
          buttonText: 'Subscribe',
        },
        copyright: '© 2025 Company Inc. All rights reserved.',
        legal: [
          { label: 'Terms', href: '/terms' },
          { label: 'Privacy', href: '/privacy' },
          { label: 'Cookies', href: '/cookies' },
        ],
        email: 'hello@company.com',
      }

      // When
      const html = renderToStaticMarkup(<Footer {...props} />)

      // Then
      expect(html).toContain('data-testid="footer"')
      expect(html).toContain('data-testid="footer-logo"')
      expect(html).toContain('data-testid="footer-description"')
      expect(html).toContain('data-testid="footer-column-0"')
      expect(html).toContain('data-testid="footer-social"')
      expect(html).toContain('data-testid="footer-newsletter"')
      expect(html).toContain('data-testid="footer-copyright"')
      expect(html).toContain('data-testid="footer-legal"')
      expect(html).toContain('mailto:hello@company.com')
      expect(html).toContain('background-color:#222222')
      expect(html).toContain('color:#eeeeee')
    })

    test('renders minimal footer', () => {
      // When
      const html = renderToStaticMarkup(<Footer enabled={true} />)

      // Then
      expect(html).toContain('data-testid="footer"')
      expect(html).not.toContain('data-testid="footer-logo"')
      expect(html).not.toContain('data-testid="footer-description"')
      expect(html).not.toContain('data-testid="footer-column-')
      expect(html).not.toContain('data-testid="footer-social"')
      expect(html).not.toContain('data-testid="footer-newsletter"')
      expect(html).not.toContain('data-testid="footer-copyright"')
      expect(html).not.toContain('data-testid="footer-legal"')
      expect(html).not.toContain('mailto:')
    })

    test('renders partial footer configuration', () => {
      // Given
      const props: FooterProps = {
        logo: '/logo.png',
        copyright: '© 2025 Company',
        email: 'info@company.com',
      }

      // When
      const html = renderToStaticMarkup(<Footer {...props} />)

      // Then
      expect(html).toContain('data-testid="footer-logo"')
      expect(html).toContain('data-testid="footer-copyright"')
      expect(html).toContain('mailto:info@company.com')
      expect(html).not.toContain('data-testid="footer-description"')
      expect(html).not.toContain('data-testid="footer-column-')
      expect(html).not.toContain('data-testid="footer-social"')
      expect(html).not.toContain('data-testid="footer-newsletter"')
      expect(html).not.toContain('data-testid="footer-legal"')
    })
  })
})
