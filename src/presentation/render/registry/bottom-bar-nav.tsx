/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveClasses } from '@/presentation/design/resolve-classes'
import { CURRENT_ENTRY_KEY } from '@/presentation/render/resolve/sidebar-current-resolver'
import { renderIcon } from '../elements/icon-renderer'
import type { NavItem } from '@/domain/models/app/pages/components/shared-schemas'
import type { ReactElement } from 'react'

/** Whether the server pass marked this tab the current page (`CURRENT_ENTRY_KEY`). */
const isCurrentTab = (item: NavItem): boolean =>
  (item as Readonly<Record<string, unknown>> & NavItem)[CURRENT_ENTRY_KEY] === true

/** The bar's height above the safe-area inset: the room every tab and the spacer share. */
const BAR_HEIGHT = 'h-16'

/**
 * A `navigation-menu` drawn as a phone's tab bar (`layout: bottom-bar`).
 *
 * Served as plain links, with no island: a tab bar has no panel to open, so it
 * works before and without JavaScript. The host stays IN the page flow at the
 * height of the bar — that is the page's bottom padding, so the last line of
 * content scrolls clear of it — while the `<nav>` inside is fixed to the foot of
 * the viewport, above the safe-area inset. The host carries the author's
 * classes, `responsive` visibility included, so `md: { visible: false }` hides
 * spacer and bar together.
 *
 * Each tab is its icon over its label. The current tab — marked by the same
 * server pass that marks a sidebar's entries — carries `aria-current="page"`.
 */
export function renderBottomBarNav(
  navItems: readonly NavItem[],
  elementProps: Record<string, unknown>
): ReactElement {
  const hostClassName = resolveClasses(
    `${BAR_HEIGHT} box-content pb-[env(safe-area-inset-bottom)]`,
    elementProps['className'] as string | undefined
  )
  return (
    <div
      data-slot="bottom-bar"
      data-component-type="navigation-menu"
      data-testid={elementProps['data-testid'] as string | undefined}
      className={hostClassName}
    >
      <nav
        aria-label={elementProps['aria-label'] as string | undefined}
        className="bg-background border-border fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)]"
      >
        <ul className={`${BAR_HEIGHT} flex items-stretch justify-around`}>
          {navItems.map((item) => {
            const current = isCurrentTab(item)
            return (
              <li
                key={`${item.label}-${item.href ?? ''}`}
                className="flex flex-1"
              >
                <a
                  href={item.href}
                  {...(current ? { 'aria-current': 'page' as const } : {})}
                  className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs ${current ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
                >
                  {item.icon !== undefined &&
                    renderIcon({ name: item.icon, size: 20, 'aria-hidden': 'true' }, [])}
                  <span>{item.label}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
