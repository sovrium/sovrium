/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DisplayControlsProps } from './display-controls'
import type { LeadingControlsProps } from './leading-controls'
import type { QueryControlsProps } from './query-controls'
import type { DataTableToolbar } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * The toolbar's affordance switches, resolved to plain booleans.
 *
 * Every field of `DataTableToolbar` is optional, so a render site reading it
 * directly spells `toolbarConfig?.filters &&` — and an optional chain is a
 * decision point in its own right, so each of the nine controls cost TWO
 * branches to gate rather than one. Resolving the block once collapses that
 * back to `flags.filters &&`.
 */
export interface ToolbarFlags {
  readonly viewSwitcher: boolean
  readonly filters: boolean
  readonly sort: boolean
  readonly groupBy: boolean
  readonly columnToggle: boolean
  readonly export: boolean
  readonly refresh: boolean
  readonly density: boolean
}

export function resolveToolbarFlags(config: DataTableToolbar | undefined): ToolbarFlags {
  return {
    viewSwitcher: config?.viewSwitcher === true,
    filters: config?.filters === true,
    sort: config?.sort === true,
    groupBy: config?.groupBy === true,
    columnToggle: config?.columnToggle === true,
    export: config?.export === true,
    refresh: config?.refresh === true,
    density: config?.density === true,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// EMPTINESS — whether each cluster of the bar will render anything at all
//
// The bar asks all four of these before drawing itself, because an empty
// toolbar is a 17px band with a bottom rule and no content sitting above the
// header row — chrome claiming space for nothing, and a rule the reader takes
// for the top of the table.
//
// Each predicate mirrors, term for term, the branches of the component it is
// named after. That correspondence is the thing to preserve: adding a control to
// a cluster without adding its term here brings the empty bar back for exactly
// the grids that were meant to gain one. They live in this module rather than
// beside the components because a file that exports both a component and a plain
// function loses React Fast Refresh for the whole file.
//
// Two of the terms are NOT configuration. `canCreate` and `!readOnly` gate
// controls the grid draws unconditionally on a writable bound table — `+ New
// record` and `Import` — so such a table has a toolbar whether or not its author
// declared one, and the empty case is narrower than "no `toolbar` block".
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Whether this cluster will render anything at all.
 *
 * It mirrors the five conditions in the component below, one term each, and it
 * lives HERE rather than beside its caller so that adding a control and
 * forgetting the predicate is a one-line-apart mistake rather than a
 * three-file one. The bar asks all four clusters this before drawing itself —
 * see `toolbar-bar.tsx`.
 */
export function hasLeadingControls(props: LeadingControlsProps): boolean {
  return (
    props.canCreate ||
    (props.showSearch && props.searchConfig !== undefined) ||
    props.activeViewName !== undefined ||
    props.viewSwitcherEnabled ||
    (props.saveStatus !== undefined && props.saveStatus !== 'idle')
  )
}

/**
 * Whether this cluster will render anything at all — see
 * {@link hasLeadingControls} for why the predicate sits beside the component
 * whose branches it mirrors.
 *
 * `!readOnly` is the term that makes this cluster non-empty for almost every
 * bound table: Import is a fixed control rather than a configured one, so a
 * writable grid has a toolbar whether or not its author asked for one.
 */
export function hasQueryControls(props: QueryControlsProps): boolean {
  return !props.readOnly || props.filtersEnabled || props.sortEnabled || props.groupByEnabled
}

/**
 * Whether this cluster will render anything at all — see
 * {@link hasLeadingControls} for why the predicate sits beside the component
 * whose branches it mirrors.
 *
 * The settings dialog needs no term of its own: it renders only alongside the
 * density menu, so `densityEnabled` already covers it.
 */
export function hasDisplayControls(props: DisplayControlsProps): boolean {
  return (
    props.columnToggleEnabled ||
    props.canExportSelection ||
    props.exportEnabled ||
    props.refreshEnabled ||
    props.densityEnabled
  )
}
