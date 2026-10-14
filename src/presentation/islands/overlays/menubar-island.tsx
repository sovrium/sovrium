/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { Menubar } from '@base-ui/react/menubar'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  computeMenuItemClasses,
  computeMenuPopupClasses,
  computeMenuSeparatorClasses,
  computeMenuShortcutClasses,
  computeMenuTriggerClasses,
  computeMenubarContainerClasses,
} from './menu-default-classes'
import { MenuHeading, RadioMenuGroup } from './menu-radio-entries'
import { gatherMenuEntries } from './menu-radio-runs'
import { MenuKindProvider } from './menu-slot-context'
import { ToggleMenuItem } from './menu-toggle-item'
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
  /** Consecutive rows sharing it are radio items of one group (the shared rows draw them). */
  readonly radioGroup?: string
  /** The row is a group heading. */
  readonly heading?: boolean
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
/** A group's rows, its radio runs gathered into radio groups. */
function renderMenubarEntries(items: readonly MenuItem[]): readonly ReactElement[] {
  return gatherMenuEntries(items).map((entry) =>
    entry.kind === 'radio' ? (
      <RadioMenuGroup
        key={`radio-${entry.group}-${String(entry.rows[0]?.index)}`}
        rows={entry.rows}
        surface="default"
      />
    ) : (
      renderMenubarEntry(entry.item, entry.index)
    )
  )
}

function renderMenubarEntry(item: MenuItem, index: number): ReactElement {
  if (item.separator) {
    return (
      <Menu.Separator
        key={`sep-${index}`}
        data-slot="menubar-separator"
        className={computeMenuSeparatorClasses()}
      />
    )
  }
  if (item.heading === true) {
    return <MenuHeading key={`heading-${index}`}>{item.label}</MenuHeading>
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
      data-slot="menubar-item"
      data-variant={item.variant ?? 'default'}
      disabled={item.disabled}
      className={computeMenuItemClasses({ variant: item.variant ?? 'default' })}
    >
      <span className="flex-1">{item.label}</span>
      {item.shortcut && (
        <span
          data-slot="menubar-shortcut"
          className={computeMenuShortcutClasses()}
        >
          {item.shortcut}
        </span>
      )}
    </Menu.Item>
  )
}

/**
 * Menubar island — renders a horizontal menu bar with dropdown menus.
 *
 * Each top-level label opens a dropdown with items, shortcuts, and separators.
 * Built on Base UI's `Menubar`, which coordinates the menus it holds: roving
 * focus across the triggers, ArrowLeft / ArrowRight between them (wrapping),
 * and an open menu handing over to its neighbour on the same keys.
 */
export default function MenubarIsland({
  menus = [],
  className,
  id,
  'data-testid': testId,
}: MenubarIslandProps): ReactElement {
  return (
    <Menubar
      data-slot="menubar"
      className={resolveClasses(computeMenubarContainerClasses(), className)}
      id={id}
      data-testid={testId}
    >
      {menus.map((menu, menuIndex) => (
        <Menu.Root key={`menu-${menuIndex}`}>
          <Menu.Trigger
            data-slot="menubar-trigger"
            className={computeMenuTriggerClasses()}
          >
            {menu.label}
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner
              side="bottom"
              align="start"
              sideOffset={8}
              alignOffset={-4}
              className="isolate z-50 outline-none"
            >
              <Menu.Popup
                data-slot="menubar-content"
                className={computeMenuPopupClasses({ kind: 'menubar' })}
              >
                <MenuKindProvider value="menubar">
                  {renderMenubarEntries(menu.items)}
                </MenuKindProvider>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ))}
    </Menubar>
  )
}
