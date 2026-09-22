/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pieces `TabsIsland` renders: one trigger, one panel, and the two maps
 * over them.
 *
 * Split out of `tabs-island.tsx` because that file is an island and carries the
 * eco `max-lines: 250` cap — a cap that exists so an island's chunk stays small,
 * which splitting a file does not change either way. What it does change is
 * whether the cap can be read as "this island is getting heavy": keeping the
 * root component, its hooks and its wiring in one file and its leaves in
 * another is what makes the next reader's answer to that honest.
 */

import { Tabs } from '@base-ui/react/tabs'
import {
  computeTabClasses,
  computeTabDescriptionClasses,
  computeTabIndicatorClasses,
  computeTabLabelClasses,
} from './disclosure-default-classes'
import type { ReactElement } from 'react'

export interface TabItem {
  readonly id: string
  readonly label: string
  /**
   * The panel's rendered markup, or `undefined` for the panel the URL ADDRESSED.
   *
   * That one is already in the document as real markup, so the server stops
   * serialising it here and the island reads it back out of {@link
   * TabsIslandProps.ssrHtml} instead — one copy on the wire rather than two
   *.
   */
  readonly content?: string
  readonly disabled?: boolean
  /**
   * Optional second line rendered beneath the label on the trigger, for tab
   * sets that name a feature and then say what it does. Never part of the
   * trigger's accessible name — see {@link TabTrigger}.
   */
  readonly description?: string
}

/**
 * A single `<Tabs.Tab>` trigger.
 *
 * A trigger WITHOUT a description renders exactly what it always did — the
 * bare label text, no wrapper element — so no existing tab set grows a node,
 * an empty element, or extra height because this capability shipped.
 *
 * A trigger WITH one renders two block lines AND pins its accessible name to
 * the LABEL ALONE. Letting the description fall into the name instead would
 * silently break every `getByRole('tab', { name })` in the suite and in every
 * consumer config the moment an author adds a subtitle — and a substring
 * matcher would not even notice ("Projects" still matches "Projects Plan the
 * work…"). The description reaches assistive tech through `aria-describedby`,
 * which is where a subtitle belongs.
 */
function TabTrigger({
  tab,
  orientation,
  descriptionId,
}: {
  readonly tab: TabItem
  readonly orientation: 'horizontal' | 'vertical'
  readonly descriptionId: string
}): ReactElement {
  const described = tab.description !== undefined && tab.description.length > 0
  return (
    <Tabs.Tab
      value={tab.id}
      disabled={tab.disabled}
      className={computeTabClasses({ orientation })}
      aria-label={described ? tab.label : undefined}
      aria-describedby={described ? descriptionId : undefined}
    >
      {described ? (
        <>
          <span className={computeTabLabelClasses()}>{tab.label}</span>
          <span
            id={descriptionId}
            className={computeTabDescriptionClasses()}
          >
            {tab.description}
          </span>
        </>
      ) : (
        tab.label
      )}
    </Tabs.Tab>
  )
}

/**
 * `data-scrollable` marker for a horizontal tab strip: the list is
 * `overflow-x-auto`, so on a narrow viewport it reflows by horizontal scroll
 * rather than wrapping/clipping. Vertical
 * strips are not horizontally scrollable, so the attribute is omitted there.
 */
function isHorizontalTabList(orientation: 'horizontal' | 'vertical'): 'true' | undefined {
  return orientation === 'horizontal' ? 'true' : undefined
}

/**
 * One tab panel.
 *
 * Extracted from `TabsIsland` so that function stays inside the per-function
 * line cap; the `dangerouslySetInnerHTML` note below is the reason it is worth
 * its own component rather than being inlined back.
 */
function TabPanel({
  tab,
  html,
  className,
  pending,
}: {
  readonly tab: TabItem
  readonly html: string
  readonly className: string
  readonly pending: boolean
}): ReactElement {
  if (pending) {
    // A panel of an ADDRESSED tab set that has not arrived yet. The bar
    // reserves a block of height so the page does not jump when the markup
    // lands, and `aria-busy` says the region is filling rather than empty —
    // which is what a screen reader needs during the round trip the deferral
    // costs. A non-addressed tab set never reaches here: its markup was in the
    // props from the first byte.
    return (
      <Tabs.Panel
        value={tab.id}
        className={className}
        aria-busy="true"
      >
        <div className="bg-background-subtle h-32 w-full animate-pulse rounded" />
      </Tabs.Panel>
    )
  }
  return (
    <Tabs.Panel
      value={tab.id}
      className={className}
      // PG-04 (PATTERN-REGRESSION): tab content is pre-rendered SSR HTML —
      // either a plain string body or the static markup of a child React
      // component subtree (form, data-table). Injected via
      // dangerouslySetInnerHTML so embedded `data-island` markers survive
      // and the SSR skeleton is visible inside the active tab.
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- one-shot per-tab SSR HTML; tabs island re-renders dominated by tab-switching cost
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/**
 * The trigger strip, with its accessible name and its scroll marker.
 *
 * Extracted from `TabsIsland` for the same reason `TabPanel` is: that function
 * is at its per-function line cap and every prop it threads costs a line.
 */
export function TabStrip(input: {
  readonly items: readonly TabItem[]
  readonly orientation: 'horizontal' | 'vertical'
  readonly ariaLabel: string | undefined
  readonly uid: string
  readonly className: string
}): ReactElement {
  const { items, orientation, ariaLabel, uid, className } = input
  return (
    <Tabs.List
      className={className}
      aria-label={ariaLabel}
      data-scrollable={isHorizontalTabList(orientation)}
    >
      {items.map((tab) => (
        <TabTrigger
          key={tab.id}
          tab={tab}
          orientation={orientation}
          descriptionId={`${uid}tab-description-${tab.id}`}
        />
      ))}
      <Tabs.Indicator className={computeTabIndicatorClasses()} />
    </Tabs.List>
  )
}

/**
 * Every panel, each taking its markup from the nearest place that has it.
 *
 * The props' copy first, then the DOCUMENT's (where the panel the URL addressed
 * lives, read back through the `ssrHtml` capture), then one fetched by address.
 * On an addressed tab set the first two are absent for every panel but the one
 * the URL named, so the third is the only source the rest ever have — and until
 * it arrives the panel is `pending` rather than empty.
 */
export function TabPanels(input: {
  readonly items: readonly TabItem[]
  readonly ssrPanels: Readonly<Record<string, string>>
  readonly fetched: Readonly<Record<string, string>>
  readonly lazyParam: string | undefined
  readonly className: string
}): ReactElement {
  const { items, ssrPanels, fetched, lazyParam, className } = input
  const panels = items.map((tab) => {
    const html = tab.content ?? ssrPanels[tab.id] ?? fetched[tab.id] ?? ''
    return (
      <TabPanel
        key={tab.id}
        tab={tab}
        html={html}
        className={className}
        pending={html === '' && lazyParam !== undefined}
      />
    )
  })
  // A Fragment, not an array: `Tabs.Root` reads its panels through context
  // rather than by enumerating children, so the extra level is invisible to it
  // and the component keeps a single-element return type.
  // eslint-disable-next-line react/jsx-no-useless-fragment -- the Fragment IS the single-element return type a component needs; `Tabs.Root` reads panels through context, so the extra level is invisible to it
  return <>{panels}</>
}
