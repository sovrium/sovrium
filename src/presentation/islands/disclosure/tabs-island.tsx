/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Tabs } from '@base-ui/react/tabs'
import { useId, useMemo, useRef, type ReactElement } from 'react'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  computeTabsFillPanelClasses,
  computeTabsFillShellClasses,
  type TabsLayout,
} from '@/presentation/design/tabs-fill-default-classes'
import {
  computeTabPanelClasses,
  computeTabsListClasses,
  computeTabsRootClasses,
} from './tabs-default-classes'
import { useLazyTabPanels, type LazyTabPanels } from './tabs-lazy-panels'
import { TabPanels, TabStrip, type TabItem } from './tabs-parts'
import { parseSsrPanels, useNestedIslandMount } from './use-nested-island-mount'

/**
 * The `items` default, hoisted out of the destructuring: a literal there is a
 * fresh array on every render, which makes `items` a new prop for `TabStrip`
 * and `TabPanels` on every render (`react-perf/jsx-no-new-array-as-prop`).
 */
const NO_ITEMS: readonly TabItem[] = []

interface TabsIslandProps {
  readonly items?: readonly TabItem[]
  readonly defaultTab?: string
  readonly tabsOrientation?: 'horizontal' | 'vertical'
  /**
   * How the tab set occupies its parent — `tabs.layout`.
   *
   * Absent unless the author declared it, so the serialised props of every tab
   * set that says nothing are unchanged and `flow` resolves to no extra class.
   */
  readonly layout?: TabsLayout
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
  /**
   * `design.components.tabs.parts`, minus `root`.
   *
   * The root part is already inside `className`; these are the parts that land
   * on elements this island builds itself, which no `className` can reach.
   * Absent unless the operator declared one, so the serialised island props of
   * an app that declares nothing are unchanged.
   */
  readonly designClasses?: Readonly<Record<string, string>>
  /**
   * This host's server-rendered subtree, captured by `island-client.tsx` before
   * `createRoot` discarded it — the host opts in with `data-island-ssr="true"`.
   *
   * It carries the panel the URL addressed, which is the one panel no longer
   * serialised into the island props. Absent on a tab set whose addressed panel
   * had no body to render, where the SSR half was a skeleton and there is
   * nothing to adopt.
   */
  readonly ssrHtml?: string
  /**
   * The DECLARED `page.query` property this tab set's `defaultTab` binds to —
   * present only on a tab set the author made an ADDRESS.
   *
   * Its presence is what turns fetch-on-activation on: the server has dropped
   * every panel's markup from {@link TabItem.content}, so opening one asks the
   * page for it at that address. Absent on every other
   * tab set, where all the markup travels as it always did and switching stays
   * instant and offline-safe.
   */
  readonly lazyParam?: string
}

/**
 * The class lists for the parts no `className` can reach.
 *
 * `design.components.tabs.parts.root` arrives already merged into `className`
 * — `buildFinalClassName` folded it in server-side — so only the list and the
 * panels need resolving here, from the `designClasses` map the SSR renderer
 * serialises alongside it.
 */
const partClasses = (
  orientation: 'horizontal' | 'vertical',
  designClasses: Readonly<Record<string, string>> | undefined,
  layout: TabsLayout | undefined
): { readonly root: string; readonly list: string; readonly panel: string } => ({
  // The fill shell is the tab set's half of the bounded chain: the mount host
  // above is the bounded column, and this root is the item that claims its
  // height. Empty under `flow`, so a tab set declaring no layout resolves to the
  // class list it always had.
  root: resolveClasses(
    computeTabsRootClasses({ orientation }),
    computeTabsFillShellClasses(layout, orientation) || undefined
  ),
  list: resolveClasses(computeTabsListClasses({ orientation }), designClasses?.['list']),
  // The fill classes go in as the FLOOR, above an operator's `parts.panel`: the
  // bound is what the author asked for with `layout: 'fill'`, and a panel that
  // silently stopped being a bounded column would leave the grid inside it at
  // its natural height with nothing in the config to read.
  panel: resolveClasses(
    computeTabPanelClasses({ orientation }),
    designClasses?.['panel'],
    undefined,
    computeTabsFillPanelClasses(layout) || undefined
  ),
})

