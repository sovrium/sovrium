/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { exportNodeIdOf } from '@/domain/models/app/pages/node-identity'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  computeTabsFillPanelClasses,
  computeTabsFillShellClasses,
  type TabsLayout,
} from '@/presentation/design/tabs-fill-default-classes'
import { hostComponentType } from '@/presentation/render/registry/island-host-attributes'
import { LAZY_PANEL_PARAM_KEY } from '@/presentation/render/resolve/tabs-lazy-resolver'
import { asRecord, baseProps } from './island-form-props'
import {
  tabsArrivalBands,
  tabsArrivalOverridesOf,
  type TabsArrivalBand,
  type TabsArrivalOverrides,
} from './island-tabs-arrival'
import {
  exportedPanelAttributes,
  renderExportedTabPanels,
  type ExportedTabs,
} from './island-tabs-export'
import {
  buildTabsItems,
  computeSsrTabsRootClasses,
  renderTabsSsrTriggerStrip,
  resolveAddressedPanel,
  stripAddressedPanelContent,
} from './island-tabs-ssr'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/** What one tabs node reads off its config, the page export's ids included. */
interface TabsModel {
  readonly items: ReturnType<typeof buildTabsItems>
  readonly defaultTab: string | undefined
  readonly addressed: ReturnType<typeof resolveAddressedPanel>
  readonly exported: ExportedTabs | undefined
  readonly orientation: 'horizontal' | 'vertical'
  readonly layout: TabsLayout | undefined
  readonly lazyParam: string | undefined
  readonly variant: 'line' | 'default'
  /** The `responsive.<bp>.defaultTab` overrides naming a real panel, if any. */
  readonly arrival: TabsArrivalOverrides | undefined
  /** The panels the server draws as markup: the addressed one, or one per width band. */
  readonly served: readonly ServedTabPanel[]
}

/** A panel the server draws as markup, hidden by CSS outside its widths when banded. */
interface ServedTabPanel {
  readonly id: string
  readonly html: string
  readonly className: string | undefined
}

/**
 * The panels drawn as markup. Without a per-breakpoint `defaultTab` it is the
 * one addressed panel; with one, a panel per band of widths, each shown by CSS
 * only at its widths, so the tab the island opens is the one already painted.
 */
const servedPanelsOf = (
  items: TabsModel['items'],
  addressed: TabsModel['addressed'],
  bands: readonly TabsArrivalBand[] | undefined
): readonly ServedTabPanel[] => {
  if (bands === undefined) {
    return addressed === undefined ? [] : [{ ...addressed, className: undefined }]
  }
  return bands.flatMap((band) => {
    const html = items.find((item) => item.id === band.id)?.content ?? ''
    return html.length === 0 ? [] : [{ id: band.id, html, className: band.className || undefined }]
  })
}

/**
 * The per-width tabs open on arrival, and the bands of widths they cover. An
 * address and a page export each name ONE tab, so neither reads the overrides:
 * the address decides, and an export has no width.
 */
const arrivalOf = (
  c: Record<string, unknown>,
  items: TabsModel['items'],
  defaultTab: string | undefined,
  singleTab: boolean
): {
  readonly arrival: TabsArrivalOverrides | undefined
  readonly bands: readonly TabsArrivalBand[] | undefined
  /** The tab drawn first: the narrowest band's, else the base `defaultTab`. */
  readonly opening: string | undefined
} => {
  const ids = items.map((item) => item.id)
  const arrival = singleTab ? undefined : tabsArrivalOverridesOf(c['responsive'], ids)
  const base = ids.find((id) => id === defaultTab) ?? ids[0]
  const bands =
    arrival === undefined || base === undefined ? undefined : tabsArrivalBands(base, arrival)
  return { arrival, bands, opening: bands?.[0]?.id ?? defaultTab }
}

