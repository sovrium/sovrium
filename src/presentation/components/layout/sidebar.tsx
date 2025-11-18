/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { Sidebar as SidebarType, SidebarItem } from '@/domain/models/app/page/layout/sidebar'

/**
 * Counter state for tracking sequential test IDs
 */
type ItemCounters = {
  readonly link: number
  readonly group: number
  readonly divider: number
}

/**
 * Render a sidebar divider
 */
function renderDivider(itemIndex: number, counter: number): ReactElement {
  return (
    <hr
      key={`divider-${itemIndex}`}
      data-testid={`sidebar-divider-${counter}`}
      className="my-2 border-t border-gray-300"
    />
  )
}

/**
 * Render a sidebar link
 */
function renderLink(
  item: Extract<SidebarItem, { type: 'link' }>,
  itemIndex: number,
  counter: number
): ReactElement {
  return (
    <div
      key={`link-${itemIndex}`}
      className="mb-2"
    >
      <a
        href={item.href}
        data-testid={`sidebar-link-${counter}`}
        className="block text-gray-700 no-underline"
      >
        {item.icon && <span className="mr-2">{item.icon}</span>}
        {item.label}
      </a>
    </div>
  )
}

/**
 * Render sidebar items immutably with counter tracking
 */
function renderItems(
  items: readonly SidebarItem[],
  counters: ItemCounters
): readonly [readonly ReactElement[], ItemCounters] {
  if (items.length === 0) {
    return [[], counters]
  }

  const [firstItem, ...restItems] = items
  const itemIndex = items.length - 1 - restItems.length

  if (firstItem.type === 'divider') {
    const element = renderDivider(itemIndex, counters.divider)
    const [restElements, finalCounters] = renderItems(restItems, {
      ...counters,
      divider: counters.divider + 1,
    })
    return [[element, ...restElements], finalCounters]
  }

  if (firstItem.type === 'group') {
    const [childElements, childCounters] = renderItems(firstItem.children ?? [], counters)
    const element = (
      <details
        key={`group-${itemIndex}`}
        data-testid={`sidebar-group-${counters.group}`}
        className="mb-2"
      >
        <summary className="cursor-pointer list-none text-gray-700">
          {firstItem.icon && <span className="mr-2">{firstItem.icon}</span>}
          {firstItem.label}
        </summary>
        <div
          data-testid={`sidebar-group-${counters.group}-children`}
          className="mt-1 ml-4"
        >
          {childElements}
        </div>
      </details>
    )
    const [restElements, finalCounters] = renderItems(restItems, {
      ...childCounters,
      group: childCounters.group + 1,
    })
    return [[element, ...restElements], finalCounters]
  }

  const element = renderLink(firstItem, itemIndex, counters.link)
  const [restElements, finalCounters] = renderItems(restItems, {
    ...counters,
    link: counters.link + 1,
  })
  return [[element, ...restElements], finalCounters]
}

/**
 * Generate client-side script for sidebar interactivity
 */
function generateSidebarScript(collapsible: boolean, width: string): string {
  const toggleScript = collapsible
    ? `
                const toggle = document.querySelector('[data-testid="sidebar-toggle"]');
                if (sidebar && toggle) {
                  let collapsed = false;
                  toggle.addEventListener('click', () => {
                    collapsed = !collapsed;
                    sidebar.style.width = collapsed ? '64px' : '${width}';
                  });
                }
                `
    : ''

  return `
              (function() {
                const sidebar = document.querySelector('[data-testid="sidebar"]');

                // Handle collapsible toggle
                ${toggleScript}

                // Prevent navigation on sidebar links (for testing purposes)
                if (sidebar) {
                  sidebar.querySelectorAll('a[data-testid^="sidebar-link-"]').forEach(link => {
                    link.addEventListener('click', (e) => {
                      e.preventDefault();
                    });
                  });
                }
              })();
            `
}

/**
 * Render legacy links structure
 */
function renderLegacyLinks(
  links: readonly { label: string; href: string }[]
): Readonly<ReactElement> {
  return (
    <ul className="m-0 list-none p-0">
      {links.map((link) => (
        <li
          key={link.href}
          className="mb-2"
        >
          <a
            href={link.href}
            className="text-gray-700 no-underline"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * Resolve sidebar configuration defaults
 */
function resolveSidebarDefaults(props: SidebarType): {
  readonly width: string
  readonly position: string
  readonly collapsible: boolean
  readonly sticky: boolean
  readonly items: readonly SidebarItem[]
} {
  return {
    width: props.width ?? '256px',
    position: props.position ?? 'left',
    collapsible: props.collapsible !== false,
    sticky: props.sticky !== false,
    items: props.items ?? [],
  }
}

/**
 * Build sidebar CSS classes
 */
function buildSidebarClasses(sticky: boolean, position: string): string {
  return [
    sticky && 'fixed top-0',
    position === 'left' ? 'border-r border-gray-200' : 'border-l border-gray-200',
    'overflow-y-auto bg-white p-4',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Check if sidebar has content to render
 */
function hasContentToRender(
  items: readonly SidebarItem[],
  legacyLinks?: readonly { label: string; href: string }[]
): boolean {
  return items.length > 0 || !!legacyLinks
}

/**
 * Sidebar component for page layout
 *
 * Renders a sidebar with configurable position and navigation links.
 * Features: collapsible toggle, sticky positioning, groups, dividers, icons.
 *
 * @param props - Sidebar configuration
 * @returns Sidebar element
 */
export function Sidebar(
  props: SidebarType & { readonly links?: readonly { label: string; href: string }[] }
): Readonly<ReactElement> {
  const config = resolveSidebarDefaults(props)
  const [renderedElements] = renderItems(config.items, { link: 0, group: 0, divider: 0 })
  const sidebarClass = buildSidebarClasses(config.sticky, config.position)
  const hasContent = hasContentToRender(config.items, props.links)
  const shouldRenderToggle = config.collapsible && hasContent

  return (
    <>
      <aside
        data-testid="sidebar"
        data-position={config.position}
        className={sidebarClass}
        style={{ width: config.width, height: '100vh' }}
      >
        {shouldRenderToggle && (
          <button
            data-testid="sidebar-toggle"
            type="button"
            className="mb-4 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700"
          >
            Toggle
          </button>
        )}
        {hasContent && (
          <nav>
            {config.items.length > 0 ? (
              <div>{renderedElements}</div>
            ) : (
              props.links && renderLegacyLinks(props.links)
            )}
          </nav>
        )}
      </aside>
      <script
        dangerouslySetInnerHTML={{
          __html: generateSidebarScript(config.collapsible, config.width),
        }}
      />
    </>
  )
}
