/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cn } from '@/presentation/design/class-merge'
import { computeSidebarEntryBadgeClasses } from '@/presentation/design/sidebar-menu-default-classes'
import { CURRENT_SECTION_KEY } from '@/presentation/render/resolve/sidebar-current-resolver'
import type { SidebarGroup } from '@/domain/models/app/pages/components/component-types/layout/sidebar'
import type { ReactElement } from 'react'

/** What one collapsible group is drawn from. */
export interface CollapsibleGroupInput {
  readonly group: SidebarGroup
  /** The label, already in the reader's language. */
  readonly label: string
  /** The heading element the label is, when the group declares a `headingLevel`. */
  readonly Heading: 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | undefined
  readonly labelClasses: string
  readonly action: ReactElement | undefined
  /** The group's entries — authored list and fetched half — as the plain group draws them. */
  readonly entries: ReactElement
}

/** Whether the group holds the entry the reader is on, at any depth the server resolved. */
const holdsCurrentEntry = (group: SidebarGroup): boolean =>
  (group.items ?? []).some(
    (item) => (item as Readonly<Record<string, unknown>>)[CURRENT_SECTION_KEY] === true
  )

/** A short, stable id for the region, derived from the group's label. */
const regionIdOf = (seed: string): string => {
  const hash = [...seed].reduce(
    (acc, char) => Math.imul(acc ^ char.charCodeAt(0), 16_777_619),
    2_166_136_261
  )
  return `sv-sidebar-group-${(hash >>> 0).toString(36)}`
}

/** The chevron after the label, turned while the group is open. */
const chevron = (): ReactElement => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/sidebar-collapsible:rotate-90"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
)

const TRIGGER_CLASS =
  'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md text-left outline-hidden disabled:cursor-default'

/**
 * A collapsible group — shadcn/ui's collapsible sidebar group: a
 * `SidebarGroup` inside a `Collapsible`, its `SidebarGroupLabel` the trigger.
 *
 * ─── THE OPEN STATE IS DERIVED, NEVER STORED ───────────────────────────────
 *
 * The server opens the group holding the current entry, so "where am I" is
 * answered before any script runs. A `destructive` count arrives later, from
 * the client, and opens its group when it is non-zero (the badge island,
 * `sidebar-collapsible-count.ts`), which also writes the total into the
 * label's mirror — shown only while the group is shut, and outside the
 * button's accessible name, which stays the label.
 *
 * ─── THE REGION IS SHOWN BY STATE, SO A RAIL KEEPS ITS ICONS ───────────────
 *
 * The region is hidden by a `data-state` rule rather than the `hidden`
 * attribute: below a rail's breakpoint the navigation root forces every
 * group's region open, since a rail draws no label to press.
 *
 * The button is drawn disabled until the `collapsible` enhancement island
 * wires it, so a press before then is never lost.
 */
export function renderCollapsibleGroup({
  group,
  label,
  Heading,
  labelClasses,
  action,
  entries,
}: CollapsibleGroupInput): ReactElement {
  const open = holdsCurrentEntry(group)
  const regionId = regionIdOf(group.label ?? label)
  const LabelElement = Heading ?? 'div'
  return (
    <div
      data-slot="collapsible"
      data-sidebar-collapsible=""
      data-state={open ? 'open' : 'closed'}
      className="group/sidebar-collapsible"
    >
      <LabelElement
        data-slot="sidebar-group-label"
        className={labelClasses}
      >
        <button
          type="button"
          data-slot="collapsible-trigger"
          aria-expanded={open}
          aria-controls={regionId}
          disabled
          className={TRIGGER_CLASS}
        >
          <span className="truncate">{label}</span>
          <span
            aria-hidden="true"
            hidden
            data-sidebar-group-count=""
            className={cn(
              computeSidebarEntryBadgeClasses('destructive'),
              'ml-0 group-data-[state=open]/sidebar-collapsible:hidden'
            )}
          />
          {chevron()}
        </button>
      </LabelElement>
      {action}
      <div
        id={regionId}
        data-slot="collapsible-content"
        data-sidebar-collapsible-content=""
        className="group-data-[state=closed]/sidebar-collapsible:hidden"
      >
        {entries}
      </div>
      <span
        data-island="collapsible"
        data-island-props="{}"
        hidden
      />
    </div>
  )
}
