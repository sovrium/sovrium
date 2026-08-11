/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Tabs } from '@base-ui/react/tabs'
import { useCallback, useEffect, useId, useRef, type ReactElement } from 'react'
import { cn } from '@/presentation/utils/design/class-merge'
import {
  computeTabClasses,
  computeTabDescriptionClasses,
  computeTabIndicatorClasses,
  computeTabLabelClasses,
  computeTabPanelClasses,
  computeTabsListClasses,
  computeTabsRootClasses,
} from './disclosure-default-classes'

interface TabItem {
  readonly id: string
  readonly label: string
  readonly content: string
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

interface TabsIslandProps {
  readonly items?: readonly TabItem[]
  readonly defaultTab?: string
  readonly tabsOrientation?: 'horizontal' | 'vertical'
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  /**
   * Accessible name for the `<Tabs.List>` (`role="tablist"`). When an author
   * sets `props['aria-label']` on the `tabs` component, it is threaded here so
   * `getByRole('tablist', { name })` resolves — e.g. the admin dashboard's
   * per-domain tab bar named "Onglets du domaine".
   */
  readonly ariaLabel?: string
}

/**
 * Re-scan this tabs subtree for nested `data-island` markers so they hydrate.
 * The panels are injected via `dangerouslySetInnerHTML` (see below), so their
 * nested markers (a split-pane editor, a record grid, a metrics panel) are NOT
 * present in the first-load `mountIslandsWithin()` pass — and Base UI only keeps
 * the ACTIVE panel mounted, so a marker in an initially-inactive panel
 * (Analytique / Données) appears only when that tab is first selected.
 * `mountIslandsWithin` is idempotent (skips `data-island-mounted` markers), so
 * this is safe to run on every tab change as well as on mount. Dynamically
 * imported to keep the static import graph free of an island-client ↔ registry
 * cycle.
 */
function useNestedIslandMount(rootRef: React.RefObject<HTMLDivElement | null>): () => void {
  const scan = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    void import('@/presentation/islands/island-client').then(({ mountIslandsWithin }) => {
      mountIslandsWithin(root)
    })
  }, [rootRef])
  useEffect(scan, [scan])
  return scan
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
 * Tabs island — wraps Base UI Tabs for tabbed content panels.
 *
 * Supports horizontal/vertical orientation, keyboard navigation
 * (arrow keys, Home/End), and roving tabindex for accessibility.
 *
 * `useId` gives each instance its own description-id prefix, so two tab sets on
 * one page cannot mint the same id — `aria-describedby` resolves document-wide.
 */
export default function TabsIsland({
  items = [],
  defaultTab,
  tabsOrientation = 'horizontal',
  className,
  id,
  'data-testid': testId,
  ariaLabel,
}: TabsIslandProps): ReactElement {
  const defaultValue = defaultTab ?? items[0]?.id
  const rootRef = useRef<HTMLDivElement>(null)
  const rescanNestedIslands = useNestedIslandMount(rootRef)
  const uid = useId()

  return (
    <Tabs.Root
      ref={rootRef}
      defaultValue={defaultValue}
      orientation={tabsOrientation}
      className={cn(computeTabsRootClasses({ orientation: tabsOrientation }), className)}
      id={id}
      data-testid={testId}
      // Re-scan on every tab activation: Base UI mounts the newly-selected
      // panel's DOM (and its nested `data-island` markers) only on activation,
      // so a marker in an initially-inactive panel must be mounted then.
      onValueChange={rescanNestedIslands}
    >
      <Tabs.List
        className={computeTabsListClasses({ orientation: tabsOrientation })}
        aria-label={ariaLabel}
        data-scrollable={isHorizontalTabList(tabsOrientation)}
      >
        {items.map((tab) => (
          <TabTrigger
            key={tab.id}
            tab={tab}
            orientation={tabsOrientation}
            descriptionId={`${uid}tab-description-${tab.id}`}
          />
        ))}
        <Tabs.Indicator className={computeTabIndicatorClasses()} />
      </Tabs.List>
      {items.map((tab) => (
        <Tabs.Panel
          key={tab.id}
          value={tab.id}
          className={computeTabPanelClasses({ orientation: tabsOrientation })}
          // PG-04 (PATTERN-REGRESSION): tab content is pre-rendered SSR HTML —
          // either a plain string body or the static markup of a child React
          // component subtree (form, data-table). Injected via
          // dangerouslySetInnerHTML so embedded `data-island` markers survive
          // and the SSR skeleton is visible inside the active tab.
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- one-shot per-tab SSR HTML; tabs island re-renders dominated by tab-switching cost
          dangerouslySetInnerHTML={{ __html: tab.content }}
        />
      ))}
    </Tabs.Root>
  )
}
