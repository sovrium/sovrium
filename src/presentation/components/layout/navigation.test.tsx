/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */
import { describe, test, expect } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Navigation } from './navigation'
import type { Navigation as NavigationProps } from '@/domain/models/app/page/layout/navigation'

describe('Navigation Component', () => {
  const defaultProps: NavigationProps = {
    logo: '/logo.png',
  }
  describe('Basic rendering', () => {
    test('renders navigation element', () => {
      // When
      const html = renderToStaticMarkup(<Navigation {...defaultProps} />)
      // Then
      expect(html).toContain('data-testid="navigation"')
      expect(html).toContain('<nav')
      expect(html).toContain('aria-label="Main navigation"')
    })
    test('renders logo with default alt text', () => {
      // When
      const html = renderToStaticMarkup(<Navigation {...defaultProps} />)
      // Then
      expect(html).toContain('data-testid="nav-logo"')
      expect(html).toContain('src="/logo.png"')
      expect(html).toContain('alt="Logo"')
    })
    test('renders logo with custom alt text', () => {
      // When
      const html = renderToStaticMarkup(
        <Navigation
          {...defaultProps}
          logoAlt="Company Logo"
        />
      )

      // Then
      expect(html).toContain('data-testid="nav-logo"')
      expect(html).toContain('alt="Company Logo"')
    })

    test('logo links to home page', () => {
      // When
      const html = renderToStaticMarkup(<Navigation {...defaultProps} />)

      // Then
      expect(html).toContain('data-testid="nav-logo-link"')
      expect(html).toContain('href="/"')
    })
  })

  describe('Navigation links', () => {
    test('renders desktop navigation links', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        links: {
          desktop: [
            { href: '/about', label: 'About' },
            { href: '/services', label: 'Services' },
            { href: '/contact', label: 'Contact' },
          ],
        },
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('data-testid="nav-links"')
      expect(html).toContain('data-testid="nav-link"')
      expect(html).toContain('href="/about"')
      expect(html).toContain('About')
    })
    test('does not render links container when no links provided', () => {
      // When
      const html = renderToStaticMarkup(<Navigation {...defaultProps} />)
      // Then
      expect(html).not.toContain('data-testid="nav-links"')
    })
    test('renders links with badges', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        links: {
          desktop: [
            { href: '/features', label: 'Features', badge: 'NEW' },
            { href: '/pricing', label: 'Pricing' },
          ],
        },
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('data-testid="badge"')
      expect(html).toContain('NEW')
    })
    test('renders links with target attribute', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        links: {
          desktop: [{ href: 'https://external.com', label: 'External', target: '_blank' }],
        },
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('data-testid="nav-link"')
      expect(html).toContain('target="_blank"')
      expect(html).toContain('rel="noopener noreferrer"')
    })
    test('renders dropdown for links with children', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        links: {
          desktop: [
            {
              href: '/products',
              label: 'Products',
              children: [
                { href: '/products/software', label: 'Software' },
                { href: '/products/hardware', label: 'Hardware' },
              ],
            },
          ],
        },
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('data-testid="nav-dropdown"')
      expect(html).toContain('Software')
      expect(html).toContain('Hardware')
    })
  })
  describe('CTA Button', () => {
    test('renders CTA button when provided', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        cta: {
          text: 'Get Started',
          href: '/signup',
        },
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('data-testid="nav-cta"')
      expect(html).toContain('Get Started')
      expect(html).toContain('href="/signup"')
    })
    test('renders CTA with custom variant and size', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        cta: {
          text: 'Sign Up',
          href: '/signup',
          variant: 'outline',
          size: 'lg',
        },
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('data-testid="nav-cta"')
      expect(html).toContain('btn-outline')
      expect(html).toContain('btn-lg')
    })
    test('renders CTA with icon', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        cta: {
          text: 'Download',
          href: '/download',
          icon: 'download',
        },
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('data-testid="nav-cta"')
      expect(html).toContain('data-testid="icon"')
    })
    test('does not render CTA when not provided', () => {
      // When
      const html = renderToStaticMarkup(<Navigation {...defaultProps} />)
      // Then
      expect(html).not.toContain('data-testid="nav-cta"')
    })
  })
  describe('Search functionality', () => {
    test('renders search input when enabled', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        search: {
          enabled: true,
          placeholder: 'Search products...',
        },
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('data-testid="nav-search"')
      expect(html).toContain('type="search"')
      expect(html).toContain('placeholder="Search products..."')
      expect(html).toContain('aria-label="Search products..."')
    })
    test('uses default placeholder when not specified', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        search: {
          enabled: true,
        },
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('type="search"')
      expect(html).toContain('placeholder="Search..."')
    })
    test('does not render search when disabled', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        search: {
          enabled: false,
        },
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).not.toContain('data-testid="nav-search"')
    })
    test('does not render search when not provided', () => {
      // When
      const html = renderToStaticMarkup(<Navigation {...defaultProps} />)
      // Then
      expect(html).not.toContain('data-testid="nav-search"')
    })
  })
  describe('User menu', () => {
    test('renders user menu when enabled', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        user: {
          enabled: true,
          loginUrl: '/login',
          signupUrl: '/signup',
        },
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('data-testid="user-menu"')
      expect(html).toContain('data-testid="login-link"')
      expect(html).toContain('href="/login"')
      expect(html).toContain('Login')
      expect(html).toContain('data-testid="signup-link"')
      expect(html).toContain('href="/signup"')
      expect(html).toContain('Sign Up')
    })
    test('does not render user menu when disabled', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        user: {
          enabled: false,
          loginUrl: '/login',
          signupUrl: '/signup',
        },
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).not.toContain('data-testid="user-menu"')
    })
    test('does not render user menu when not provided', () => {
      // When
      const html = renderToStaticMarkup(<Navigation {...defaultProps} />)
      // Then
      expect(html).not.toContain('data-testid="user-menu"')
    })
  })
  describe('Styling and positioning', () => {
    test('applies sticky positioning', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        sticky: true,
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('data-testid="navigation"')
      expect(html).toContain('position:sticky')
      expect(html).toContain('top:0')
      expect(html).toContain('z-index:50')
      expect(html).toContain('sticky')
    })
    test('applies background and text colors', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        backgroundColor: '#000000',
        textColor: '#ffffff',
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('data-testid="navigation"')
      expect(html).toContain('background-color:#000000')
      expect(html).toContain('color:#ffffff')
    })
    test('transparent navigation starts transparent', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        transparent: true,
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('data-testid="navigation"')
      expect(html).toContain('background-color:transparent')
      expect(html).toContain('data-transparent="true"')
      expect(html).toContain('<script') // Inline script for scroll detection
    })
    test('transparent navigation becomes white on scroll', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        transparent: true,
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      // SSR renders initial state (transparent) with inline script for scroll detection
      expect(html).toContain('data-testid="navigation"')
      expect(html).toContain('background-color:transparent')
      expect(html).toContain('data-transparent="true"')
      expect(html).toContain('updateNavBackground') // Scroll detection function
      // Client-side scroll behavior is tested in E2E tests (APP-PAGES-NAV-005)
    })
  })
  describe('Complex configurations', () => {
    test('renders fully featured navigation', () => {
      // Given
      const props: NavigationProps = {
        logo: '/logo.svg',
        logoAlt: 'Acme Corp',
        sticky: true,
        transparent: true,
        backgroundColor: '#f0f0f0',
        textColor: '#333333',
        links: {
          desktop: [
            { href: '/home', label: 'Home' },
            { href: '/about', label: 'About', badge: 'NEW' },
            {
              href: '/products',
              label: 'Products',
              children: [
                { href: '/products/a', label: 'Product A' },
                { href: '/products/b', label: 'Product B' },
              ],
            },
          ],
        },
        cta: {
          text: 'Start Free Trial',
          href: '/trial',
          variant: 'primary',
          icon: 'rocket',
        },
        search: {
          enabled: true,
          placeholder: 'Search...',
        },
        user: {
          enabled: true,
          loginUrl: '/auth/login',
          signupUrl: '/auth/signup',
        },
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('data-testid="navigation"')
      expect(html).toContain('data-testid="nav-logo"')
      expect(html).toContain('data-testid="nav-links"')
      expect(html).toContain('data-testid="nav-cta"')
      expect(html).toContain('data-testid="nav-search"')
      expect(html).toContain('data-testid="user-menu"')
      expect(html).toContain('data-testid="badge"')
      expect(html).toContain('data-testid="nav-dropdown"')
    })
    test('renders minimal navigation', () => {
      // When
      const html = renderToStaticMarkup(<Navigation logo="/minimal-logo.png" />)
      // Then
      expect(html).toContain('data-testid="navigation"')
      expect(html).toContain('data-testid="nav-logo"')
      expect(html).toContain('src="/minimal-logo.png"')
      // No other elements should be present
      expect(html).not.toContain('data-testid="nav-links"')
      expect(html).not.toContain('data-testid="nav-cta"')
      expect(html).not.toContain('data-testid="nav-search"')
      expect(html).not.toContain('data-testid="user-menu"')
    })
  })
  describe('Layout', () => {
    test('nav links container has flex layout', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        links: {
          desktop: [
            { href: '/a', label: 'A' },
            { href: '/b', label: 'B' },
          ],
        },
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('data-testid="nav-links"')
      expect(html).toContain('flex')
      expect(html).toContain('gap-4')
    })
    test('nav links have flex layout for items', () => {
      // Given
      const props: NavigationProps = {
        ...defaultProps,
        links: {
          desktop: [{ href: '/test', label: 'Test', badge: 'NEW' }],
        },
      }
      // When
      const html = renderToStaticMarkup(<Navigation {...props} />)
      // Then
      expect(html).toContain('data-testid="nav-link"')
      expect(html).toContain('flex')
      expect(html).toContain('items-center')
      expect(html).toContain('gap-2')
    })
  })
})
