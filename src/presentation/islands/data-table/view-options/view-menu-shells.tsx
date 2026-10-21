/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { type ReactElement, type ReactNode } from 'react'
import { computeTablePagerButtonClasses } from '@/presentation/design/table-default-classes'
import {
  computeMenuItemClasses,
  computeMenuPopupClasses,
} from '../../overlays/menu-default-classes'

/**
 * The frames the reader's view options are drawn in. Each option menu (Group
 * by, Hide fields, Row height) is written once and handed the frame it sits in:
 * a menu of its own beside the pager, or a submenu of the one `View` menu that
 * gathers the three — in the toolbar, and in the bottom bar of a phone, where
 * three buttons beside the pager wrap it onto a second line.
 */

/** A frame one option menu is drawn in: a trigger named `label`, and its items. */
export type MenuShell = (props: {
  readonly label: string
  readonly children: ReactNode
}) => ReactElement

const TRIGGER = computeTablePagerButtonClasses({ variant: 'ghost' })
const POSITIONER = 'isolate z-50 outline-none'

/** A popup's frame, opening on `side` of its trigger. */
function MenuPopup({
  side,
  label,
  children,
}: {
  readonly side: 'top' | 'bottom' | 'right'
  readonly label?: string
  readonly children: ReactNode
}): ReactElement {
  return (
    <Menu.Portal>
      <Menu.Positioner
        side={side}
        align={side === 'right' ? 'start' : 'end'}
        sideOffset={4}
        positionMethod="fixed"
        className={POSITIONER}
      >
        <Menu.Popup
          data-slot={side === 'right' ? 'dropdown-menu-sub-content' : 'dropdown-menu-content'}
          {...(label !== undefined && { 'aria-label': label })}
          className={computeMenuPopupClasses()}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}

/** An option menu of its own beside the pager: a ghost trigger, opening upward. */
export const BarMenu: MenuShell = ({ label, children }) => (
  <Menu.Root>
    <Menu.Trigger
      type="button"
      className={TRIGGER}
    >
      {label}
    </Menu.Trigger>
    <MenuPopup side="top">{children}</MenuPopup>
  </Menu.Root>
)

/** An option menu as one item of the View menu, opening its options beside it. */
export const SubMenu: MenuShell = ({ label, children }) => (
  <Menu.SubmenuRoot>
    <Menu.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={computeMenuItemClasses()}
    >
      {label}
    </Menu.SubmenuTrigger>
    <MenuPopup
      side="right"
      label={label}
    >
      {children}
    </MenuPopup>
  </Menu.SubmenuRoot>
)

/**
 * The one `View` menu, shadcn's data-table view options: a trigger named
 * `label`, whose popup — named after it — holds the option menus as submenus.
 * It opens downward from a toolbar above the rows and upward from the bottom
 * bar beneath them.
 */
export function ViewMenu({
  label,
  side,
  children,
}: {
  readonly label: string
  readonly side: 'top' | 'bottom'
  readonly children: ReactNode
}): ReactElement {
  return (
    <Menu.Root>
      <Menu.Trigger
        type="button"
        data-slot="data-table-view-options"
        className={TRIGGER}
      >
        {label}
      </Menu.Trigger>
      <MenuPopup
        side={side}
        label={label}
      >
        {children}
      </MenuPopup>
    </Menu.Root>
  )
}
