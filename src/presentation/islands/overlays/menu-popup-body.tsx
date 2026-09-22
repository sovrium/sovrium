/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The menu popup's BODY, factored out of the island that used to own it.
 *
 * ─── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 *
 * [internal ref] lets a design-system specimen document its OPEN state, and splits the
 * component types into two routes by one measured fact. `date-picker` and
 * `date-range-picker` are route A: their popup is already a plain inline
 * subtree (`{state.open && <DatePickerPopup/>}`), so a still drawing re-uses it
 * as it stands. A Base UI menu is route B, and the difference is not a
 * preference: `Menu.Portal` is NOT optional — `usePopoverPortalContext` throws
 * `Base UI: <Popover.Portal> is missing.`, and Menu carries the same hard
 * requirement — so the live popup body cannot be reached inline at all.
 *
 * The alternative to factoring is hand-shaping a surface that looks like a
 * menu, which is precisely the failure `[internal ref]` exists to
 * catch: it would document markup the app never emits. So the two halves a
 * drawing CAN keep — the row's own content, and the classes the popup and its
 * rows are painted with — move here, where both the live island and the still
 * specimen read them from one place.
 *
 * ─── WHAT IS SHARED, AND WHAT DELIBERATELY IS NOT ───────────────────────────
 *
 * {@link MenuItemBody} is shared verbatim: the icon, the label and the shortcut
 * are the same three spans whether a row is a `Menu.Item` or a still one, and
 * two copies of them is how a menu's drawing and a menu's rendering drift.
 *
 * The row ELEMENT is not shared, and cannot be. The live one is `Menu.Item`,
 * which owns keyboard navigation, `data-highlighted`, typeahead and activation;
 * the still one is a plain element carrying `role="menuitem"` and the same
 * class string. Pretending one component could be both would mean either
 * shipping Base UI's behaviour into a document that has no runtime, or dropping
 * it from the menu that needs it.
 */

import { LucideGlyph } from '@/presentation/design/lucide-glyph'
import {
  computeMenuItemClasses,
  computeMenuItemToggleThumbClasses,
  computeMenuItemToggleTrackClasses,
  computeMenuPopupClasses,
  computeMenuSeparatorClasses,
} from './overlay-default-classes'
import type { MenuItem, MenuSurface } from './menu-item-types'
import type { ReactElement } from 'react'

/**
 * The label + optional shortcut body shared by every item variant — live rows
 * and drawn ones alike.
 *
 * `LucideGlyph` renders nothing when `iconNode` is absent (no icon configured,
 * or a name lucide does not know), so the icon needs no conditional here.
 */
export function MenuItemBody({ item }: { readonly item: MenuItem }): ReactElement {
  return (
    <>
      <LucideGlyph
        iconNode={item.iconNode}
        name={item.icon}
        size={16}
        aria-hidden="true"
        className="mr-2 shrink-0"
        data-testid={`menu-item-icon-${item.icon ?? ''}`}
      />
      <span className="flex-1">{item.label}</span>
      {item.shortcut && (
        <span className="text-foreground-subtle ml-4 text-sm">{item.shortcut}</span>
      )}
    </>
  )
}

/**
 * The circle inside the switch track, shared by the live toggle row and the
 * drawn one.
 *
 * It carries no state: its travel is keyed on the TRACK's `data-checked`
 * through the `group/menu-toggle` variant, which is the whole reason one class
 * recipe can serve an element Base UI writes attributes onto and an element the
 * drawing writes them onto by hand.
 */
export function MenuItemToggleThumb(): ReactElement {
  return <span className={computeMenuItemToggleThumbClasses()} />
}

/**
 * The DRAWN switch — the same two elements the live row renders, with the state
 * written as the attribute Base UI would have written.
 *
 * `aria-hidden` mirrors what `Menu.CheckboxItemIndicator` sets on itself: the
 * row already announces its state through `aria-checked`, so a second
 * announcement from the paint would be noise. It also keeps the row's
 * accessible name the label and nothing else.
 *
 * It is a `<span>` pair and never an `<input type="checkbox">`, and that is a
 * contract rather than a shortcut: `[internal ref]` fails on a real
 * form control here, because the page that draws it is read-only ([internal ref] A3).
 */
