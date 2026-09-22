/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeTableToolbarClasses } from '@/presentation/design/table-default-classes'
import { DisplayControls, type DisplayControlsProps } from './display-controls'
import { LeadingControls, type LeadingControlsProps } from './leading-controls'
import { QueryControls, type QueryControlsProps } from './query-controls'
import { hasDisplayControls, hasLeadingControls, hasQueryControls } from './toolbar-flags'
import { ViewsControls, type ViewsControlsProps } from './views-controls'
import type { ReactElement } from 'react'

/**
 * The toolbar's four regions, each handed down as one bag.
 *
 * Regions are grouped by what a control DOES, not by which hook produced its
 * value: `leading` acts on the grid as a whole, `query` changes which rows are
 * asked for, `views` is the saved-views surface, and `display` changes how the
 * fetched rows are presented. The caller translates between the two
 * vocabularies; see the view's props builder.
 */
export interface DataTableToolbarBarProps {
  /** Hides the toolbar from assistive tech while the import dialog is up. */
  readonly importDialogOpen: boolean
  readonly leading: LeadingControlsProps
  readonly query: QueryControlsProps
  readonly views: ViewsControlsProps
  readonly display: DisplayControlsProps
}

/**
 * Top toolbar with search + import/filter/columns/export/refresh/density
 * buttons. This shell owns only the two flex containers; every control lives
 * in the region component that its cluster maps to.
 */
export function DataTableToolbarBar({
  importDialogOpen,
  leading,
  query,
  views,
  display,
}: DataTableToolbarBarProps): ReactElement | undefined {
  // Nothing to put in it, so there is no bar. The shell used to render
  // unconditionally, which left a 17px band with a bottom rule and an empty
  // `innerText` sitting above the header row of any grid that configures no
  // toolbar control and cannot be written to — chrome claiming space for
  // nothing, and a rule the reader reads as the top of the table.
  //
  // The test is asked of the four clusters rather than of the config, because
  // several controls are FIXED rather than configured: a writable bound table
  // draws Import and a creatable one draws `+ New record` with no `toolbar`
  // block at all, and both of those are a full bar. Only a grid where all four
  // clusters come back empty loses it.
  if (
    !hasLeadingControls(leading) &&
    !hasQueryControls(query) &&
    !views.enabled &&
    !hasDisplayControls(display)
  ) {
    return undefined
  }

  return (
    <div
      role="toolbar"
      data-toolbar
      data-testid="data-table-toolbar"
      aria-hidden={importDialogOpen || undefined}
      // The bar's own chrome — surface, rule, padding, gap, and the `flex-wrap`
      // that is load-bearing rather than cosmetic: with eleven controls switched
      // on, the right-hand cluster measured 906px inside a 375px viewport and
      // the page body did not scroll, so eight of the controls were simply
      // unreachable, silently, with no wrap and no scroll affordance. Wrapping
      // costs nothing at desktop width (content that fits does not wrap) and is
      // the difference between a usable and an unusable toolbar on a phone.
      // Shared platform presentation: every business app and the Admin Space
      // draw this same toolbar, so it is fixed in the recipe rather than per app.
      className={computeTableToolbarClasses()}
    >
      <LeadingControls {...leading} />
      {/* `min-w-0` lets this cluster shrink below its content width so the
          parent's wrap can take effect on it too; without it the cluster keeps
          its 906px max-content size and overflows the row it wrapped onto.
          The gap matches the bar's own so a wrapped cluster keeps one rhythm. */}
      <div className="ml-auto flex min-w-0 flex-wrap items-center gap-1.5">
        <QueryControls {...query} />
        {views.enabled && <ViewsControls {...views} />}
        <DisplayControls {...display} />
      </div>
    </div>
  )
}
