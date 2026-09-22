/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `table` grid's whole class vocabulary, from ONE import.
 *
 * The recipes live in six sibling modules, split by the ELEMENT they draw —
 * the frame and its head, the row, the rows that are not records, the bar
 * above, the bars that count, and the editing chrome. This module republishes
 * them and nothing else: it declares no class, computes nothing, and holds no
 * `v(…)` site.
 *
 * ## Why the name did not move
 * Sixty-four modules import the grid's vocabulary, and the two sides of the
 * SSR/island seam are among them. Splitting the recipes without keeping this
 * name would have put a mechanical specifier rewrite across sixty-four files
 * into a commit whose subject is "which element does this class belong to" —
 * and the reviewer would have had to read both to answer either. The basename
 * also carries meaning: `arbitrary-var-safelist.ts` collects recipe files by
 * the `-default-classes.ts` suffix, so every OUTPUT of the split keeps it, and
 * the barrel keeping it too costs nothing (it has no arbitrary class to
 * safelist) while keeping the family's names uniform.
 *
 * ## Why every name is written out
 * `export * from` would be shorter and is deliberately not used. `plan-splits.ts`
 * verifies a split by comparing export SETS, and it cannot enumerate a star —
 * it records the marker `*` and a split that replaced a star with nothing would
 * pass. An explicit list is also the only place a reader can see the grid's
 * surface as one thing, which is what a caller reaching for this file wants.
 *
 * ## Where the parts are
 *   - `table-shell-default-classes.ts`    frame, `<table>`, `<thead>`, `<th>`
 *   - `table-body-default-classes.ts`     `<tbody>`, rows, cells, cursor, selection
 *   - `table-group-default-classes.ts`    groups, summary, empty, skeleton, add row
 *   - `table-toolbar-default-classes.ts`  toolbar, search, view switcher
 *   - `table-pager-default-classes.ts`    pager, bulk bar
 *   - `table-panel-default-classes.ts`    panel, save status, chip, row actions
 *   - `table-overlay-default-classes.ts`  everything the grid opens IN FRONT of itself
 *   - `table-class-swap.ts`               the one token swap three of them share
 *
 * The line between this family and the overlay module is a question about the
 * element and not about line counts: a toolbar PANEL is a band inside the grid's
 * own frame, a toolbar MENU floats over the rows.
 */

export { TABLE_HEADER_TYPE } from '@/presentation/design/table-type-classes'

export {
  computeTableShellClasses,
  computeTableElementClasses,
  computeTableHeaderRowClasses,
  computeTableHeaderCellClasses,
  computeTableSortGlyphClasses,
  computeTableResizeHandleClasses,
  computeTableFillShellClasses,
  computeTableFillScrollClasses,
  computeTableStickyHeaderClasses,
} from './table-shell-default-classes'

export {
  computeTableBodyClasses,
  computeTableCellClasses,
  computeTableRowClasses,
  computeTableCellCursorClasses,
  computeTableFillPreviewClasses,
  computeTableFillHandleClasses,
  computeTableFrozenCellClasses,
  computeTableRowNumberClasses,
  computeTableEmptyValueClasses,
  computeTableCheckboxCellClasses,
  computeTableCheckboxControlClasses,
} from './table-body-default-classes'
export type { TableRowState } from './table-body-default-classes'

export {
  TABLE_GROUP_INDENT_PX,
  computeTableGroupRowClasses,
  computeTableGroupCellClasses,
  computeTableGroupSummaryCellClasses,
  computeTableSummaryRowClasses,
  computeTableSummaryCellClasses,
  computeTableEmptyStateClasses,
  computeTableSkeletonBarClasses,
  computeTableAddRowClasses,
  computeTableAddRowTriggerClasses,
  computeTableAddRowInputClasses,
} from './table-group-default-classes'

export {
  computeTableToolbarClasses,
  computeTableToolbarButtonClasses,
  computeTableToolbarPrimaryButtonClasses,
  computeTableSearchClasses,
  computeTableSearchHitClasses,
  computeTableViewSwitcherClasses,
  computeTableViewSwitcherItemClasses,
} from './table-toolbar-default-classes'

export {
  computeTablePagerClasses,
  computeTablePagerSelectClasses,
  computeTablePagerButtonClasses,
  computeTableBulkBarClasses,
  computeTableBulkBarCountClasses,
} from './table-pager-default-classes'

export {
  computeTablePanelClasses,
  computeTablePanelCaptionClasses,
  computeTablePanelLinkClasses,
  computeTablePanelControlClasses,
  computeTablePanelRemoveClasses,
  computeTableSaveIndicatorClasses,
  computeTableChipClasses,
  computeTableChipValueClasses,
  computeTableActionButtonClasses,
  computeTableActionRowClasses,
  computeTableInlineConfirmClasses,
} from './table-panel-default-classes'
export type { TableSaveStatus } from './table-panel-default-classes'

export {
  TABLE_EDITOR_PROSE_WIDTH,
  computeTableDialogBodyClasses,
  computeTableDialogPanelClasses,
  computeTableDialogPositionerClasses,
  computeTableDialogTitleClasses,
  computeTableDropZoneClasses,
  computeTableEditorFooterClasses,
  computeTableEditorLabelClasses,
  computeTableEditorListClasses,
  computeTableEditorListRowClasses,
  computeTableEditorPopoverClasses,
  computeTableEditorStripClasses,
  computeTableMenuClasses,
  computeTableMenuDragHandleClasses,
  computeTableMenuItemClasses,
  computeTableMenuSeparatorClasses,
  computeTablePreviewGridCellClasses,
  computeTableToastClasses,
} from './table-overlay-default-classes'
