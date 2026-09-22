/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The LIVE half of a toggle menu row — the one that behaves.
 *
 * ─── WHY THIS IS ITS OWN FILE ───────────────────────────────────────────────
 *
 * Two islands need it and neither can lend it to the other. `menu-island.tsx`
 * serves `dropdown-menu` and `context-menu`; `menubar-island.tsx` builds its
 * own `Menu.Root` per top-level group and shares no row code with it, so a
 * toggle written into one would leave the other drawing a plain row from the
 * same config key. It cannot go in `menu-popup-body.tsx` either: that module is
 * imported by the SERVER-side open-specimen renderer, and naming `Menu` there
 * would drag Base UI's menu runtime into a path whose entire purpose is to emit
 * a picture with no runtime at all.
 *
 * ─── WHAT BASE UI ALREADY DOES, AND MUST NOT BE RE-DONE ─────────────────────
 *
 * `Menu.CheckboxItem` defaults `closeOnClick` to `false`, so the menu stays
 * open across a flip with no prop passed — passing one back would be writing
 * down a default and inviting someone to "correct" it to `true`.
 *
 * `Menu.CheckboxItemIndicator` UNMOUNTS when unchecked unless `keepMounted` is
 * set. That default suits a tick, which has nothing to show in the off state; a
 * switch has to be visible in BOTH states, so `keepMounted` is load-bearing
 * here rather than decorative. Without it the off row draws no switch at all.
 *
 * The row is UNCONTROLLED — `defaultChecked`, never `checked`. [internal ref]: the
 * state lives in the reader's browser and nothing is written when they flip it,
 * so the config value is a starting position rather than a binding, and a
 * controlled row would need an owner for a value nobody persists.
 */

import { Menu } from '@base-ui/react/menu'
import { MenuItemBody, MenuItemToggleThumb } from './menu-popup-body'
import {
  computeMenuItemClasses,
  computeMenuItemToggleTrackClasses,
} from './overlay-default-classes'
import type { MenuItem, MenuSurface } from './menu-item-types'
import type { ReactElement } from 'react'

/**
 * A menu row that holds a state instead of performing an action.
 *
 * The switch goes AFTER the body: the label span inside `MenuItemBody` is
 * `flex-1`, so appending the indicator is all it takes to land it flush right
 * on the same line — no `justify-between`, and no second layout to keep in step
 * with the drawn row's.
 */
export function ToggleMenuItem({
  item,
  surface,
}: {
  readonly item: MenuItem
  readonly surface: MenuSurface
}): ReactElement {
  return (
    <Menu.CheckboxItem
      disabled={item.disabled}
      defaultChecked={item.toggle === 'checked'}
      className={computeMenuItemClasses({ variant: item.variant ?? 'default', surface })}
    >
      <MenuItemBody item={item} />
      <Menu.CheckboxItemIndicator
        keepMounted
        data-testid="menu-item-toggle"
        className={computeMenuItemToggleTrackClasses()}
      >
        <MenuItemToggleThumb />
      </Menu.CheckboxItemIndicator>
    </Menu.CheckboxItem>
  )
}