/**
 * The tabs schema places `tabsOrientation`, `defaultTab`, `layout` and
 * `tabsVariant` at the top level (siblings of `props`/`children`), so they are
 * read off `component`. Items are derived from `panels`, each body the panel's
 * own or the INDEX-ALIGNED pre-rendered child (PG-04: a form or a data-table
 * inside a panel).
 *
 * `lazyParam` is the DECLARED `page.query` property this tab set's `defaultTab`
 * binds to, attached by `resolveTabsLazyPanels` and read through its constant
 * so the two spellings cannot drift: present only on a tab set the author made
 * an ADDRESS. A page export draws the tab set with its tab roles, every panel
 * tied to its tab by id; a served page leaves those roles to the island.
 */
const tabsModelOf = (
  component: unknown,
  renderedChildren: Parameters<typeof buildTabsItems>[1],
  currentLang: string | undefined,
  languages: Parameters<typeof buildTabsItems>[3]
): TabsModel => {
  const c = asRecord(component)
  const items = buildTabsItems(c['panels'], renderedChildren, currentLang, languages)
  const defaultTab = c['defaultTab'] as string | undefined
  const node = exportNodeIdOf(component)
  const lazyParam = c[LAZY_PANEL_PARAM_KEY] as string | undefined
  const { arrival, bands, opening } = arrivalOf(
    c,
    items,
    defaultTab,
    lazyParam !== undefined || node !== undefined
  )
  const addressed = resolveAddressedPanel(items, opening)
  return {
    items,
    defaultTab,
    addressed,
    exported: node === undefined ? undefined : { node, selected: addressed?.id ?? items[0]?.id },
    orientation: c['tabsOrientation'] === 'vertical' ? 'vertical' : 'horizontal',
    layout: c['layout'] as TabsLayout | undefined,
    lazyParam,
    variant: c['tabsVariant'] === 'line' ? 'line' : 'default',
    arrival,
    served: servedPanelsOf(items, addressed, bands),
  }
}

/**
 * The island's props: ids, labels and trigger details, never a served panel's
 * markup. The addressed panel is in the document and the unopened ones are in
 * inert templates beside it, both read back through the `ssrHtml` capture; on
 * an ADDRESSED tab set the unopened ones are fetched on activation instead. A
 * page export keeps them, since it draws its hidden panels from the items. The
 * author's `props['aria-label']` names the island's tablist.
 */
const tabsIslandProps = (
  model: TabsModel,
  elementProps: Record<string, unknown>,
  designStyles: Parameters<typeof baseProps>[1]
) => ({
  items: stripAddressedPanelContent(
    model.items,
    model.addressed?.id,
    model.lazyParam !== undefined || model.exported === undefined
  ),
  defaultTab: model.defaultTab,
  lazyParam: model.lazyParam,
  ...(model.arrival === undefined ? {} : { arrivalTabs: model.arrival }),
  tabsOrientation: model.orientation,
  tabsVariant: model.variant,
  layout: model.layout,
  ariaLabel: elementProps['aria-label'] as string | undefined,
  ...baseProps(elementProps, designStyles),
})

/**
 * The unopened panels of a served tab set that is not an address, each as an
 * inert `<template>` named by its panel id: part of the response once, drawn by
 * nothing and mounted by nothing until the island takes its markup on opening.
 * Empty on an addressed tab set, whose unopened panels are fetched, and in a
 * page export, which draws them as hidden panels instead.
 */
function inertTabPanels(model: TabsModel): readonly ReactElement[] {
  if (model.lazyParam !== undefined || model.exported !== undefined) return []
  return model.items
    .filter(
      (item) => !model.served.some((panel) => panel.id === item.id) && item.content.length > 0
    )
    .map((item) => (
      <template
        key={item.id}
        data-tab-panel-id={item.id}
        // eslint-disable-next-line sovrium/require-sanitized-html -- server-rendered markup: renderToStaticMarkup output, which escapes every text and attribute value
        dangerouslySetInnerHTML={{ __html: item.content }}
      />
    ))
}

