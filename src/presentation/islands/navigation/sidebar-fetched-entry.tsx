/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy, Suspense } from 'react'
import {
  computeSidebarEntryClasses,
  computeSidebarMenuItemClasses,
} from '@/presentation/design/sidebar-default-classes'
import { computeSidebarEntryBadgeClasses } from '@/presentation/design/sidebar-menu-default-classes'
import { FetchedEntryIcon } from './sidebar-fetched-icon'
import type { ProjectedEntry } from './sidebar-entry-projection'
import type { ChildrenSource } from './sidebar-fetched-children'

/**
 * The row with its own fetched children, loaded only by a group whose source
 * declares `childrenSource`: a group of plain links never pays for it. The
 * disclosure it draws is requested in the same breath, so the toggle waits on
 * one round trip, not two in a row.
 */
const FetchedChildren = lazy(() =>
  Promise.all([import('./sidebar-fetched-children'), import('./sidebar-disclosure-island')]).then(
    ([children]) => children
  )
)

interface FetchedEntryProps {
  readonly entry: ProjectedEntry
  readonly current: boolean
  readonly rail: boolean | undefined
  readonly track: boolean | undefined
  /** The list id this entry's disclosure governs, unique on the page. */
  readonly listId: string
  readonly childrenSource: ChildrenSource | undefined
}

/**
 * One fetched entry of a group: a link, or — when the group's source declares
 * `childrenSource` — a link with a toggle beside it whose list is fetched on
 * first expand (`sidebar-fetched-children`). The plain link shows until that
 * chunk arrives.
 */
export function FetchedEntry(props: FetchedEntryProps) {
  const { entry, current, rail, childrenSource } = props
  // The row's link: the entry's own page, marked when it is the current one.
  const link = (
    <a
      {...(entry.props ?? {})}
      href={entry.href}
      data-slot="sidebar-menu-button"
      data-size="default"
      {...(current ? { 'aria-current': 'page', 'data-active': '' } : {})}
      className={computeSidebarEntryClasses(current)}
      {...(rail !== true || entry.props?.['title'] !== undefined ? {} : { title: entry.label })}
    >
      <FetchedEntryIcon icon={entry.icon} />
      <span>{entry.label}</span>
      {entry.badge !== undefined && (
        // Outside the accessible name, as an authored entry's badge is
        // (`renderBadge`): a count must not rename the link.
        <span
          aria-hidden="true"
          data-slot="sidebar-menu-badge"
          data-component-type="badge"
          className={computeSidebarEntryBadgeClasses()}
        >
          {entry.badge}
        </span>
      )}
    </a>
  )
  return (
    <li
      data-slot="sidebar-menu-item"
      className={computeSidebarMenuItemClasses()}
    >
      {childrenSource === undefined ? (
        link
      ) : (
        <Suspense fallback={link}>
          <FetchedChildren
            {...props}
            link={link}
            childrenSource={childrenSource}
          />
        </Suspense>
      )}
    </li>
  )
}
