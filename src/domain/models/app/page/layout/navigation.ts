/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { CtaButtonSchema } from './navigation/cta-button'
import { NavLinksSchema } from './navigation/nav-links'

/**
 * Navigation links configuration
 *
 * Defines navigation links for desktop and mobile devices.
 *
 * Required properties:
 * - desktop: Desktop navigation links (horizontal menu)
 *
 * Optional properties:
 * - mobile: Mobile navigation links (hamburger menu, defaults to desktop if omitted)
 *
 * Responsive strategy:
 * - Desktop (≥768px): Horizontal layout, hover dropdowns
 * - Mobile (<768px): Hamburger icon + drawer menu
 * - Different links per device: mobile can have fewer, higher-priority links
 *
 * @example
 * ```typescript
 * const sameLinks = {
 *   desktop: [
 *     { label: 'Products', href: '/products' },
 *     { label: 'Pricing', href: '/pricing' },
 *     { label: 'About', href: '/about' }
 *   ]
 * }
 *
 * const differentLinks = {
 *   desktop: [
 *     { label: 'Products', href: '/products' },
 *     { label: 'Pricing', href: '/pricing' },
 *     { label: 'About', href: '/about' },
 *     { label: 'Contact', href: '/contact' }
 *   ],
 *   mobile: [
 *     { label: 'Home', href: '/' },
 *     { label: 'Products', href: '/products' }
 *   ]
 * }
 * ```
 */
export const NavigationLinksSchema = Schema.Struct({
  desktop: NavLinksSchema,
  mobile: Schema.optional(NavLinksSchema),
}).annotations({
  description: 'Navigation links for desktop and mobile',
})

/**
 * Search configuration
 *
 * Optional search input in navigation bar.
 *
 * All properties optional:
 * - enabled: Show search input (default: false)
 * - placeholder: Input placeholder text (default: "Search...")
 *
 * Integration:
 * - Triggers instant search results dropdown
 * - Common for documentation and content-heavy sites
 *
 * @example
 * ```typescript
 * const search = {
 *   enabled: true,
 *   placeholder: 'Search documentation...'
 * }
 * ```
 */
export const SearchConfigSchema = Schema.Struct({
  enabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Whether to show search input',
      default: false,
    })
  ),
  placeholder: Schema.optional(
    Schema.String.annotations({
      description: 'Search input placeholder',
      default: 'Search...',
    })
  ),
}).annotations({
  description: 'Search configuration',
})

/**
 * User account menu configuration
 *
 * Optional user account menu with login/signup or user avatar dropdown.
 *
 * All properties optional:
 * - enabled: Show user menu (default: false)
 * - loginUrl: Login page URL
 * - signupUrl: Signup page URL
 *
 * Behavior:
 * - Logged out: Shows "Log In" link + "Sign Up" button
 * - Logged in: Shows user avatar + dropdown (Profile, Settings, Log Out)
 * - Integrates with authentication state
 *
 * @example
 * ```typescript
 * const userMenu = {
 *   enabled: true,
 *   loginUrl: '/login',
 *   signupUrl: '/signup'
 * }
 * ```
 */
export const UserMenuConfigSchema = Schema.Struct({
  enabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Show user account menu',
      default: false,
    })
  ),
  loginUrl: Schema.optional(
    Schema.String.annotations({
      description: 'Login page URL',
    })
  ),
  signupUrl: Schema.optional(
    Schema.String.annotations({
      description: 'Signup page URL',
    })
  ),
}).annotations({
  description: 'User account menu',
})

/**
 * Main navigation configuration including logo, links, and CTA
 *
 * The header navigation bar displayed at the top of the page.
 *
 * Required properties:
 * - logo: Path to logo image (SVG recommended)
 *
 * Optional properties:
 * - logoMobile: Alternative logo for mobile devices (simplified or icon-only)
 * - logoAlt: Logo alt text for accessibility (WCAG compliance)
 * - sticky: Whether navigation sticks to top on scroll (default: false)
 * - transparent: Whether navigation has transparent background initially (default: false)
 * - links: Navigation links for desktop and mobile
 * - cta: Call-to-action button (Get Started, Sign Up, etc.)
 * - search: Search input configuration
 * - user: User account menu configuration
 *
 * Sticky behavior:
 * - sticky=true: position: sticky, top: 0, z-index: 50
 * - Always visible during scroll
 * - Common for dashboards and app navigation
 *
 * Transparent behavior:
 * - transparent=true: background transparent initially
 * - Transitions to opaque on scroll (with sticky)
 * - Perfect for landing pages with hero images
 *
 * Responsive logo:
 * - Desktop (≥768px): logo displayed
 * - Mobile (<768px): logoMobile displayed (if provided), else logo
 * - Common: full wordmark (desktop) vs icon (mobile)
 *
 * @example
 * ```typescript
 * const minimalNav = {
 *   logo: './public/logo.svg'
 * }
 *
 * const standardNav = {
 *   logo: './public/logo.svg',
 *   logoAlt: 'Company Logo',
 *   sticky: true,
 *   links: {
 *     desktop: [
 *       { label: 'Products', href: '/products' },
 *       { label: 'Pricing', href: '/pricing' },
 *       { label: 'About', href: '/about' }
 *     ]
 *   },
 *   cta: {
 *     text: 'Get Started',
 *     href: '/signup',
 *     variant: 'primary'
 *   }
 * }
 *
 * const transparentNav = {
 *   logo: './public/logo.svg',
 *   transparent: true,
 *   sticky: true,
 *   links: {
 *     desktop: [
 *       { label: 'Features', href: '/features' }
 *     ]
 *   }
 * }
 * ```
 *
 * @see specs/app/pages/layout/navigation/navigation.schema.json
 */
export const NavigationSchema = Schema.Struct({
  logo: Schema.String.annotations({
    description: 'Path to logo image',
  }),
  logoMobile: Schema.optional(
    Schema.String.annotations({
      description: 'Alternative logo for mobile devices',
    })
  ),
  logoAlt: Schema.optional(
    Schema.String.annotations({
      description: 'Logo alt text for accessibility',
    })
  ),
  sticky: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Whether navigation sticks to top on scroll',
      default: false,
    })
  ),
  transparent: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Whether navigation has transparent background initially',
      default: false,
    })
  ),
  backgroundColor: Schema.optional(
    Schema.String.annotations({
      description: 'Background color for navigation (hex, rgb, or named color)',
    })
  ),
  textColor: Schema.optional(
    Schema.String.annotations({
      description: 'Text color for navigation (hex, rgb, or named color)',
    })
  ),
  links: Schema.optional(NavigationLinksSchema),
  cta: Schema.optional(CtaButtonSchema),
  search: Schema.optional(SearchConfigSchema),
  user: Schema.optional(UserMenuConfigSchema),
}).annotations({
  title: 'Navigation Configuration',
  description: 'Main navigation configuration including logo, links, and CTA',
})

export type NavigationLinks = Schema.Schema.Type<typeof NavigationLinksSchema>
export type SearchConfig = Schema.Schema.Type<typeof SearchConfigSchema>
export type UserMenuConfig = Schema.Schema.Type<typeof UserMenuConfigSchema>
export type Navigation = Schema.Schema.Type<typeof NavigationSchema>
