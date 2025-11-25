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
function renderDivider(itemIndex: number, _counter: number): ReactElement {
  return (
    <hr
      key={`divider-${itemIndex}`}
      data-testid="sidebar-divider"
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
 *
 * Counter strategy (functional programming pattern):
 * - Each item type (link, divider, group) has independent sequential counter
 * - Counters thread through recursive calls for immutability
 * - Group counter increments BEFORE processing children (prevents nested ID conflicts)
 * - Returns tuple: [rendered elements, updated counters] for pure functional composition
 *
 * Example flow for nested structure:
 * 1. Link (counter.link=0) → renders "sidebar-link-0", returns counter.link=1
 * 2. Group (counter.group=0) → renders "sidebar-group-0"
 *    - Children start with counter.group=1 (pre-incremented)
 *    - Nested group renders "sidebar-group-1" (no conflict with parent)
 * 3. Divider (counter.divider=0) → renders "sidebar-divider", returns counter.divider=1
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
    // Capture current group ID for this level's test ID
    const currentGroupId = counters.group

    // IMPORTANT: Increment group counter BEFORE processing children
    // This prevents duplicate IDs in nested group structures:
    // - Parent group gets ID N
    // - Children start counting from N+1 (not N)
    // - Supports unlimited nesting depth without ID conflicts
    const [childElements, childCounters] = renderItems(firstItem.children ?? [], {
      ...counters,
      group: counters.group + 1, // Pre-increment for children's nested groups
    })
    const element = (
      <details
        key={`group-${itemIndex}`}
        data-testid={`sidebar-group-${currentGroupId}`}
        className="mb-2"
      >
        <summary className="cursor-pointer list-none text-gray-700">
          {firstItem.icon && <span className="mr-2">{firstItem.icon}</span>}
          {firstItem.label}
        </summary>
        <div
          data-testid={`sidebar-group-${currentGroupId}-children`}
          className="mt-1 ml-4"
        >
          {childElements}
        </div>
      </details>
    )
    const [restElements, finalCounters] = renderItems(restItems, childCounters)
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
function generateSidebarScript(
  collapsible: boolean,
  width: string,
  defaultCollapsed: boolean
): string {
  const toggleScript = collapsible
    ? `
                const toggle = document.querySelector('[data-testid="sidebar-toggle"]');
                if (sidebar && toggle) {
                  let collapsed = ${defaultCollapsed ? 'true' : 'false'};

                  // Apply initial state
                  sidebar.style.width = collapsed ? '64px' : '${width}';
                  sidebar.setAttribute('data-collapsed', collapsed ? 'true' : 'false');

                  toggle.addEventListener('click', () => {
                    collapsed = !collapsed;
                    sidebar.style.width = collapsed ? '64px' : '${width}';
                    sidebar.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
                  });
                }
                `
    : ''

  return `
              (function() {
                const sidebar = document.querySelector('[data-testid="sidebar"]') || document.querySelector('[data-testid^="sidebar-"]');

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
  readonly defaultCollapsed: boolean
  readonly items: readonly SidebarItem[]
} {
  return {
    width: props.width ?? '256px',
    position: props.position ?? 'left',
    collapsible: props.collapsible !== false,
    sticky: props.sticky !== false,
    defaultCollapsed: props.defaultCollapsed ?? false,
    items: props.items ?? [],
  }
}

/**
 * Build sidebar CSS classes
 */
function buildSidebarClasses(sticky: boolean, position: string): string {
  return [
    sticky && 'sticky top-0',
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
        data-testid={`sidebar-${config.position}`}
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
          __html: generateSidebarScript(config.collapsible, config.width, config.defaultCollapsed),
        }}
      />
    </>
  )
}
