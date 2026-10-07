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
 * decision point in its own right, so each control cost TWO
 * branches to gate rather than one. Resolving the block once collapses that
 * back to `flags.filters &&`.
 */
export interface ToolbarFlags {
  readonly filters: boolean
  readonly sort: boolean
  readonly export: boolean
  readonly refresh: boolean
}

export function resolveToolbarFlags(config: DataTableToolbar | undefined): ToolbarFlags {
  return {
    filters: config?.filters === true,
    sort: config?.sort === true,
    export: config?.export === true,
    refresh: config?.refresh === true,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// EMPTINESS — whether each cluster of the bar will render anything at all
//
// The bar asks all three of these before drawing itself, because an empty
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
// Two of the terms are NOT configuration. `canCreate` and `canImport` gate
// controls the grid draws unconditionally on a bound table the caller may create
// in — `+ New record` and `Import` — so such a table has a toolbar whether or
// not its author declared one, and the empty case is narrower than "no
// `toolbar` block".
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Whether this cluster will render anything at all.
 *
 * It mirrors the three conditions in the component below, one term each, and it
 * lives HERE rather than beside its caller so that adding a control and
 * forgetting the predicate is a one-line-apart mistake rather than a
 * three-file one. The bar asks all three clusters this before drawing itself —
 * see `toolbar-bar.tsx`.
 */
export function hasLeadingControls(props: LeadingControlsProps): boolean {
  return (
    props.canCreate ||
    (props.showSearch && props.searchConfig !== undefined) ||
    (props.saveStatus !== undefined && props.saveStatus !== 'idle')
  )
}

/**
 * Whether this cluster will render anything at all — see
 * {@link hasLeadingControls} for why the predicate sits beside the component
 * whose branches it mirrors.
 *
 * `canImport` is the term that makes this cluster non-empty for a grid its
 * caller may create in: Import is a fixed control rather than a configured one,
 * so such a grid has a toolbar whether or not its author asked for one. A
 * caller who may not create gets no Import, and so no toolbar unless something
 * else is configured.
 */
export function hasQueryControls(props: QueryControlsProps): boolean {
  return props.canImport || props.filtersEnabled || props.sortEnabled
}

/**
 * Whether this cluster will render anything at all — see
 * {@link hasLeadingControls} for why the predicate sits beside the component
 * whose branches it mirrors.
 */
export function hasDisplayControls(props: DisplayControlsProps): boolean {
  return props.canExportSelection || props.exportEnabled || props.refreshEnabled
}
