/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */
import { describe, test, expect } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Sidebar } from './sidebar'
import type { SidebarItem } from '@/domain/models/app/page/layout/sidebar'

describe('Sidebar Component', () => {
  describe('Basic rendering', () => {
    test('renders sidebar element', () => {
      // When
      const html = renderToStaticMarkup(<Sidebar />)
      // Then
      expect(html).toContain('data-testid="sidebar-left"')
      expect(html).toContain('<aside')
    })
    test('renders with default width', () => {
      // When
      const html = renderToStaticMarkup(<Sidebar />)
      // Then
      expect(html).toContain('data-testid="sidebar-left"')
      expect(html).toContain('width:256px')
      expect(html).toContain('height:100vh')
    })
    test('renders with custom width', () => {
      // When
      const html = renderToStaticMarkup(<Sidebar width="300px" />)
      // Then
      expect(html).toContain('data-testid="sidebar-left"')
      expect(html).toContain('width:300px')
    })
    test('renders with left position by default', () => {
      // When
      const html = renderToStaticMarkup(<Sidebar />)
      // Then
      expect(html).toContain('data-testid="sidebar-left"')
      expect(html).toContain('data-position="left"')
      expect(html).toContain('border-r')
    })
    test('renders with right position', () => {
      // When
      const html = renderToStaticMarkup(<Sidebar position="right" />)
      // Then
      expect(html).toContain('data-testid="sidebar-right"')
      expect(html).toContain('data-position="right"')
      expect(html).toContain('border-l')
    })
  })
  describe('Collapsible functionality', () => {
    test('renders toggle button when collapsible and has content', () => {
      // When
      const html = renderToStaticMarkup(
        <Sidebar
          collapsible={true}
          items={[{ type: 'link', label: 'Home', href: '/' }]}
        />
      )
      // Then
      expect(html).toContain('data-testid="sidebar-toggle"')
      expect(html).toContain('Toggle')
    })
    test('renders toggle button by default when has content', () => {
      // When
      const html = renderToStaticMarkup(
        <Sidebar items={[{ type: 'link', label: 'Home', href: '/' }]} />
      )
      // Then
      expect(html).toContain('data-testid="sidebar-toggle"')
    })
    test('does not render toggle when collapsible is false', () => {
      // When
      const html = renderToStaticMarkup(
        <Sidebar
          collapsible={false}
          items={[{ type: 'link', label: 'Home', href: '/' }]}
        />
      )
      // Then
      expect(html).not.toContain('data-testid="sidebar-toggle"')
    })
    test('does not render toggle button element when no content', () => {
      // When
      const html = renderToStaticMarkup(<Sidebar collapsible={true} />)
      // Then - Should not contain the button element (script may reference it)
      expect(html).not.toContain('<button')
      expect(html).not.toContain('Toggle</button>')
    })
    test('toggle button has correct styling', () => {
      // When
      const html = renderToStaticMarkup(
        <Sidebar items={[{ type: 'link', label: 'Home', href: '/' }]} />
      )
      // Then
      expect(html).toContain('data-testid="sidebar-toggle"')
      expect(html).toContain('mb-4')
      expect(html).toContain('rounded')
      expect(html).toContain('border')
    })
  })
  describe('Sticky positioning', () => {
    test('applies sticky positioning by default', () => {
      // When
      const html = renderToStaticMarkup(<Sidebar />)
      // Then
      expect(html).toContain('fixed')
      expect(html).toContain('top-0')
    })
    test('does not apply sticky when false', () => {
      // When
      const html = renderToStaticMarkup(<Sidebar sticky={false} />)
      // Then
      expect(html).not.toContain('fixed')
      expect(html).not.toContain('top-0')
    })
  })
  describe('Sidebar items - Links', () => {
    test('renders link items', () => {
      // Given
      const items: SidebarItem[] = [
        { type: 'link', label: 'Home', href: '/' },
        { type: 'link', label: 'About', href: '/about' },
        { type: 'link', label: 'Contact', href: '/contact' },
      ]
      // When
      const html = renderToStaticMarkup(<Sidebar items={items} />)
      // Then
      expect(html).toContain('data-testid="sidebar-link-0"')
      expect(html).toContain('href="/"')
      expect(html).toContain('Home')
      expect(html).toContain('data-testid="sidebar-link-1"')
      expect(html).toContain('href="/about"')
      expect(html).toContain('About')
      expect(html).toContain('data-testid="sidebar-link-2"')
      expect(html).toContain('href="/contact"')
      expect(html).toContain('Contact')
    })
    test('renders links with icons', () => {
      // Given
      const items: SidebarItem[] = [
        { type: 'link', label: 'Dashboard', href: '/dashboard', icon: '📊' },
        { type: 'link', label: 'Settings', href: '/settings', icon: '⚙️' },
      ]
      // When
      const html = renderToStaticMarkup(<Sidebar items={items} />)
      // Then
      expect(html).toContain('data-testid="sidebar-link-0"')
      expect(html).toContain('📊')
      expect(html).toContain('Dashboard')
      expect(html).toContain('data-testid="sidebar-link-1"')
      expect(html).toContain('⚙️')
      expect(html).toContain('Settings')
    })
  })
  describe('Sidebar items - Groups', () => {
    test('renders group items with children', () => {
      // Given
      const items: SidebarItem[] = [
        {
          type: 'group',
          label: 'Products',
          children: [
            { type: 'link', label: 'Software', href: '/products/software' },
            { type: 'link', label: 'Hardware', href: '/products/hardware' },
          ],
        },
      ]
      // When
      const html = renderToStaticMarkup(<Sidebar items={items} />)
      // Then
      expect(html).toContain('data-testid="sidebar-group-0"')
      expect(html).toContain('<details')
      expect(html).toContain('<summary')
      expect(html).toContain('Products')
      expect(html).toContain('data-testid="sidebar-group-0-children"')
      expect(html).toContain('data-testid="sidebar-link-0"')
      expect(html).toContain('Software')
      expect(html).toContain('data-testid="sidebar-link-1"')
      expect(html).toContain('Hardware')
    })
    test('renders groups with icons', () => {
      // Given
      const items: SidebarItem[] = [
        {
          type: 'group',
          label: 'Settings',
          icon: '⚙️',
          children: [{ type: 'link', label: 'Profile', href: '/settings/profile' }],
        },
      ]
      // When
      const html = renderToStaticMarkup(<Sidebar items={items} />)
      // Then
      expect(html).toContain('data-testid="sidebar-group-0"')
      expect(html).toContain('<summary')
      expect(html).toContain('⚙️')
      expect(html).toContain('Settings')
    })
    test('renders empty groups', () => {
      // Given
      const items: SidebarItem[] = [
        {
          type: 'group',
          label: 'Empty Group',
          children: [],
        },
      ]
      // When
      const html = renderToStaticMarkup(<Sidebar items={items} />)
      // Then
      expect(html).toContain('data-testid="sidebar-group-0"')
      expect(html).toContain('data-testid="sidebar-group-0-children"')
    })
    test('renders nested groups', () => {
      // Given
      const items: SidebarItem[] = [
        {
          type: 'group',
          label: 'Main',
          children: [
            { type: 'link', label: 'Link 1', href: '/link1' },
            {
              type: 'group',
              label: 'Nested',
              children: [{ type: 'link', label: 'Nested Link', href: '/nested' }],
            },
          ],
        },
      ]
      // When
      const html = renderToStaticMarkup(<Sidebar items={items} />)
      // Then
      expect(html).toContain('data-testid="sidebar-group-0"')
      expect(html).toContain('data-testid="sidebar-link-0"')
      expect(html).toContain('Link 1')
      expect(html).toContain('Nested')
      expect(html).toContain('data-testid="sidebar-link-1"')
      expect(html).toContain('Nested Link')
    })
  })
  describe('Sidebar items - Dividers', () => {
    test('renders divider items', () => {
      // Given
      const items: SidebarItem[] = [
        { type: 'link', label: 'Above', href: '/above' },
        { type: 'divider' },
        { type: 'link', label: 'Below', href: '/below' },
      ]
      // When
      const html = renderToStaticMarkup(<Sidebar items={items} />)
      // Then
      expect(html).toContain('data-testid="sidebar-divider-0"')
      expect(html).toContain('<hr')
      expect(html).toContain('my-2')
      expect(html).toContain('border-t')
    })
    test('renders multiple dividers with correct numbering', () => {
      // Given
      const items: SidebarItem[] = [
        { type: 'divider' },
        { type: 'link', label: 'Link', href: '/link' },
        { type: 'divider' },
      ]
      // When
      const html = renderToStaticMarkup(<Sidebar items={items} />)
      // Then
      expect(html).toContain('data-testid="sidebar-divider-0"')
      expect(html).toContain('data-testid="sidebar-divider-1"')
    })
  })
  describe('Complex item combinations', () => {
    test('renders mixed item types', () => {
      // Given
      const items: SidebarItem[] = [
        { type: 'link', label: 'Home', href: '/' },
        { type: 'divider' },
        {
          type: 'group',
          label: 'Products',
          children: [{ type: 'link', label: 'Software', href: '/software' }],
        },
        { type: 'divider' },
        { type: 'link', label: 'Contact', href: '/contact' },
      ]
      // When
      const html = renderToStaticMarkup(<Sidebar items={items} />)
      // Then
      expect(html).toContain('data-testid="sidebar-link-0"')
      expect(html).toContain('data-testid="sidebar-divider-0"')
      expect(html).toContain('data-testid="sidebar-group-0"')
      expect(html).toContain('data-testid="sidebar-link-1"')
      expect(html).toContain('data-testid="sidebar-divider-1"')
      expect(html).toContain('data-testid="sidebar-link-2"')
    })
    test('maintains correct counter sequence across all item types', () => {
      // Given
      const items: SidebarItem[] = [
        { type: 'link', label: 'Link 1', href: '/1' },
        {
          type: 'group',
          label: 'Group 1',
          children: [
            { type: 'link', label: 'Child 1', href: '/c1' },
            { type: 'divider' },
            { type: 'link', label: 'Child 2', href: '/c2' },
          ],
        },
        { type: 'link', label: 'Link 2', href: '/2' },
      ]
      // When
      const html = renderToStaticMarkup(<Sidebar items={items} />)
      // Then
      expect(html).toContain('data-testid="sidebar-link-0"')
      expect(html).toContain('Link 1')
      expect(html).toContain('data-testid="sidebar-group-0"')
      expect(html).toContain('data-testid="sidebar-link-1"')
      expect(html).toContain('Child 1')
      expect(html).toContain('data-testid="sidebar-divider-0"')
      expect(html).toContain('data-testid="sidebar-link-2"')
      expect(html).toContain('Child 2')
      expect(html).toContain('data-testid="sidebar-link-3"')
      expect(html).toContain('Link 2')
    })
  })
  describe('Legacy links support', () => {
    test('renders legacy links array', () => {
      // Given
      const links = [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' },
      ]
      // When
      const html = renderToStaticMarkup(<Sidebar links={links} />)
      // Then
      expect(html).toContain('<li')
      expect(html).toContain('Home')
      expect(html).toContain('href="/"')
      expect(html).toContain('About')
      expect(html).toContain('Contact')
    })
    test('prioritizes items over legacy links', () => {
      // Given
      const items: SidebarItem[] = [{ type: 'link', label: 'Modern Link', href: '/modern' }]
      const links = [{ label: 'Legacy Link', href: '/legacy' }]
      // When
      const html = renderToStaticMarkup(
        <Sidebar
          items={items}
          links={links}
        />
      )

      // Then
      expect(html).toContain('data-testid="sidebar-link-0"')
      expect(html).toContain('Modern Link')
      // Legacy links should not render when items are present
      expect(html).not.toContain('Legacy Link')
    })
  })
  describe('Styling', () => {
    test('applies default sidebar classes', () => {
      // When
      const html = renderToStaticMarkup(<Sidebar />)
      // Then
      expect(html).toContain('overflow-y-auto')
      expect(html).toContain('bg-white')
      expect(html).toContain('p-4')
    })
    test('applies position-specific border', () => {
      // When - left position
      const htmlLeft = renderToStaticMarkup(<Sidebar position="left" />)
      expect(htmlLeft).toContain('border-r')
      expect(htmlLeft).toContain('border-gray-200')
      // When - right position
      const htmlRight = renderToStaticMarkup(<Sidebar position="right" />)
      expect(htmlRight).toContain('border-l')
      expect(htmlRight).toContain('border-gray-200')
    })
  })
  describe('Client-side script generation', () => {
    test('generates script tag', () => {
      // When
      const html = renderToStaticMarkup(<Sidebar />)
      // Then
      expect(html).toContain('<script')
      expect(html).toContain('sidebar')
    })
    test('includes toggle functionality in script when collapsible', () => {
      // When
      const html = renderToStaticMarkup(<Sidebar collapsible={true} />)
      // Then
      expect(html).toContain('<script')
      expect(html).toContain('sidebar-toggle')
      expect(html).toContain('addEventListener')
      expect(html).toContain('collapsed')
    })
    test('does not include toggle functionality when not collapsible', () => {
      // When
      const html = renderToStaticMarkup(<Sidebar collapsible={false} />)
      // Then
      expect(html).toContain('<script')
      expect(html).not.toContain('sidebar-toggle')
      expect(html).not.toContain('collapsed')
    })
    test('includes correct width in toggle script', () => {
      // When
      const html = renderToStaticMarkup(
        <Sidebar
          collapsible={true}
          width="400px"
        />
      )

      // Then
      expect(html).toContain('<script')
      expect(html).toContain('400px')
    })
  })
  describe('Edge cases', () => {
    test('renders without nav when items array is empty', () => {
      // When
      const html = renderToStaticMarkup(<Sidebar items={[]} />)
      // Then
      expect(html).toContain('data-testid="sidebar-left"')
      expect(html).not.toContain('<nav')
      expect(html).not.toContain('<button')
    })
    test('renders without nav when items is undefined', () => {
      // When
      const html = renderToStaticMarkup(<Sidebar />)
      // Then
      expect(html).toContain('data-testid="sidebar-left"')
      expect(html).not.toContain('<nav')
      expect(html).not.toContain('<button')
    })
    test('handles groups with undefined children', () => {
      // Given
      const items: SidebarItem[] = [
        {
          type: 'group',
          label: 'Group',
          // children is undefined
        },
      ]
      // When
      const html = renderToStaticMarkup(<Sidebar items={items} />)
      // Then
      expect(html).toContain('data-testid="sidebar-group-0"')
    })
  })
})
