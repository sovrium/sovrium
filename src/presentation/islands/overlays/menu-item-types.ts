/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What ONE row of a menu IS — types only, no rendering.
 *
 * Split out of `menu-island.tsx` so that island file stays under the per-island
 * `max-lines` cap, which it crossed when
 * `dropdown-menu` became a container type and grew a composed trigger.
 */

/** Popup tone axis (`popupVariant` schema field) — mirrors `MenuSurface`. */
export type MenuSurface = 'default' | 'inverted'

/** The toast an automation's `onSuccess` / `onError` slot declares. */
interface MenuActionOutcome {
  readonly navigate?: string
  readonly toast?: { readonly message?: string; readonly variant?: string }
}

/**
 * A menu item's config `action` (a subset of the shared `ActionSchema`). Every
 * type the menu runs is honoured: `navigate` draws the row as a link, `auth`
 * `method: logout` signs out, and `toast`, `automation` and `fetch` run when the
 * row is picked (`menu-item-actions.ts`), as they would from a button.
 */
export interface MenuItemAction {
  readonly type?: string
  readonly method?: string
  readonly path?: string
  /** `toast`: the message, its variant and how long it stays. */
  readonly message?: string
  readonly variant?: string
  readonly duration?: number
  /** `automation`: the automation pressed, its input, and whether to await the run. */
  readonly name?: string
  readonly inputData?: Readonly<Record<string, unknown>>
  readonly await?: boolean
  readonly onSuccess?: MenuActionOutcome
  readonly onError?: MenuActionOutcome
}

export interface MenuItem {
  readonly label?: string
  readonly icon?: string
  /**
   * Server-resolved geometry for {@link MenuItem.icon}, produced by
   * `buildDropdownMenuProps` and serialized into `data-island-props`. It is what
   * lets the island draw a config-named icon WITHOUT bundling lucide's ~2,000
   * icon set — see `@/presentation/utils/lucide-glyph`. Absent on the
   * React-composed path (`admin-operator-menu`), which passes no icons.
   */
  readonly iconNode?: unknown
  readonly shortcut?: string
  readonly disabled?: boolean
  readonly separator?: boolean
  readonly variant?: 'default' | 'destructive'
  /**
   * Makes this row a TOGGLE, starting in the state it names.
   *
   * One literal key rather than a `toggle: true` + `checked: boolean` pair,
   * because a menu item has no `type` of its own: which kind of row it is comes
   * from which keys are present, so the key that selects the kind has to carry
   * the state too (see `shared-schemas.ts`).
   *
   * The value is where the switch STARTS, not a binding — the state lives in
   * the reader's browser and nothing is written when they flip it,
   * which is why the live row is UNCONTROLLED (`defaultChecked`).
   */
  readonly toggle?: 'checked' | 'unchecked'
  /** Action triggered when the item is activated. */
  readonly action?: MenuItemAction
}
