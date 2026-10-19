/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// One filter of a page's 40 px control row, drawn as a toolbar facet: a compact
// dashed control beside the search box, its caption kept for screen readers.
//
// ─── WHY A FACET AND NOT A LABELLED SELECT ─────────────────────────────────
//
// The Records toolbar filters with a dashed "Add filter" control in the row,
// and its search box sits beside it at the same height. A filter written as a
// labelled select puts a caption above or beside every control, so the row
// grows a second line, and the page reads as a form to fill in rather than a
// list to narrow. A facet carries its meaning in its resting choice ("Everyone",
// "All automations") and in its accessible name, which is the caption.
//
// It stays a native `<select>` underneath: the channel it publishes on, the
// value it publishes and every spec addressing it by its caption are unchanged.

import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * The facet's frame, on the `<label>` the native select is wrapped in: as wide
 * as its choice, the caption screen-reader only, the control dashed like the
 * Records "Add filter" control.
 */
export const TOOLBAR_FACET_CLASS =
  'flex w-fit items-center [&>[data-slot=label]]:sr-only [&_[data-slot=native-select]]:border-dashed [&_[data-slot=native-select]]:font-medium'

/** What a facet publishes, and where its choices come from. */
export interface ToolbarFacetSpec {
  readonly id: string
  /** The caption: the control's accessible name, never painted. */
  readonly label: string
  /** The resting choice, which publishes nothing. */
  readonly allLabel: string
  readonly publishes: { readonly bindTo: string; readonly param: string }
  /** `dataSource` or `options`, as a native select takes them. */
  readonly choices: Readonly<Record<string, unknown>>
}

/** A filter of the control row, drawn as a facet. */
export const toolbarFacet = (spec: ToolbarFacetSpec): PageComponent =>
  ({
    type: 'native-select',
    props: { id: spec.id, label: spec.label, className: TOOLBAR_FACET_CLASS },
    emptyOption: { label: spec.allLabel },
    publishes: spec.publishes,
    ...spec.choices,
  }) as PageComponent
