/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Link target for navigation
 *
 * Standard HTML link targets:
 * - _self: Same window/tab (default)
 * - _blank: New window/tab
 * - _parent: Parent frame
 * - _top: Full window (breaks out of frames)
 */
export const NavLinkTargetSchema = Schema.Literal('_self', '_blank', '_parent', '_top').annotations(
  {
    description: 'Link target',
  }
)

/**
 * Navigation link item
 *
 * Defines a single link in navigation with support for:
 * - Basic links (label + href)
 * - External links (target="_blank")
 * - Icons for visual enhancement
 * - Badges for highlighting (e.g., "New", "Beta")
 * - Dropdown menus (recursive children)
 *
 * Required properties:
 * - label: Link text displayed to user
 * - href: Destination URL or anchor (#section)
 *
 * Optional properties:
 * - target: Link target (_self, _blank, _parent, _top)
 * - icon: Icon name to display before label
 * - badge: Badge text to highlight link (e.g., "New", "Beta")
 * - children: Nested dropdown menu items (recursive)
 *
 * Recursive structure:
 * - children array can contain more NavLinkSchema items
 * - Enables unlimited nesting for mega menus
 * - Each child follows same structure (label, href, children, etc.)
 *
 * @example
 * ```typescript
 * const simpleLink = {
 *   label: 'Home',
 *   href: '/'
 * }
 *
 * const externalLink = {
 *   label: 'Documentation',
 *   href: 'https://docs.example.com',
 *   target: '_blank',
 *   icon: 'book'
 * }
 *
 * const dropdownMenu = {
 *   label: 'Products',
 *   href: '/products',
 *   icon: 'package',
 *   badge: 'New',
 *   children: [
 *     {
 *       label: 'Product A',
 *       href: '/products/a'
 *     },
 *     {
 *       label: 'Product B',
 *       href: '/products/b'
 *     }
 *   ]
 * }
 * ```
 *
 * @see specs/app/pages/layout/navigation/nav-links.schema.json
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Recursive schema with suspended children requires any for circular reference resolution
export const NavLinkSchema: Schema.Schema<any, any, never> = Schema.Struct({
  label: Schema.String.annotations({
    description: 'Link text',
  }),
  href: Schema.String.annotations({
    description: 'Link destination (URL or anchor)',
  }),
  target: Schema.optional(NavLinkTargetSchema),
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Optional icon name',
    })
  ),
  badge: Schema.optional(
    Schema.String.annotations({
      description: "Optional badge text (e.g., 'New', 'Beta')",
    })
  ),
  children: Schema.optional(
    Schema.suspend(() => NavLinksSchema).pipe(
      Schema.annotations({
        identifier: 'NavLinks',
      })
    )
  ),
}).annotations({
  description: 'Navigation link item',
})

/**
 * Navigation links array
 *
 * Array of navigation link items for desktop and mobile menus.
 * Supports flat lists or hierarchical dropdowns through recursive children.
 *
 * Common patterns:
 * - Flat navigation: [Home, About, Contact] - no children
 * - Dropdown menus: Products → [Product A, Product B] - 1 level deep
 * - Mega menus: Products → Categories → Items - 2+ levels deep
 *
 * Responsive considerations:
 * - Desktop: Horizontal layout with hover dropdowns
 * - Mobile: Hamburger menu with expandable sections
 * - Different links per device (navigation.links.desktop vs mobile)
 *
 * @example
 * ```typescript
 * const flatNav = [
 *   { label: 'Home', href: '/' },
 *   { label: 'About', href: '/about' },
 *   { label: 'Contact', href: '#contact' }
 * ]
 *
 * const dropdownNav = [
 *   { label: 'Home', href: '/' },
 *   {
 *     label: 'Products',
 *     href: '/products',
 *     children: [
 *       { label: 'Product A', href: '/products/a' },
 *       { label: 'Product B', href: '/products/b' }
 *     ]
 *   },
 *   { label: 'Pricing', href: '/pricing' }
 * ]
 * ```
 *
 * @see specs/app/pages/layout/navigation/nav-links.schema.json
 */
export const NavLinksSchema = Schema.Array(NavLinkSchema).annotations({
  title: 'Navigation Links',
  description: 'Array of navigation link items',
})

export type NavLinkTarget = Schema.Schema.Type<typeof NavLinkTargetSchema>
export type NavLink = Schema.Schema.Type<typeof NavLinkSchema>
export type NavLinks = Schema.Schema.Type<typeof NavLinksSchema>