function DrawnMenuItemToggle({ checked }: { readonly checked: boolean }): ReactElement {
  return (
    <span
      aria-hidden="true"
      data-testid="menu-item-toggle"
      data-checked={checked ? '' : undefined}
      data-unchecked={checked ? undefined : ''}
      className={computeMenuItemToggleTrackClasses()}
    >
      <MenuItemToggleThumb />
    </span>
  )
}

/**
 * ONE drawn row: the menu item's own class string and body, on an element that
 * carries the role and nothing else.
 *
 * `aria-disabled` rather than `disabled`: the row is a `<div>`, so the native
 * attribute would be ignored, and a reader of a drawn menu still needs to see
 * which entry is unavailable. The class string already paints it — the ARIA
 * state is what makes the paint mean something.
 *
 * A row declaring `toggle` takes `menuitemcheckbox` and announces which way it
 * is, then appends its switch AFTER the body — the label span is already
 * `flex-1`, so that alone lands the switch flush right on the same line, which
 * is the founder's finding stated as markup. The class string is the SAME
 * recipe its plain neighbours take (`[internal ref]` compares them
 * token by token): a bespoke row here would document markup the menu never
 * emits, which is what `[internal ref]` exists to catch.
 */
function DrawnMenuItem({
  item,
  surface,
}: {
  readonly item: MenuItem
  readonly surface: MenuSurface
}): ReactElement {
  const toggled = item.toggle !== undefined
  return (
    <div
      role={toggled ? 'menuitemcheckbox' : 'menuitem'}
      aria-checked={toggled ? (item.toggle === 'checked' ? 'true' : 'false') : undefined}
      aria-disabled={item.disabled === true ? 'true' : undefined}
      className={computeMenuItemClasses({ variant: item.variant ?? 'default', surface })}
    >
      <MenuItemBody item={item} />
      {toggled && <DrawnMenuItemToggle checked={item.toggle === 'checked'} />}
    </div>
  )
}

/**
 * The popup as a STILL PICTURE of its open state — the surface, the rows, and
 * nothing that behaves.
 *
 * ─── WHAT IT WITHHOLDS, AND WHY EACH ONE ────────────────────────────────────
 *
 * No `Menu.Root`, so no runtime and no island: the drawing is inert by
 * construction rather than by a flag someone could forget. No `Menu.Portal`, so
 * nothing lands on `document.body` — which is the whole point, since the body
 * sits OUTSIDE `[data-design-app-scope]` and a portalled popup would resolve
 * the console's own design tokens rather than the operator's, documenting the
 * wrong design system. And no `modal`, which is Base UI's default for Menu and
 * which stamps `aria-hidden` on everything outside the popup — measured once on
 * the kit page, that took `[internal ref]` from 53 reachable textboxes
 * to zero.
 *
 * What it keeps is the part a reader came for: `computeMenuPopupClasses` and
 * `computeMenuItemClasses`, the same two recipes the live popup is painted
 * with. The `data-[highlighted]:` variants inside the item string are inert
 * here — nothing sets that attribute without Base UI — and they are kept rather
 * than filtered, because a class list edited for the drawing is a class list
 * that can disagree with the one that ships.
 *
 * `role="menu"` wraps the rows so the `menuitem` children are valid ARIA rather
 * than orphans; it announces a menu, which is exactly what is drawn.
 */
export function MenuPopupBody({
  menuItems,
  surface = 'default',
}: {
  readonly menuItems: readonly MenuItem[]
  readonly surface?: MenuSurface
}): ReactElement {
  return (
    <div
      role="menu"
      data-specimen-open="true"
      className={computeMenuPopupClasses({ variant: surface })}
    >
      {menuItems.map((item, index) =>
        item.separator === true ? (
          <div
            key={`sep-${String(index)}`}
            role="separator"
            className={computeMenuSeparatorClasses()}
          />
        ) : (
          <DrawnMenuItem
            key={`item-${String(index)}`}
            item={item}
            surface={surface}
          />
        )
      )}
    </div>
  )
}
