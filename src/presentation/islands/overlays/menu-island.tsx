/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { useRef, type ReactElement } from 'react'
import { MenuPanel } from './menu-panel'
import { MenuTriggerButton } from './menu-trigger-content'
import { useSessionBoundTrigger } from './use-session-bound-trigger'
import type { MenuIslandProps } from './menu-island-props'
import type { MenuItem } from './menu-item-types'

/** An empty item list, hoisted so a menu with no items re-renders nothing. */
const NO_MENU_ITEMS: readonly MenuItem[] = []

/**
 * Menu island — wraps Base UI Menu for the config `dropdown-menu` component.
 *
 * Provides a contextual menu with keyboard navigation (arrow keys), item icons,
 * keyboard-shortcut hints, separators, destructive variants, and config
 * `action` wiring (`navigate` link items, `auth` `logout`, and `toast` /
 * `automation` / `fetch` items run on pick). The component's
 * type is named on its SSR host, which this island mounts into, so
 * the root names nothing. The pointer-anchored `context-menu` is its own island
 * (`context-menu-island.tsx`); both draw their panel with `MenuPanel`.
 *
 * Hover-to-open is scoped to label-trigger mode, and `closeDelay` (~150ms)
 * keeps the popup open while the pointer travels from the trigger into the
 * panel (Base UI's default 0 snaps it shut). The `group` marker drives the
 * chevron's rotate-on-open. `host` is where the menu sits on the page — the
 * popup is portaled out of it — so an item's `close` finds the overlay around it.
 */
export default function MenuIsland({
  menuItems = NO_MENU_ITEMS,
  floatingSide = 'bottom',
  floatingAlign = 'start',
  footerContent,
  popupVariant = 'default',
  openOnHover,
  menuKind,
  ...triggerProps
}: MenuIslandProps): ReactElement {
  const hoverEnabled = triggerProps.triggerLabel !== undefined && openOnHover === true
  useSessionBoundTrigger()
  const host = useRef<HTMLDivElement | null>(null)
  return (
    <div ref={host}>
      <Menu.Root>
        <MenuTriggerButton
          {...triggerProps}
          menuKind={menuKind}
          hoverEnabled={hoverEnabled}
        />
        <MenuPanel
          menuItems={menuItems}
          floatingSide={floatingSide}
          floatingAlign={floatingAlign}
          popupVariant={popupVariant}
          footerContent={footerContent}
          host={host}
          kind={menuKind ?? 'dropdown-menu'}
        />
      </Menu.Root>
    </div>
  )
}
