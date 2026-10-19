/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { LucideGlyph } from '@/presentation/design/lucide-glyph'
import { computeSidebarSubEntryClasses } from '@/presentation/design/sidebar-default-classes'
import { SUB_ITEM, SUB_LIST, subButtonAttributes } from './sidebar-disclosure-classes'
import { ChildBadge } from './sidebar-disclosure-parts'
import type { LeafItem, SubItem } from './sidebar-disclosure-props'

/*
 * The AUTHORED rows of an open sidebar disclosure — the second level and its
 * always-open third level — drawn as shadcn/ui's `sidebar-menu-sub` rows. A
 * sibling of the island so the island stays one job: state and toggling.
 */

/**
 * One row of the list, with the icon geometry the server resolved for it. The
 * fetched rows are drawn by it too: a fetched entry is a leaf with neither.
 */
export function AuthoredChild({
  item,
  isCurrent,
  rail,
}: {
  readonly item: LeafItem
  readonly isCurrent: boolean
  readonly rail: boolean | undefined
}) {
  return (
    // Authored bag first, so the renderer-owned attributes written after it
    // cannot be displaced — the same ordering the SSR half uses.
    <a
      {...(item.props ?? {})}
      href={item.href}
      className={computeSidebarSubEntryClasses(isCurrent)}
      {...subButtonAttributes(isCurrent)}
      {...(rail !== true || item.props?.['title'] !== undefined ? {} : { title: item.label })}
    >
      {item.iconNode !== undefined && (
        <LucideGlyph
          iconNode={item.iconNode}
          size={16}
        />
      )}
      <span>{item.label}</span>
      <ChildBadge badge={item.badge} />
    </a>
  )
}

/**
 * A sub-entry's OWN list: the third level, always open and carrying no toggle.
 *
 * The hydrated twin of `renderNestedList` in the SSR half. It exists here
 * because the level-2 disclosure IS an island: this component re-renders the
 * whole list from its props, so a version that stopped at the leaves would
 * DELETE the third level the server drew — correct with JavaScript off and
 * broken with it on, which is the failure mode nobody looks for.
 *
 * `LIST_CLASS` is reused for the reason the server half reuses its recipe: the
 * indent is relative to its container, so nesting the same classes inside a list
 * that already carries them steps in once more, with nothing to keep in step.
 */
function NestedList({
  item,
  isCurrent,
  rail,
}: {
  readonly item: SubItem
  readonly isCurrent: (leaf: LeafItem) => boolean
  readonly rail: boolean | undefined
}) {
  const { subItems } = item
  if (subItems === undefined || subItems.length === 0) return undefined
  return (
    <ul
      {...SUB_LIST}
      {...(item.childrenProps ?? {})}
    >
      {subItems.map((leaf) => (
        <li
          key={leaf.href}
          {...SUB_ITEM}
        >
          <AuthoredChild
            isCurrent={isCurrent(leaf)}
            item={leaf}
            rail={rail}
          />
        </li>
      ))}
    </ul>
  )
}

/** The authored rows of an open list, each with its own always-open third level. */
export function AuthoredChildren({
  items,
  isCurrent,
  rail,
}: {
  readonly items: readonly SubItem[]
  readonly isCurrent: (leaf: LeafItem) => boolean
  readonly rail: boolean | undefined
}) {
  return (
    <>
      {items.map((item) => (
        <li
          key={item.href}
          {...SUB_ITEM}
        >
          <AuthoredChild
            isCurrent={isCurrent(item)}
            item={item}
            rail={rail}
          />
          <NestedList
            isCurrent={isCurrent}
            item={item}
            rail={rail}
          />
        </li>
      ))}
    </>
  )
}
