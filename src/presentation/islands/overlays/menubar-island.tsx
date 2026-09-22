/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { ToggleMenuItem } from './menu-toggle-item'
import {
  computeMenuItemClasses,
  computeMenuPopupClasses,
  computeMenuSeparatorClasses,
  computeMenuTriggerClasses,
  computeMenubarContainerClasses,
} from './overlay-default-classes'
import type { ReactElement } from 'react'

interface MenuItem {
  readonly label?: string
  readonly icon?: string
  readonly shortcut?: string
  readonly disabled?: boolean
  readonly separator?: boolean
  readonly variant?: 'default' | 'destructive'
  /**
   * Makes this row a toggle, starting in the state it names — the same
   * `MenuItemSchema` key `dropdown-menu` and `context-menu` read.
   *
   * This island keeps its own item interface rather than importing the shared
   * one, so it gets nothing for free: a capability taught to `menu-island.tsx`
   * alone would leave a menubar drawing a plain row from identical config. What
   * IS shared is the row itself ({@link ToggleMenuItem}) — the half that has to
   * look and behave the same wherever a menu draws it.
   */
  readonly toggle?: 'checked' | 'unchecked'
}

interface MenuGroup {
  readonly label: string
  readonly items: readonly MenuItem[]
}

interface MenubarIslandProps {
  readonly menus?: readonly MenuGroup[]
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/**
 * Render ONE row of a menubar group, dispatching on separator / toggle / plain.
 *
 * Extracted from the map it used to sit inside: a third shape there would make
 * a nested ternary of the JSX, and the dispatch is the thing a reader looking
 * for "which kinds of row can a menubar hold" needs to find.
 *
 * A row declaring `toggle` goes to the SHARED row, which is what keeps the
 * switch in the same place with the same paint as on a dropdown or a context
 * menu. Everything else keeps the markup this island already emitted.
 */
function renderMenubarEntry(item: MenuItem, index: number): ReactElement {
  if (item.separator) {
    return (
      <Menu.Separator
        key={`sep-${index}`}
        className={computeMenuSeparatorClasses()}
      />
    )
  }
  if (item.toggle !== undefined) {
    return (
      <ToggleMenuItem
        key={`item-${index}`}
        item={item}
        surface="default"
      />
    )
  }
  return (
    <Menu.Item
      key={`item-${index}`}
      disabled={item.disabled}
      className={computeMenuItemClasses({ variant: item.variant ?? 'default' })}
    >
      <span className="flex-1">{item.label}</span>
      {item.shortcut && (
        <span className="text-foreground-subtle ml-4 text-sm">{item.shortcut}</span>
      )}
    </Menu.Item>
  )
}

/**
 * Menubar island — renders a horizontal menu bar with dropdown menus.
 *
 * Each top-level label opens a dropdown with items, shortcuts, and separators.
 * Built using multiple Base UI Menu instances coordinated in a flex container.
 */
export default function MenubarIsland({
  menus = [],
  className,
  id,
  'data-testid': testId,
}: MenubarIslandProps): ReactElement {
  return (
    <div
      role="menubar"
      className={resolveClasses(computeMenubarContainerClasses(), className)}
      id={id}
      data-testid={testId}
    >
      {menus.map((menu, menuIndex) => (
        <Menu.Root key={`menu-${menuIndex}`}>
          <Menu.Trigger className={computeMenuTriggerClasses()}>{menu.label}</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner
              side="bottom"
              align="start"
              sideOffset={4}
            >
              <Menu.Popup className={computeMenuPopupClasses()}>
                {menu.items.map((item, itemIndex) => renderMenubarEntry(item, itemIndex))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ))}
    </div>
  )
}
