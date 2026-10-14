/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import {
  computeMenuItemClasses,
  computeMenuLabelClasses,
  computeMenuRadioIndicatorClasses,
} from './menu-default-classes'
import { MenuItemBody } from './menu-popup-body'
import { useMenuKind } from './menu-slot-context'
import type { MenuItem, MenuSurface } from './menu-item-types'
import type { ReactElement, ReactNode } from 'react'

/**
 * Radio rows and group headings, shared by the dropdown / context menu island
 * and the menubar island so the two draw the same rows from the same keys.
 *
 * A run of CONSECUTIVE rows naming the same `radioGroup` is one Base UI
 * `Menu.RadioGroup`: its rows are `menuitemradio`, the one whose `toggle` is
 * `checked` starts checked, and choosing another moves the check, keeping the
 * menu open as a toggle row does. Like a toggle, the state is a starting
 * position held in the reader's browser, never written back. A `heading` row
 * is a group label: not a menu item, passed over by the keyboard.
 */

/** The value of a radio row: its label, else its position. */
const valueOf = (item: MenuItem, index: number): string => item.label ?? String(index)

/** One `radioGroup` run as a Base UI radio group. */
export function RadioMenuGroup({
  rows,
  surface,
}: {
  readonly rows: readonly { readonly item: MenuItem; readonly index: number }[]
  readonly surface: MenuSurface
}): ReactElement {
  const kind = useMenuKind()
  const checked = rows.find(({ item }) => item.toggle === 'checked')
  return (
    <Menu.RadioGroup
      defaultValue={checked === undefined ? undefined : valueOf(checked.item, checked.index)}
    >
      {rows.map(({ item, index }) => (
        <Menu.RadioItem
          key={`radio-${String(index)}`}
          value={valueOf(item, index)}
          closeOnClick={false}
          data-slot={`${kind}-radio-item`}
          disabled={item.disabled}
          className={`${computeMenuItemClasses({ variant: 'default', surface })} pr-8`}
        >
          <MenuItemBody item={item} />
          <span
            data-slot={`${kind}-radio-item-indicator`}
            className={computeMenuRadioIndicatorClasses()}
          >
            <Menu.RadioItemIndicator>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </Menu.RadioItemIndicator>
          </span>
        </Menu.RadioItem>
      ))}
    </Menu.RadioGroup>
  )
}

/** A `heading` row: a group label, not a menu item. */
export function MenuHeading({ children }: { readonly children: ReactNode }): ReactElement {
  const kind = useMenuKind()
  return (
    <Menu.Group>
      <Menu.GroupLabel
        data-slot={`${kind}-label`}
        className={computeMenuLabelClasses()}
      >
        {children}
      </Menu.GroupLabel>
    </Menu.Group>
  )
}
