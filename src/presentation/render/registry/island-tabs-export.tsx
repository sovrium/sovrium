/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A tab set as a PAGE EXPORT draws it (`island-tabs-ssr.tsx` draws the served
 * one). A page export mounts no island, so what the server draws IS the tab
 * set a design tool sees: one `tablist`, a `tab` per panel naming its panel by
 * `aria-controls`, every panel a `tabpanel` with its own `id`, the hidden ones
 * too, so a panel is tied to its tab by id and never by position.
 */

import type { ReactElement, ReactNode } from 'react'

/** One caption of the strip, as the served strip and the export both read it. */
interface TabCaption {
  readonly id: string
}

/**
 * A tab set as a page export draws it: the export node id of the tabs node,
 * and the panel shown. Absent on a served page.
 */
export interface ExportedTabs {
  readonly node: string
  readonly selected: string | undefined
}

/** The element id a page export gives a tab's trigger. */
const exportedTabIdOf = (node: string, panel: string): string => `${node}:tab:${panel}`

/** The element id a page export gives a tab's panel, which its trigger's `aria-controls` names. */
export const exportedTabPanelIdOf = (node: string, panel: string): string =>
  `${node}:panel:${panel}`

/**
 * The roles a page export draws a panel with, so a design tool ties each panel
 * to its tab by id rather than by position: `role="tabpanel"`, its own `id`,
 * and the trigger that labels it. A served page draws none of them here: the
 * hydrated island owns those roles, and the pre-hydration markup must not
 * match `getByRole('tabpanel')` beside it.
 */
export const exportedPanelAttributes = (
  exported: ExportedTabs | undefined,
  panel: string
): Readonly<Record<string, string>> =>
  exported === undefined
    ? {}
    : {
        id: exportedTabPanelIdOf(exported.node, panel),
        role: 'tabpanel',
        'aria-labelledby': exportedTabIdOf(exported.node, panel),
      }

/**
 * The unaddressed panels a page export draws beside the addressed one, each
 * `hidden`, with the roles {@link exportedPanelAttributes} gives every panel:
 * an unopened panel is otherwise only in the island's props, or not in the
 * response at all, and a node it does not draw reads, on the way back from a
 * design tool, as one the designer deleted. A served page draws none.
 */
export function renderExportedTabPanels(
  items: ReadonlyArray<{ readonly id: string; readonly content: string }>,
  addressedId: string | undefined,
  exported: ExportedTabs | undefined
): readonly ReactElement[] {
  if (exported === undefined) return []
  return items
    .filter((item) => item.id !== addressedId)
    .map((item) => (
      <div
        key={item.id}
        hidden
        data-tab-panel-id={item.id}
        {...exportedPanelAttributes(exported, item.id)}
        // eslint-disable-next-line sovrium/require-sanitized-html -- server-rendered markup: renderToStaticMarkup output, which escapes every text and attribute value
        dangerouslySetInnerHTML={{ __html: item.content }}
      />
    ))
}

/** The tab list's roles in a page export; a served page's strip carries none. */
export const exportedListAttributes = (
  exported: ExportedTabs | undefined,
  orientation: 'horizontal' | 'vertical'
): Readonly<Record<string, string>> =>
  exported === undefined ? {} : { role: 'tablist', 'aria-orientation': orientation }

/**
 * One caption of a page export's tab list: a `tab` naming, by id, the panel it
 * controls, the shown one selected.
 */
export function renderExportedTrigger(
  item: TabCaption,
  className: string,
  caption: ReactNode,
  exported: ExportedTabs
): ReactElement {
  return (
    <button
      key={item.id}
      type="button"
      role="tab"
      id={exportedTabIdOf(exported.node, item.id)}
      aria-selected={item.id === exported.selected ? 'true' : 'false'}
      aria-controls={exportedTabPanelIdOf(exported.node, item.id)}
      className={className}
    >
      {caption}
    </button>
  )
}
