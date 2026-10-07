/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { MenuItem, MenuSurface } from './menu-item-types'
import type { ReactNode } from 'react'

/**
 * The props a menu island is mounted with, as the server renders them.
 */

export interface MenuIslandProps {
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
   * Open the trigger on pointer hover in addition to click. Scoped to
   * label-trigger mode — the shared
   * `context-menu` / rich-trigger paths never receive it, so they keep
   * click/right-click behaviour only.
   */
  readonly openOnHover?: boolean
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}
