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
  /** Action triggered when the item is activated (navigate / auth logout). */
  readonly action?: MenuItemAction
}