/**
 * The panels drawn before hydration: the addressed one as real markup, the
 * unopened ones as inert templates, and, in a page export, every other one
 * `hidden`.
 *
 * The addressed panel names WHICH panel its markup belongs to, so the island
 * can pair it back with its own `items` entry after `createRoot` has discarded
 * the subtree it was read from. It is the panel's own content root and the
 * second half of the fill chain: the hydrated twin of what
 * `computeTabsFillPanelClasses` does on `<Tabs.Panel>` one element up.
 */
function renderTabsPanels(model: TabsModel, inert: readonly ReactElement[]): ReactElement {
  const { addressed, exported } = model
  return (
    <>
      {model.served.length === 0 ? (
        <div className="bg-muted h-24 animate-pulse rounded" />
      ) : (
        model.served.map((panel, index) => (
          <div
            key={index}
            data-tab-panel-ssr="true"
            data-tab-panel-id={panel.id}
            {...exportedPanelAttributes(exported, panel.id)}
            className={
              resolveClasses(computeTabsFillPanelClasses(model.layout), panel.className) ||
              undefined
            }
            // eslint-disable-next-line sovrium/require-sanitized-html -- server-rendered markup: renderToStaticMarkup output, which escapes every text and attribute value
            dangerouslySetInnerHTML={{ __html: panel.html }}
          />
        ))
      )}
      {renderExportedTabPanels(model.items, addressed?.id, exported)}
      {inert}
    </>
  )
}

/**
 * The `tabs` island host: the trigger strip and the addressed panel drawn on
 * the server, the island mounting over them in the browser.
 *
 * The `data-island` host is deliberately LAYOUT-NEUTRAL. The island mounts
 * `Tabs.Root` as this element's single child carrying the split classes of
 * `computeTabsRootClasses`; were the host to carry them too, the real tab set
 * would become a non-growing item of a clone of its own layout and shrink-fit
 * to its content. The layout lives on ONE element in each state instead: the
 * wrapper below before hydration, `Tabs.Root` after, at the same depth, with
 * the same classes (`resolveClasses(defaults, author className)`, the same
 * pure function on both halves, so the page never snaps on mount).
 *
 * `layout: 'fill'` is the ONE thing the host does carry: the host is the
 * bounded column and the root inside it the item that claims its height, two
 * consecutive links of one chain. `flow`, the default, resolves to the empty
 * string. The host names the component, since it is the one element that
 * outlives the mount.
 *
 * `data-island-ssr` opts in to the pre-mount `ssrHtml` capture in
 * `island-client.tsx`: no served panel's markup is serialised into the props,
 * so this subtree, the addressed panel and the inert templates, is its ONLY
 * copy, and `createRoot` discards it. The panel well is `py-4`, the twin of `TAB_PANEL_LAYOUT` in
 * `islands/disclosure/disclosure-default-classes.ts`, with no horizontal
 * gutter on either half.
 */
export const islandTabsComponent: ComponentRenderer = ({
  component,
  elementProps,
  renderedChildren,
  currentLang,
  languages,
  designStyles,
}) => {
  const model = tabsModelOf(component, renderedChildren, currentLang, languages)
  const inert = inertTabPanels(model)
  const fillShell = computeTabsFillShellClasses(model.layout, model.orientation) || undefined
  const rootClasses = resolveClasses(
    computeSsrTabsRootClasses(model.orientation) ?? '',
    elementProps.className as string | undefined,
    undefined,
    fillShell
  )
  const panelClasses = resolveClasses(
    model.orientation === 'vertical' ? 'min-w-0 py-4' : 'py-4',
    fillShell
  )
  return (
    <div
      data-island="tabs"
      data-component-type={hostComponentType(elementProps)}
      data-island-props={JSON.stringify(tabsIslandProps(model, elementProps, designStyles))}
      data-island-ssr={model.served.length === 0 && inert.length === 0 ? undefined : 'true'}
      data-testid={elementProps['data-testid'] as string | undefined}
      className={fillShell}
    >
      <div className={rootClasses || undefined}>
        {renderTabsSsrTriggerStrip(model.items, model.orientation, model.lazyParam, model.exported)}
        <div className={panelClasses || undefined}>{renderTabsPanels(model, inert)}</div>
      </div>
    </div>
  )
}
