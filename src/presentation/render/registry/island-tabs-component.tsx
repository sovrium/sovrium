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
  const addressed = resolveAddressedPanel(items, defaultTab)
  const node = exportNodeIdOf(component)
  return {
    items,
    defaultTab,
    addressed,
    exported: node === undefined ? undefined : { node, selected: addressed?.id ?? items[0]?.id },
    orientation: c['tabsOrientation'] === 'vertical' ? 'vertical' : 'horizontal',
    layout: c['layout'] as TabsLayout | undefined,
    lazyParam: c[LAZY_PANEL_PARAM_KEY] as string | undefined,
    variant: c['tabsVariant'] === 'line' ? 'line' : 'default',
  }
}

/**
 * The island's props. The addressed panel's markup is DROPPED: it is already
 * in the document, and the island reads it back through the `ssrHtml` capture.
 * On an ADDRESSED tab set every panel's is: the unopened ones are fetched on
 * activation. The author's `props['aria-label']` names the island's tablist.
 */
const tabsIslandProps = (
  model: TabsModel,
  elementProps: Record<string, unknown>,
  designStyles: Parameters<typeof baseProps>[1]
) => ({
  items: stripAddressedPanelContent(
    model.items,
    model.addressed?.id,
    model.lazyParam !== undefined
  ),
  defaultTab: model.defaultTab,
  lazyParam: model.lazyParam,
  tabsOrientation: model.orientation,
  tabsVariant: model.variant,
  layout: model.layout,
  ariaLabel: elementProps['aria-label'] as string | undefined,
  ...baseProps(elementProps, designStyles),
})

/**
 * The panels drawn before hydration: the addressed one as real markup, and, in
 * a page export, every other one `hidden`.
 *
 * The addressed panel names WHICH panel its markup belongs to, so the island
 * can pair it back with its own `items` entry after `createRoot` has discarded
 * the subtree it was read from. It is the panel's own content root and the
 * second half of the fill chain: the hydrated twin of what
 * `computeTabsFillPanelClasses` does on `<Tabs.Panel>` one element up.
 */
function renderTabsPanels(model: TabsModel): ReactElement {
  const { addressed, exported } = model
  return (
    <>
      {addressed === undefined ? (
        <div className="bg-muted h-24 animate-pulse rounded" />
      ) : (
        <div
          data-tab-panel-ssr="true"
          data-tab-panel-id={addressed.id}
          {...exportedPanelAttributes(exported, addressed.id)}
          className={computeTabsFillPanelClasses(model.layout) || undefined}
          // eslint-disable-next-line sovrium/require-sanitized-html -- server-rendered markup: renderToStaticMarkup output, which escapes every text and attribute value
          dangerouslySetInnerHTML={{ __html: addressed.html }}
        />
      )}
      {renderExportedTabPanels(model.items, addressed?.id, exported)}
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
 * `island-client.tsx`: the addressed panel's markup is no longer serialised
 * into the props, so this subtree is its ONLY copy, and `createRoot` discards
 * it. The panel well is `py-4`, the twin of `TAB_PANEL_LAYOUT` in
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
      data-island-ssr={model.addressed === undefined ? undefined : 'true'}
      data-testid={elementProps['data-testid'] as string | undefined}
      className={fillShell}
    >
      <div className={rootClasses || undefined}>
        {renderTabsSsrTriggerStrip(model.items, model.orientation, model.lazyParam, model.exported)}
        <div className={panelClasses || undefined}>{renderTabsPanels(model)}</div>
      </div>
    </div>
  )
}
