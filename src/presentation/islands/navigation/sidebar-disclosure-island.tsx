/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeSidebarSubEntryClasses } from '@/presentation/design/sidebar-default-classes'
import {
  computeSidebarMenuSkeletonClasses,
  computeSidebarMenuSkeletonTextClasses,
} from '@/presentation/design/sidebar-shell-classes'
import { AuthoredChildren } from './sidebar-disclosure-authored'
import {
  TOGGLE_CLASS,
  STATE_CLASS,
  SUB_ITEM,
  SUB_LIST,
  subButtonAttributes,
} from './sidebar-disclosure-classes'
import { Chevron, ToggleRow } from './sidebar-disclosure-parts'
import { useSidebarDisclosure, type FetchState } from './use-sidebar-disclosure'
import type { DisclosureSource, SidebarDisclosureIslandProps } from './sidebar-disclosure-props'
import type { ProjectedEntry } from './sidebar-entry-projection'

/**
 * The interactive half of an expandable sidebar entry: the toggle, and the list
 * it governs.
 *
 * ONLY that half. The entry's own link is server-rendered beside this host and
 * stays there — icon inline, badge island intact — so the destination never
 * waits on a chunk. The host carries `display: contents`, which is what lets the
 * button and the list rendered here take their places in the row's grid as
 * though no wrapper existed.
 *
 * A fetched list is requested on FIRST expand and never again: a sidebar of ten
 * disclosures must not cost ten requests to a reader who opens none, and
 * re-opening one is not a reason to ask the server a second time.
 *
 * Every class comes from `design/sidebar-default-classes` — the same module
 * the server-rendered half calls — through `sidebar-disclosure-classes.ts`.
 */

/** The toggle: a small target beside the link, never a wrapper around it. */
function DisclosureToggle({
  expanded,
  label,
  listId,
  name,
  onToggle,
}: {
  readonly expanded: boolean
  readonly label: string
  readonly listId: string
  readonly name: string
  readonly onToggle: () => void
}) {
  return (
    <button
      aria-controls={listId}
      aria-expanded={expanded}
      aria-label={name.replaceAll('{label}', label)}
      className={TOGGLE_CLASS}
      data-slot="sidebar-menu-action"
      onClick={onToggle}
      type="button"
    >
      <Chevron expanded={expanded} />
    </button>
  )
}

/** shadcn/ui `SidebarMenuSkeleton`: three placeholder rows while the list loads. */
function MenuSkeleton() {
  return (
    <>
      {SKELETON_ROWS.map((width) => (
        <li
          key={width}
          data-sidebar="menu-skeleton"
          data-slot="sidebar-menu-skeleton"
          aria-hidden="true"
          className={computeSidebarMenuSkeletonClasses()}
        >
          <span className={`${computeSidebarMenuSkeletonTextClasses()} ${width}`} />
        </li>
      ))}
    </>
  )
}

/** The placeholder bars' widths, varied as shadcn's random widths vary them. */
const SKELETON_ROWS = ['max-w-[70%]', 'max-w-[55%]', 'max-w-[85%]'] as const

/**
 * The fetched list, or the ONE line saying which of its three states it is in.
 *
 * A group's fetched entries may fail in silence — nobody asked for them. A
 * disclosure the reader has just clicked open may not: silence after a click
 * reads as a broken control, which is why an error is distinguishable here from
 * an empty list, and both from a list still arriving.
 */
function FetchedChildren({
  status,
  entries,
  source,
  isCurrent,
  rail,
}: {
  readonly status: FetchState
  readonly entries: readonly ProjectedEntry[]
  readonly source: DisclosureSource | undefined
  readonly isCurrent: (entry: ProjectedEntry) => boolean
  readonly rail: boolean | undefined
}) {
  if (status === 'error') return <li className={STATE_CLASS}>{source?.errorLabel}</li>
  if (status !== 'ready')
    return source?.loading === 'skeleton' ? (
      <MenuSkeleton />
    ) : (
      <li className={STATE_CLASS}>{source?.loadingLabel}</li>
    )
  if (entries.length === 0) return <li className={STATE_CLASS}>{source?.emptyLabel}</li>
  return (
    <>
      {entries.map((entry) => {
        const current = isCurrent(entry)
        return (
          <li
            key={entry.href}
            {...SUB_ITEM}
          >
            {/* Authored bag first, so the renderer-owned attributes written
                after it cannot be displaced — the ordering both other entry
                renderers use. */}
            <a
              {...(entry.props ?? {})}
              href={entry.href}
              className={computeSidebarSubEntryClasses(current)}
              {...subButtonAttributes(current)}
              {...(rail !== true || entry.props?.['title'] !== undefined
                ? {}
                : { title: entry.label })}
            >
              <span>{entry.label}</span>
            </a>
          </li>
        )
      })}
    </>
  )
}

export default function SidebarDisclosureIsland(props: SidebarDisclosureIslandProps) {
  const { listId, label, subItems, childrenProps, source, rail } = props
  const { expanded, status, entries, onToggle, isChildCurrent, isEntryCurrent } =
    useSidebarDisclosure(props)

  return (
    <>
      {/* No destination means the WHOLE row is the control, so this island
          draws it rather than a chevron beside an anchor it does not own. */}
      {props.href === undefined ? (
        <ToggleRow
          expanded={expanded}
          onToggle={onToggle}
          props={props}
        />
      ) : (
        <DisclosureToggle
          expanded={expanded}
          label={label}
          listId={listId}
          name={expanded ? props.collapseLabel : props.expandLabel}
          onToggle={onToggle}
        />
      )}
      {expanded && (
        <ul
          {...SUB_LIST}
          id={listId}
          {...(childrenProps ?? {})}
        >
          {subItems === undefined ? (
            <FetchedChildren
              entries={entries}
              isCurrent={isEntryCurrent}
              rail={rail}
              source={source}
              status={status}
            />
          ) : (
            <AuthoredChildren
              isCurrent={isChildCurrent}
              items={subItems}
              rail={rail}
            />
          )}
        </ul>
      )}
    </>
  )
}
