/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/tabs-line@0.37.0#6c84372866d0

// The console's section tabs, INSTALLED from the library's `tabs-line` block:
// shadcn's `line` tabs, the current tab underlined on no ground. `Console Block
// Parity` holds the copy to the block. Re-install with
// `sovrium library add block/tabs-line --update`.
//
// The bindings are everything a page names: the panels, their bodies, the tab
// open first, the accessible name and test id, and the fill layout.

import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

export const tabsLineCopy = {
  type: 'tabs',
  tabsVariant: 'line',
  defaultTab: '',
  props: {},
  panels: [],
} as const

/** What a page binds into its section tabs. */
export interface LineTabsBinding {
  readonly defaultTab: string
  readonly panels: readonly Readonly<Record<string, unknown>>[]
  readonly children: readonly PageComponent[]
  readonly props?: Readonly<Record<string, unknown>>
  readonly layout?: 'fill'
}

/** A page's section tabs: the installed copy with the page's panels and bodies. */
export const lineTabs = ({
  defaultTab,
  panels,
  children,
  props = {},
  layout,
}: LineTabsBinding): PageComponent =>
  ({
    ...tabsLineCopy,
    defaultTab,
    ...(layout === undefined ? {} : { layout }),
    props,
    panels,
    children,
  }) as PageComponent
