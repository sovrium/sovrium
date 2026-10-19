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

/**
 * The value of a radio row: the theme a `theme` row sets, else its label, else
 * its position.
 */
const valueOf = (item: MenuItem, index: number): string =>
  item.action?.type === 'theme' ? (item.action.value ?? 'system') : (item.label ?? String(index))

/**
 * The reader's current theme, read when the menu opens: what is stored under
 * `localStorage.theme` — the key the `theme-toggle` writes and the head script
 * reads — else `system`.
 */
const readStoredTheme = (): string => {
  try {
    const stored = window.localStorage.getItem('theme')
    return stored === 'dark' || stored === 'light' ? stored : 'system'
  } catch {
    return 'system'
  }
}

type RadioRows = readonly { readonly item: MenuItem; readonly index: number }[]

/**
 * Where the group starts: the reader's current theme for a run of `theme` rows,
 * else the row whose `toggle` is `checked`.
 */
const initialValueOf = (rows: RadioRows): string | undefined => {
  if (rows.every(({ item }) => item.action?.type === 'theme')) return readStoredTheme()
  const checked = rows.find(({ item }) => item.toggle === 'checked')
  return checked === undefined ? undefined : valueOf(checked.item, checked.index)
}

/**
 * One `radioGroup` run as a Base UI radio group.
 *
 * A `theme` row carries `data-theme-set`: choosing it is applied by the page's
 * one delegated theme runtime, the same that flips a `theme-toggle`, so the two
 * controls cannot come to store or apply a choice differently.
 */
export function RadioMenuGroup({
  rows,
  surface,
}: {
  readonly rows: RadioRows
  readonly surface: MenuSurface
}): ReactElement {
  const kind = useMenuKind()
  return (
    <Menu.RadioGroup defaultValue={initialValueOf(rows)}>
      {rows.map(({ item, index }) => (
        <Menu.RadioItem
          key={`radio-${String(index)}`}
          value={valueOf(item, index)}
          closeOnClick={false}
          {...(item.action?.type === 'theme' ? { 'data-theme-set': valueOf(item, index) } : {})}
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
