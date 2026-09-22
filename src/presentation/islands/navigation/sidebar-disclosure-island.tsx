/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { LucideGlyph } from '@/presentation/design/lucide-glyph'
import {
  computeSidebarDisclosureListClasses,
  computeSidebarDisclosureStateClasses,
  computeSidebarDisclosureToggleClasses,
  computeSidebarSubEntryClasses,
} from '@/presentation/design/sidebar-default-classes'
import { ChildBadge, Chevron, ToggleRow } from './sidebar-disclosure-parts'
import { useSidebarDisclosure, type FetchState } from './use-sidebar-disclosure'
import type {
  DisclosureSource,
  LeafItem,
  SidebarDisclosureIslandProps,
  SubItem,
} from './sidebar-disclosure-props'
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
 * Every class below comes from `utils/recipes/sidebar-default-classes` — the
 * same module the server-rendered half calls. It sits in `presentation-util`
 * because `eslint-plugin-boundaries` forbids an island from reaching
 * `presentation-component`, which is why these strings used to be a hand-copy
 * kept in step by a comment. They are not a hand-copy any more.
 */

const TOGGLE_CLASS = computeSidebarDisclosureToggleClasses()

const LIST_CLASS = computeSidebarDisclosureListClasses()

const STATE_CLASS = computeSidebarDisclosureStateClasses()

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
      onClick={onToggle}
      type="button"
    >
      <Chevron expanded={expanded} />
    </button>
  )
}

/** One authored row, with the icon geometry the server resolved for it. */
function AuthoredChild({
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
      {...(isCurrent ? { 'aria-current': 'page' as const } : {})}
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
      className={LIST_CLASS}
      {...(item.childrenProps ?? {})}
    >
      {subItems.map((leaf) => (
        <li key={leaf.href}>
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
  if (status !== 'ready') return <li className={STATE_CLASS}>{source?.loadingLabel}</li>
  if (entries.length === 0) return <li className={STATE_CLASS}>{source?.emptyLabel}</li>
  return (
    <>
      {entries.map((entry) => {
        const current = isCurrent(entry)
        return (
          <li key={entry.href}>
            {/* Authored bag first, so the renderer-owned attributes written
                after it cannot be displaced — the ordering both other entry
                renderers use. */}
            <a
              {...(entry.props ?? {})}
              href={entry.href}
              className={computeSidebarSubEntryClasses(current)}
              {...(current ? { 'aria-current': 'page' as const } : {})}
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
          className={LIST_CLASS}
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
            subItems.map((item) => (
              <li key={item.href}>
                <AuthoredChild
                  isCurrent={isChildCurrent(item)}
                  item={item}
                  rail={rail}
                />
                <NestedList
                  isCurrent={isChildCurrent}
                  item={item}
                  rail={rail}
                />
              </li>
            ))
          )}
        </ul>
      )}
    </>
  )
}
