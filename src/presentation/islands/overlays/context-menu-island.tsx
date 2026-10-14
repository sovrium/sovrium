/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ContextMenu } from '@base-ui/react/context-menu'
import { useMemo, useRef, type ReactElement } from 'react'
import { computeContextMenuTriggerClasses } from '@/presentation/design/navigation-default-classes'
import { MenuPanel } from './menu-panel'
import type { MenuItem, MenuSurface } from './menu-item-types'

/** An empty item list, hoisted so a menu with no items re-renders nothing. */
const NO_MENU_ITEMS: readonly MenuItem[] = []

/** The props the `context-menu` renderer mounts this island with. */
export interface ContextMenuIslandProps {
  readonly menuItems?: readonly MenuItem[]
  /**
   * The region the menu is attached to: the author's `children`, rendered on
   * the server. It is the same markup the SSR host already painted, so
   * hydration changes nothing a reader can see.
   */
  readonly childrenHtml?: string
  readonly popupVariant?: MenuSurface
  readonly className?: string
  readonly id?: string
}

/**
 * Context menu island — shadcn/ui's Context Menu on Base UI `ContextMenu`.
 *
 * The trigger is a REGION, not a button: the author's `children` render inside
 * it, and the menu opens on a right click (or a 500 ms long press on touch)
 * anywhere over them, anchored at the pointer. A left click does nothing,
 * which is the whole difference from `dropdown-menu`.
 *
 * Base UI's context menu reuses the Menu parts below its root, so the panel is
 * the dropdown's own `MenuPanel` — the same rows, separators, toggles and
 * `action` wiring — positioned the way shadcn's `ContextMenuContent` is:
 * `side="right"`, `align="start"`, no side offset, a 4 px nudge along it.
 */
export default function ContextMenuIsland({
  menuItems = NO_MENU_ITEMS,
  childrenHtml,
  popupVariant = 'default',
  className,
  id,
}: ContextMenuIslandProps): ReactElement {
  const host = useRef<HTMLDivElement | null>(null)
  const regionHtml = useMemo(() => ({ __html: childrenHtml ?? '' }), [childrenHtml])
  return (
    <div ref={host}>
      <ContextMenu.Root>
        <ContextMenu.Trigger
          data-slot="context-menu-trigger"
          id={id}
          className={computeContextMenuTriggerClasses(className)}
          // eslint-disable-next-line sovrium/require-sanitized-html -- server-rendered markup: renderToStaticMarkup output, which escapes every text and attribute value
          dangerouslySetInnerHTML={regionHtml}
        />
        <MenuPanel
          menuItems={menuItems}
          floatingSide="right"
          floatingAlign="start"
          sideOffset={0}
          alignOffset={4}
          popupVariant={popupVariant}
          host={host}
          kind="context-menu"
        />
      </ContextMenu.Root>
    </div>
  )
}
