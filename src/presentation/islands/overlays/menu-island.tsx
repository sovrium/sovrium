/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import { useCallback, type ReactElement, type ReactNode } from 'react'
import { authClient } from '@/presentation/islands/shared/auth-client'
import { cn } from '@/presentation/utils/design/class-merge'
import { resolveLucideIcon } from '@/presentation/utils/lucide-resolver'
import { NavChevronDown } from '@/presentation/utils/recipes/nav-menu-parts'
import {
  computeMenuItemClasses,
  computeMenuPopupClasses,
  computeMenuSeparatorClasses,
} from './overlay-default-classes'

/** Popup tone axis (`popupVariant` schema field) — mirrors `MenuSurface`. */
type MenuSurface = 'default' | 'inverted'

/**
 * A menu item's config `action` (a subset of the shared `ActionSchema`). The
 * dropdown-menu wires the two operate-affordances an operator menu needs:
 * `navigate` (a link item) and `auth` `method: logout` (sign out). Other action
 * types parse but are inert here (the item still renders).
 */
interface MenuItemAction {
  readonly type?: string
  readonly method?: string
  readonly path?: string
  readonly onSuccess?: { readonly navigate?: string }
}

interface MenuItem {
  readonly label?: string
  readonly icon?: string
  readonly shortcut?: string
  readonly disabled?: boolean
  readonly separator?: boolean
  readonly variant?: 'default' | 'destructive'
  /** Action triggered when the item is activated (navigate / auth logout). */
  readonly action?: MenuItemAction
}

interface MenuIslandProps {
  readonly menuItems?: readonly MenuItem[]
  readonly floatingSide?: 'top' | 'right' | 'bottom' | 'left'
  readonly floatingAlign?: 'start' | 'center' | 'end'
  readonly triggerHtml?: string
  readonly triggerLabel?: string
  /**
   * Composed-trigger content (React node). When provided, it replaces
   * `triggerLabel` / `triggerHtml` as the trigger button's content — used when a
   * surface composes the menu inline with a rich trigger (e.g. the admin operator
   * identity bar). Not serializable, so only the React-composed path uses it.
   */
  readonly triggerContent?: ReactNode
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

/** Render a Lucide icon for a menu item, or nothing if no icon is configured. */
function MenuItemIcon({ icon }: { readonly icon?: string }): ReactElement | null {
  const Icon = resolveLucideIcon(icon)
  if (!Icon) {
    // eslint-disable-next-line unicorn/no-null -- React conditional needs null, not undefined
    return null
  }
  return (
    <Icon
      size={16}
      aria-hidden="true"
      className="mr-2 shrink-0"
      data-testid={`menu-item-icon-${icon}`}
    />
  )
}

/** The label + optional shortcut body shared by every item variant. */
function MenuItemBody({ item }: { readonly item: MenuItem }): ReactElement {
  return (
    <>
      <MenuItemIcon icon={item.icon} />
      <span className="flex-1">{item.label}</span>
      {item.shortcut && (
        <span className="text-foreground-subtle ml-4 text-xs">{item.shortcut}</span>
      )}
    </>
  )
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

/** Render a single menu entry, dispatching on separator / action / plain item. */
function renderMenuEntry(item: MenuItem, index: number, surface: MenuSurface): ReactElement {
  if (item.separator) {
    return (
      <Menu.Separator
        key={`sep-${index}`}
        className={computeMenuSeparatorClasses()}
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

/**
 * The trigger button content: composed node, raw HTML, or plain label.
 *
 * The label path adds a down-chevron affordance,
 * scoped to `triggerLabel !== undefined` — a `dropdown-menu` always carries a
 * `triggerLabel`, while the shared `context-menu` / rich-trigger
 * (`triggerContent` / `triggerHtml`) paths do NOT, so they keep no chevron.
 */
function TriggerContent({
  triggerContent,
  triggerHtml,
  triggerLabel,
}: {
  readonly triggerContent?: ReactNode
  readonly triggerHtml?: string
  readonly triggerLabel?: string
}): ReactNode {
  if (triggerContent !== undefined) return triggerContent
  if (triggerHtml) {
    // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- preserves SSR trigger HTML on initial paint
    return <span dangerouslySetInnerHTML={{ __html: triggerHtml }} />
  }
  return (
    <>
      <span>{triggerLabel ?? 'Menu'}</span>
      {triggerLabel !== undefined && <NavChevronDown />}
    </>
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
  menuItems = [],
  floatingSide = 'bottom',
  floatingAlign = 'start',
  triggerHtml,
  triggerLabel,
  triggerContent,
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
  return (
    <div data-component-type="dropdown-menu">
      <Menu.Root>
        <Menu.Trigger
          className={cn('group', triggerClassName ?? className)}
          aria-label={triggerAriaLabel}
          id={id}
          data-testid={testId}
          openOnHover={hoverEnabled}
          closeDelay={hoverEnabled ? 150 : undefined}
        >
          <TriggerContent
            triggerContent={triggerContent}
            triggerHtml={triggerHtml}
            triggerLabel={triggerLabel}
          />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            side={floatingSide}
            align={floatingAlign}
            sideOffset={4}
            // Lift the Positioner above a `sticky z-40` header (z-50 > z-40): its
            // Floating-UI `transform` forms a stacking context that would
            // otherwise trap the popup's own `z-50` below the header
            //.
            className="z-50"
          >
            <Menu.Popup className={computeMenuPopupClasses({ variant: popupVariant })}>
              {menuItems.map((item, index) => renderMenuEntry(item, index, popupVariant))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  )
}