/**
 * Tabs island — wraps Base UI Tabs for tabbed content panels.
 *
 * Supports horizontal/vertical orientation, keyboard navigation
 * (arrow keys, Home/End), and roving tabindex for accessibility.
 *
 * `useId` gives each instance its own description-id prefix, so two tab sets on
 * one page cannot mint the same id — `aria-describedby` resolves document-wide.
 *
 * `ssrPanels` is parsed ONCE per mount: the captured subtree is a string of a
 * size the page has already paid for, and re-parsing it on every tab switch
 * would buy nothing. Each panel then takes the props' copy of its markup when
 * there is one, and the document's otherwise — which is where the panel the URL
 * addressed now lives, and nowhere else.
 */

/**
 * Everything `TabsIsland` derives before it renders anything.
 *
 * Its own function because the component is at its per-function line cap and
 * a prop threaded through it costs a line there; nothing about the split is
 * semantic.
 */
function useTabsIslandModel(props: TabsIslandProps): {
  readonly items: readonly TabItem[]
  readonly defaultValue: string | undefined
  readonly rootRef: React.RefObject<HTMLDivElement | null>
  readonly uid: string
  readonly parts: { readonly root: string; readonly list: string; readonly panel: string }
  readonly ssrPanels: Readonly<Record<string, string>>
  readonly lazy: LazyTabPanels
} {
  const { items = NO_ITEMS, defaultTab, ssrHtml, lazyParam } = props
  const orientation = props.tabsOrientation ?? 'horizontal'
  const defaultValue = defaultTab ?? items[0]?.id
  const rootRef = useRef<HTMLDivElement>(null)
  const rescanNestedIslands = useNestedIslandMount(rootRef)
  const panelIds = useMemo(() => items.map((tab) => tab.id), [items])
  const ssrPanels = useMemo(() => parseSsrPanels(ssrHtml), [ssrHtml])
  // The panels whose markup the page already carries — in the props, or in the
  // document this host's `ssrHtml` capture read back. Asking the server for one
  // of these would be a round trip for bytes already on the machine.
  const resolvedIds = useMemo(
    () => [
      ...items.filter((tab) => tab.content !== undefined).map((tab) => tab.id),
      ...Object.keys(ssrPanels),
    ],
    [items, ssrPanels]
  )
  return {
    items,
    defaultValue,
    rootRef,
    ssrPanels,
    uid: useId(),
    parts: partClasses(orientation, props.designClasses, props.layout),
    lazy: useLazyTabPanels({
      lazyParam,
      initial: defaultValue,
      panelIds,
      resolvedIds,
      rootRef,
      onPanelReady: rescanNestedIslands,
    }),
  }
}

export default function TabsIsland(props: TabsIslandProps): ReactElement {
  const {
    tabsOrientation = 'horizontal',
    className,
    id,
    'data-testid': testId,
    ariaLabel,
    lazyParam,
  } = props
  const { items, defaultValue, rootRef, uid, parts, ssrPanels, lazy } = useTabsIslandModel(props)

  return (
    <Tabs.Root
      ref={rootRef}
      // CONTROLLED only when the tab set is an address: the open panel is then
      // a fact about the URL, which Back and Forward can change underneath the
      // component. Every other tab set stays uncontrolled, exactly as it was.
      {...(lazyParam === undefined ? { defaultValue } : { value: lazy.active })}
      orientation={tabsOrientation}
      className={resolveClasses(parts.root, undefined, className)}
      id={id}
      data-testid={testId}
      // Re-scan on every tab activation: Base UI mounts the newly-selected
      // panel's DOM (and its nested `data-island` markers) only on activation,
      // so a marker in an initially-inactive panel must be mounted then. On an
      // addressed tab set this is also where the panel is asked for.
      onValueChange={lazy.onValueChange}
    >
      <TabStrip
        items={items}
        orientation={tabsOrientation}
        ariaLabel={ariaLabel}
        uid={uid}
        className={parts.list}
      />
      <TabPanels
        items={items}
        ssrPanels={ssrPanels}
        fetched={lazy.fetched}
        lazyParam={lazyParam}
        className={parts.panel}
      />
    </Tabs.Root>
  )
}
