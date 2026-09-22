/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { useCallback, type ReactElement, type ReactNode } from 'react'
import { MENU_TRIGGER_LAYOUT_CLASSES } from '@/presentation/design/nav-menu-parts'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { authClient } from '@/presentation/islands/runtime/auth-client'
import { MenuItemBody } from './menu-popup-body'
import { ToggleMenuItem } from './menu-toggle-item'
import { TriggerContent } from './menu-trigger-content'
import {
  computeMenuItemClasses,
  computeMenuPopupClasses,
  computeMenuSeparatorClasses,
} from './overlay-default-classes'
import { useSessionBoundTrigger } from './use-session-bound-trigger'
import type { MenuItem, MenuSurface } from './menu-item-types'

interface MenuIslandProps {
  readonly menuItems?: readonly MenuItem[]
  readonly floatingSide?: 'top' | 'right' | 'bottom' | 'left'
  readonly floatingAlign?: 'start' | 'center' | 'end'
  readonly triggerHtml?: string
  readonly triggerLabel?: string
  /**
   * The trigger's COMPOSED content, serialized from the author's `children`.
   *
   * Distinct from {@link MenuIslandProps.triggerHtml}, which the shared
   * `context-menu` / rich-trigger paths use and which deliberately carries no
   * chevron: a composed `dropdown-menu` trigger is still a dropdown, so it
   * keeps the affordance that says so.
   */
  readonly triggerChildrenHtml?: string
  /**
   * The `$session.<field>` template a bound `triggerLabel` carries.
   *
   * The label itself ships EMPTY. Resolution is CLIENT-side, from the caller's
   * own session, so the served bytes name nobody and a cached page cannot leak
   * one caller to the next.
   */
  readonly triggerLabelTemplate?: string
  /**
   * Composed-trigger content (React node). When provided, it replaces
   * `triggerLabel` / `triggerHtml` as the trigger button's content — used when a
   * surface composes the menu inline with a rich trigger (e.g. the admin operator
   * identity bar). Not serializable, so only the React-composed path uses it.
   */
  readonly triggerContent?: ReactNode
  /**
   * Quiet metadata rendered inside the popup BELOW the items (React node) — for
   * a line that reports rather than acts, so it never has to masquerade as a
   * disabled menu item. Like {@link MenuIslandProps.triggerContent} it is not
   * serializable, so only the React-composed path uses it.
   */
  readonly footerContent?: ReactNode
  readonly triggerClassName?: string
  readonly triggerAriaLabel?: string
  /**
   * Popup surface tone (`popupVariant` schema field). `inverted` paints a
   * near-black primary popup with light items so the menu matches a near-black
   * primary CTA trigger.
   */
  readonly popupVariant?: MenuSurface
  /**
   * Open the trigger on pointer hover in addition to click ([internal ref],
   * [internal ref]). Scoped to label-trigger mode — the shared
   * `context-menu` / rich-trigger paths never receive it, so they keep
   * click/right-click behaviour only.
   */
  readonly openOnHover?: boolean
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/** Sign out, then return to `redirectTo` regardless of the sign-out outcome. */
async function performLogout(redirectTo: string): Promise<void> {
  try {
    await authClient.signOut()
  } finally {
    window.location.assign(redirectTo)
  }
}

/** True when a navigate path leaves the app (an absolute http(s) URL). */
function isExternalPath(path: string): boolean {
  return /^https?:\/\//i.test(path)
}

/** A plain (or inert-action) menu item — label/icon/shortcut, no behaviour. */
function PlainMenuItem({
  item,
  surface,
}: {
  readonly item: MenuItem
  readonly surface: MenuSurface
}): ReactElement {
  return (
    <Menu.Item
      disabled={item.disabled}
      className={computeMenuItemClasses({ variant: item.variant ?? 'default', surface })}
    >
      <MenuItemBody item={item} />
    </Menu.Item>
  )
}

/** A menu item that signs the operator out via the config `auth` `logout` action. */
function LogoutMenuItem({
  item,
  surface,
}: {
  readonly item: MenuItem
  readonly surface: MenuSurface
}): ReactElement {
  const redirectTo = item.action?.onSuccess?.navigate ?? '/'
  const handleClick = useCallback(() => {
    void performLogout(redirectTo)
  }, [redirectTo])
  return (
    <Menu.Item
      disabled={item.disabled}
      onClick={handleClick}
      className={computeMenuItemClasses({ variant: item.variant ?? 'default', surface })}
    >
      <MenuItemBody item={item} />
    </Menu.Item>
  )
}

/**
 * A `navigate` menu item — Base UI renders the whole row as the anchor so
 * keyboard activation follows the href (external links open a new tab).
 */
function NavigateMenuItem({
  item,
  surface,
}: {
  readonly item: MenuItem
  readonly surface: MenuSurface
}): ReactElement {
  const path = item.action?.path ?? '#'
  const external = isExternalPath(path)
  const anchor = external ? (
    <a
      href={path}
      target="_blank"
      rel="noopener noreferrer"
    />
  ) : (
    <a href={path} />
  )
  return (
    <Menu.Item
      disabled={item.disabled}
      render={anchor}
      className={computeMenuItemClasses({ variant: item.variant ?? 'default', surface })}
    >
      <MenuItemBody item={item} />
    </Menu.Item>
  )
}

/** Render a single menu entry, dispatching on separator / toggle / action / plain item. */
function renderMenuEntry(item: MenuItem, index: number, surface: MenuSurface): ReactElement {
  if (item.separator) {
    return (
      <Menu.Separator
        key={`sep-${index}`}
        className={computeMenuSeparatorClasses()}
      />
    )
  }
  // BEFORE the action branches, deliberately: a row that declares `toggle` is a
  // toggle whatever else it carries. The two action branches below both change
  // what the row IS — `navigate` renders it as an anchor — and a checkbox item
  // that walks away from the page on every flip is not a toggle. An `action`
  // alongside `toggle` is therefore inert, which is the same precedence
  // `separator` already has over `label`, `icon` and `action`.
  if (item.toggle !== undefined) {
    return (
      <ToggleMenuItem
        key={`item-${index}`}
        item={item}
        surface={surface}
      />
    )
  }
  const { action } = item
  if (action?.type === 'auth' && action.method === 'logout') {
    return (
      <LogoutMenuItem
        key={`item-${index}`}
        item={item}
        surface={surface}
      />
    )
  }
  if (action?.type === 'navigate') {
    return (
      <NavigateMenuItem
        key={`item-${index}`}
        item={item}
        surface={surface}
      />
    )
  }
  return (
    <PlainMenuItem
      key={`item-${index}`}
      item={item}
      surface={surface}
    />
  )
}

/** An empty item list, hoisted so a menu with no items re-renders nothing. */
const NO_MENU_ITEMS: readonly MenuItem[] = []

/** The floating panel: the items, plus whatever quiet line sits under them. */
function MenuPanel({
  menuItems,
  floatingSide,
  floatingAlign,
  popupVariant,
  footerContent,
}: {
  readonly menuItems: readonly MenuItem[]
  readonly floatingSide: 'top' | 'right' | 'bottom' | 'left'
  readonly floatingAlign: 'start' | 'center' | 'end'
  readonly popupVariant: MenuSurface
  readonly footerContent?: ReactNode
}): ReactElement {
  return (
    <Menu.Portal>
      <Menu.Positioner
        side={floatingSide}
        align={floatingAlign}
        sideOffset={4}
        // Lift the Positioner above a `sticky z-40` header (z-50 > z-40): its
        // Floating-UI `transform` forms a stacking context that would otherwise
        // trap the popup's own `z-50` below the header.
        className="z-50"
      >
        <Menu.Popup className={computeMenuPopupClasses({ variant: popupVariant })}>
          {menuItems.map((item, index) => renderMenuEntry(item, index, popupVariant))}
          {footerContent}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}

/**
 * Menu island — wraps Base UI Menu for the config `dropdown-menu` component.
 *
 * Provides a contextual menu with keyboard navigation (arrow keys), item icons,
 * keyboard-shortcut hints, separators, destructive variants, and config
 * `action` wiring (`navigate` link items + `auth` `logout`). The root carries
 * `data-component-type="dropdown-menu"` so the rendered menu is recognisable as
 * the config component regardless of whether it is hydrated from an SSR host or
 * composed inline (e.g. the admin operator identity bar). Shared by both
 * `dropdown-menu` and `context-menu`.
 */
export default function MenuIsland({
  menuItems = NO_MENU_ITEMS,
  floatingSide = 'bottom',
  floatingAlign = 'start',
  triggerHtml,
  triggerLabel,
  triggerLabelTemplate,
  triggerChildrenHtml,
  triggerContent,
  footerContent,
  triggerClassName,
  triggerAriaLabel,
  popupVariant = 'default',
  openOnHover,
  className,
  id,
  'data-testid': testId,
}: MenuIslandProps): ReactElement {
  // [internal ref]: hover-to-open is scoped to
  // label-trigger mode. `closeDelay` (~150ms) keeps the popup open while the
  // pointer travels from the trigger into the panel (Base UI's default 0 snaps
  // it shut). The `group` marker drives the chevron's rotate-on-open (009).
  const hoverEnabled = triggerLabel !== undefined && openOnHover === true
  useSessionBoundTrigger()
  return (
    <div data-component-type="dropdown-menu">
      <Menu.Root>
        <Menu.Trigger
          className={resolveClasses(
            `group ${MENU_TRIGGER_LAYOUT_CLASSES}`,
            triggerClassName ?? className
          )}
          aria-label={triggerAriaLabel}
          id={id}
          data-testid={testId}
          openOnHover={hoverEnabled}
          closeDelay={hoverEnabled ? 150 : undefined}
        >
          <TriggerContent
            triggerContent={triggerContent}
            triggerHtml={triggerHtml}
            triggerChildrenHtml={triggerChildrenHtml}
            triggerLabel={triggerLabel}
            triggerLabelTemplate={triggerLabelTemplate}
          />
        </Menu.Trigger>
        <MenuPanel
          menuItems={menuItems}
          floatingSide={floatingSide}
          floatingAlign={floatingAlign}
          popupVariant={popupVariant}
          footerContent={footerContent}
        />
      </Menu.Root>
    </div>
  )
}
