/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Sidebar position
 *
 * - left: Sidebar on left side (default, 90% of sites)
 * - right: Sidebar on right side (table of contents, metadata)
 */
export const SidebarPositionSchema = Schema.Literal('left', 'right').annotations({
  description: 'Sidebar position',
})

/**
 * Sidebar item type
 *
 * 3 types of sidebar items:
 * - link: Clickable navigation link
 * - group: Collapsible section with nested children
 * - divider: Visual separator (horizontal line)
 */
export const SidebarItemTypeSchema = Schema.Literal('link', 'group', 'divider').annotations({
  description: 'Sidebar item type',
})

/**
 * Sidebar item (link, group, or divider)
 *
 * Recursive structure supporting unlimited nesting:
 * - link: Direct navigation link (label, href, icon)
 * - group: Collapsible section with children array
 * - divider: Horizontal separator (no label/href/icon)
 *
 * Required properties:
 * - type: Item type (link, group, divider)
 *
 * Optional properties (depends on type):
 * - label: Text displayed (required for link/group, not for divider)
 * - href: Link destination (required for link, not for group/divider)
 * - icon: Icon name (optional for link/group, not for divider)
 * - children: Nested items array (only for group, recursive)
 *
 * @example
 * ```typescript
 * const link = {
 *   type: 'link',
 *   label: 'Dashboard',
 *   href: '/dashboard',
 *   icon: 'home'
 * }
 *
 * const group = {
 *   type: 'group',
 *   label: 'Products',
 *   icon: 'package',
 *   children: [
 *     { type: 'link', label: 'All Products', href: '/products' },
 *     { type: 'link', label: 'Add Product', href: '/products/new' }
 *   ]
 * }
 *
 * const divider = {
 *   type: 'divider'
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Recursive schema with suspended children requires any for circular reference resolution
export const SidebarItemSchema: Schema.Schema<any, any, never> = Schema.Struct({
  type: SidebarItemTypeSchema,
  label: Schema.optional(
    Schema.String.annotations({
      description: 'Item label',
    })
  ),
  href: Schema.optional(
    Schema.String.annotations({
      description: 'Link destination',
    })
  ),
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Item icon',
    })
  ),
  children: Schema.optional(
    Schema.suspend(() => SidebarItemsSchema).pipe(
      Schema.annotations({
        identifier: 'SidebarItems',
      })
    )
  ),
}).annotations({
  description: 'Sidebar item',
})

/**
 * Sidebar items array
 *
 * Array of sidebar navigation items (links, groups, dividers).
 * Supports unlimited nesting through recursive children in groups.
 *
 * @example
 * ```typescript
 * const items = [
 *   { type: 'link', label: 'Dashboard', href: '/dashboard', icon: 'home' },
 *   { type: 'link', label: 'Analytics', href: '/analytics', icon: 'chart' },
 *   { type: 'divider' },
 *   {
 *     type: 'group',
 *     label: 'Products',
 *     icon: 'package',
 *     children: [
 *       { type: 'link', label: 'All Products', href: '/products' },
 *       { type: 'link', label: 'Add Product', href: '/products/new' }
 *     ]
 *   },
 *   { type: 'link', label: 'Settings', href: '/settings', icon: 'settings' }
 * ]
 * ```
 */
export const SidebarItemsSchema = Schema.Array(SidebarItemSchema).annotations({
  description: 'Sidebar items array',
})

/**
 * Sidebar navigation and content configuration
 *
 * Persistent side panel navigation for documentation sites, dashboards, and admin panels.
 *
 * Required properties:
 * - enabled: Whether to show sidebar (default: false, opt-in)
 *
 * Optional properties:
 * - position: Sidebar position (left or right, default: left)
 * - width: Sidebar width (CSS value, default: 256px)
 * - collapsible: Whether sidebar can be collapsed (default: true)
 * - defaultCollapsed: Whether sidebar starts collapsed (default: false)
 * - sticky: Whether sidebar sticks on scroll (default: true)
 * - items: Array of navigation items (links, groups, dividers)
 *
 * Sidebar behavior:
 * - collapsible: Toggle button collapses to icon-only (64px width)
 * - defaultCollapsed: Starts in collapsed state
 * - sticky: position: sticky, top: 0 (always visible during scroll)
 * - localStorage: Saves collapsed state across page loads
 *
 * Item types:
 * - link: Direct navigation link
 * - group: Collapsible section with nested children
 * - divider: Visual separator between sections
 *
 * Use cases:
 * - Documentation: Hierarchical groups (3-4 levels deep)
 * - Dashboard: Flat links with few groups, icon-focused
 * - Admin panel: Wide sidebar (280-320px), many top-level groups
 *
 * @example
 * ```typescript
 * const docsSidebar = {
 *   enabled: true,
 *   position: 'left',
 *   width: '280px',
 *   collapsible: true,
 *   sticky: true,
 *   items: [
 *     { type: 'link', label: 'Introduction', href: '/docs/intro', icon: 'book' },
 *     {
 *       type: 'group',
 *       label: 'Getting Started',
 *       icon: 'rocket',
 *       children: [
 *         { type: 'link', label: 'Installation', href: '/docs/installation' },
 *         { type: 'link', label: 'Quick Start', href: '/docs/quick-start' }
 *       ]
 *     },
 *     { type: 'divider' },
 *     { type: 'link', label: 'API Reference', href: '/docs/api', icon: 'code' }
 *   ]
 * }
 *
 * const dashboardSidebar = {
 *   enabled: true,
 *   collapsible: true,
 *   defaultCollapsed: false,
 *   items: [
 *     { type: 'link', label: 'Dashboard', href: '/dashboard', icon: 'home' },
 *     { type: 'link', label: 'Analytics', href: '/analytics', icon: 'chart' },
 *     { type: 'divider' },
 *     { type: 'link', label: 'Settings', href: '/settings', icon: 'settings' }
 *   ]
 * }
 * ```
 *
 * @see specs/app/pages/layout/sidebar/sidebar.schema.json
 */
/**
 * Simple sidebar link (legacy format)
 */
const SidebarLinkSchema = Schema.Struct({
  label: Schema.String,
  href: Schema.String,
})

export const SidebarSchema = Schema.Struct({
  enabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Whether to show the sidebar',
      default: false,
    })
  ),
  position: Schema.optional(SidebarPositionSchema),
  width: Schema.optional(
    Schema.String.annotations({
      description: 'Sidebar width',
      default: '256px',
    })
  ),
  collapsible: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Whether sidebar can be collapsed',
      default: true,
    })
  ),
  defaultCollapsed: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Whether sidebar starts collapsed',
      default: false,
    })
  ),
  sticky: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Whether sidebar sticks on scroll',
      default: true,
    })
  ),
  items: Schema.optional(SidebarItemsSchema),
  links: Schema.optional(
    Schema.Array(SidebarLinkSchema).annotations({
      description: 'Simple sidebar links (legacy format, use items for advanced features)',
    })
  ),
}).annotations({
  title: 'Sidebar Configuration',
  description: 'Sidebar navigation and content configuration',
})

export type SidebarPosition = Schema.Schema.Type<typeof SidebarPositionSchema>
export type SidebarItemType = Schema.Schema.Type<typeof SidebarItemTypeSchema>
export type SidebarItem = Schema.Schema.Type<typeof SidebarItemSchema>
export type SidebarItems = Schema.Schema.Type<typeof SidebarItemsSchema>
export type Sidebar = Schema.Schema.Type<typeof SidebarSchema>
