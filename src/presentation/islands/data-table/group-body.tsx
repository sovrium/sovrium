/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Fragment, useMemo } from 'react'
import {
  TABLE_GROUP_INDENT_PX,
  computeTableBodyClasses,
  computeTableGroupCellClasses,
  computeTableGroupRowClasses,
} from '@/presentation/design/table-default-classes'
import { AddRow, type AddRowConfig } from './add-row'
import { DataRow, type DataRowContext } from './data-row'
import { buildGroupTree, groupPathKey, type GroupLevel, type GroupNode } from './group-order'
import { buildGroupSummaryLayout } from './group-summary'
import { GroupSummaryCells, GroupSummaryLeadingCells } from './group-summary-cells'
import { rowIdOf } from './row-identity'
import type { GroupSummaryContext, GroupSummaryLayout } from './group-summary'
import type { FieldMetaMap } from '../hooks/use-inline-editing'
import type { DataTableColumnDef, DataTableRow } from './island/table-features'
import type { DataTableGroupBy } from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { ReactElement } from 'react'

/**
 * Flatten a `groupBy` block into one entry per level, resolving each level's own
 * declared option order from the field metadata.
 *
 * The primary level is the object itself and `thenBy` carries the rest, so a
 * one-level config yields a one-element array and takes exactly the path a
 * nested one does. There is no separate un-nested code path to drift.
 */
function resolveGroupLevels(
  groupBy: DataTableGroupBy,
  fieldMeta: FieldMetaMap | undefined
): readonly GroupLevel[] {
  const declared = [
    { field: groupBy.field, direction: groupBy.direction, collapsed: groupBy.collapsed },
    ...(groupBy.thenBy ?? []),
  ]
  return declared.map((level) => {
    const options = fieldMeta?.[level.field]?.options
    return {
      field: level.field,
      ...(level.direction && { direction: level.direction }),
      ...(level.collapsed !== undefined && { collapsed: level.collapsed }),
      ...(options && { declaredOptions: options }),
    }
  })
}

/**
 * The spacer that sets a sub-group's label inside its parent's.
 *
 * ONE span carrying an inline `paddingLeft`, where this used to repeat an
 * already-compiled `pl-8` once per level. The repetition was a correct
 * workaround for a real constraint — a per-level utility cannot be enumerated
 * by a SCAN-FREE compiler, so a `pl-14` no other module names emits no rule and
 * renders as no indent at all — but it spends 32px a level where the design
 * spends 14, so a three-deep grouping pushed its labels 64px off the edge. An
 * inline style sidesteps the compiler entirely and can carry any number.
 *
 * ## `level - 1`, because the two counts start from different places
 * `node.level` is ONE-based — it is the number `data-group-level` exposes, and
 * the one `levels[node.level - 1]` indexes the declared grouping with — while
 * an indent is a DEPTH: a top-level group is nested inside nothing and owes no
 * inset at all. Spending `level * 14` gave every top-level group header a 14px
 * indent it had not earned (measured live) and pushed each nested level one
 * step further out than the design places it. The subtraction is CLAMPED
 * rather than trusted: nothing renders a level 0 today, and a negative padding
 * would silently pull a label back out of its own cell.
 */
function GroupIndent({ level }: { readonly level: number }): ReactElement {
  const style = useMemo(
    () => ({ paddingLeft: Math.max(0, level - 1) * TABLE_GROUP_INDENT_PX }),
    [level]
  )
  return (
    <span
      aria-hidden="true"
      style={style}
    />
  )
}

/**
 * Whether one group is folded right now.
 *
 * `toggled` holds the paths the reader has FLIPPED away from their level's
 * declared default, not the paths that are collapsed. That is what lets
 * `collapsed: true` and a reader's click coexist: with a default of `false` the
 * set reads exactly as "collapsed" and behaves as it always has, and with a
 * default of `true` the same click OPENS the group instead of being a no-op.
 */
function isGroupCollapsed(
  node: GroupNode,
  levels: readonly GroupLevel[],
  toggled: ReadonlySet<string>
): boolean {
  const byDefault = levels[node.level - 1]?.collapsed === true
  return toggled.has(groupPathKey(node.path)) ? !byDefault : byDefault
}

/** Everything every group in the tree draws against — constant for one render. */
interface GroupRenderContext {
  readonly allColumns: readonly DataTableColumnDef[]
  readonly borderClass: string
  readonly ctx: DataRowContext
  readonly levels: readonly GroupLevel[]
  readonly toggled: ReadonlySet<string>
  readonly onToggle?: (pathKey: string) => void
  readonly groupCounts?: Readonly<Record<string, number>>
  readonly summary?: {
    readonly layout: GroupSummaryLayout
    readonly context: GroupSummaryContext
  }
  /** The trailing add-row's wiring, drawn once per LEAF group. */
  readonly addRow?: AddRowConfig
}

/**
 * What a group's PLACE already says about a record created inside it: every
 * level's value down the path, so a row added under `prospect` is born with
 * `stage: 'prospect'` without the reader typing it — the way a grouped add in
 * a spreadsheet prefills the group.
 *
 * The leaf's own level carries the raw value; the ancestors' values are only
 * known stringified, which is what the path holds.
 */
function groupPrefill(node: GroupNode, levels: readonly GroupLevel[]): Record<string, unknown> {
  return Object.fromEntries(
    levels
      .slice(0, node.level)
      .map((level, index) => [
        level.field,
        index === node.level - 1 ? node.rawValue : node.path[index],
      ])
  )
}

/**
 * One group's own row: its collapse toggle, its value, its whole-view count and
 * its declared summaries.
 *
 * The whole row acts as the collapse toggle. We
 * deliberately do NOT render an inner `<button>` because the spec's collapse
 * locator is `header.getByRole('button', ...).or(header)` — a Playwright pattern
 * that under strict mode requires EXACTLY ONE of the alternatives to resolve.
 * The `<td>` (not `<tr>`) owns the `onClick` so the click target Playwright
 * actionability-checks is a leaf element with explicit hit testing.
 */
function GroupHeaderRow({
  node,
  shared,
  isCollapsed,
}: {
  readonly node: GroupNode
  readonly shared: GroupRenderContext
  readonly isCollapsed: boolean
}): ReactElement {
  const pathKey = groupPathKey(node.path)
  const { summary, borderClass, onToggle } = shared
  const handleToggle = onToggle ? () => onToggle(pathKey) : undefined
  return (
    <tr
      data-testid="group-header"
      data-group-header="true"
      data-group={node.value}
      data-group-value={node.rawValue}
      // A group's value stops being a key at depth 2 — two regions can each hold
      // a `Prospect`. The path is what makes every group addressable; `data-group`
      // stays as it is so every one-level selector keeps working.
      data-group-path={pathKey}
      data-group-level={String(node.level)}
      role="row"
      aria-expanded={!isCollapsed}
      className={`group-header ${computeTableGroupRowClasses()}`}
    >
      <td
        colSpan={summary ? summary.layout.leadSpan : shared.allColumns.length}
        className={`${computeTableGroupCellClasses()} ${borderClass}`}
        {...(handleToggle && { onClick: handleToggle })}
      >
        <GroupIndent level={node.level} />
        <span
          aria-hidden="true"
          className="mr-2"
        >
          {isCollapsed ? '▶' : '▼'}
        </span>
        {node.value} ({shared.groupCounts?.[pathKey] ?? node.pageRowCount})
        {summary && (
          <GroupSummaryLeadingCells
            layout={summary.layout}
            context={summary.context}
            groupKey={pathKey}
          />
        )}
      </td>
      {summary && (
        <GroupSummaryCells
          layout={summary.layout}
          context={summary.context}
          groupKey={pathKey}
          borderClass={borderClass}
        />
      )}
    </tr>
  )
}

/**
 * One level of groups, and — for a group that holds sub-groups — the levels
 * beneath it.
 *
 * Each group owns a `<tbody>` so its rows stay addressable as
 * `tbody[data-group-path='…'] tr:not(.group-header)`. Nesting `<tbody>` is
 * invalid HTML, so a sub-group's wrapper is a SIBLING that follows its parent's
 * in document order rather than sitting inside it; the `data-group-path` is what
 * re-establishes the parentage the DOM cannot express.
 *
 * Collapse nests: a folded parent renders none of its descendants, so "collapse
 * all" cannot leave a page of orphan sub-headers with no parent context.
 */
function GroupNodes({
  nodes,
  shared,
}: {
  readonly nodes: readonly GroupNode[]
  readonly shared: GroupRenderContext
}): ReactElement {
  return (
    <>
      {nodes.map((node) => {
        const pathKey = groupPathKey(node.path)
        const collapsed = isGroupCollapsed(node, shared.levels, shared.toggled)
        return (
          <Fragment key={pathKey}>
            <tbody
              data-group={node.value}
              data-group-path={pathKey}
              data-group-level={String(node.level)}
              data-testid={`group-${node.value}`}
              className={computeTableBodyClasses()}
            >
              <GroupHeaderRow
                node={node}
                shared={shared}
                isCollapsed={collapsed}
              />
              {!collapsed &&
                node.dataRows.map((row, rowIndex) => (
                  <DataRow
                    key={rowIdOf(row)}
                    row={row}
                    rowIndex={rowIndex}
                    ctx={shared.ctx}
                  />
                ))}
              {/* One trailing row per LEAF group, born with the group's value.
                  A parent holds only its header here — its records live in the
                  sibling bodies below — so it gets none. */}
              {!collapsed && shared.addRow && node.children.length === 0 && (
                <AddRow
                  config={shared.addRow}
                  prefill={groupPrefill(node, shared.levels)}
                />
              )}
            </tbody>
            {!collapsed && node.children.length > 0 && (
              <GroupNodes
                nodes={node.children}
                shared={shared}
              />
            )}
          </Fragment>
        )
      })}
    </>
  )
}

/**
 * Render the grid's rows partitioned by every declared grouping level.
 *
 * Data rows go through the SHARED {@link DataRow}, so inline editing, the row
 * action and keyboard access behave here exactly as they do on a flat grid.
 *
 * Note: `data-group` lives on the `<tbody>` and the group-header `<tr>` only; we
 * deliberately do NOT propagate it to data rows. The display-and-layout
 * regression's locator `[data-group-header], tr[data-group], [role="row"][data-group]`
 * matches any element with `data-group`, and a data row carrying it would be
 * picked up without the required `data-group-value` companion.
 */
export function GroupedTableBodyRows({
  rows,
  allColumns,
  borderClass,
  ctx,
  groupBy,
  collapsedGroups,
  onToggleGroupCollapsed,
  groupCounts,
  fieldMeta,
  groupSummary,
  addRow,
}: {
  readonly rows: readonly DataTableRow[]
  readonly allColumns: readonly DataTableColumnDef[]
  readonly borderClass: string
  readonly ctx: DataRowContext
  readonly groupBy: DataTableGroupBy
  readonly collapsedGroups: ReadonlyArray<string>
  readonly onToggleGroupCollapsed?: (pathKey: string) => void
  readonly groupCounts?: Readonly<Record<string, number>>
  readonly fieldMeta?: FieldMetaMap
  readonly groupSummary?: GroupSummaryContext
  readonly addRow?: AddRowConfig
}): ReactElement {
  const levels = resolveGroupLevels(groupBy, fieldMeta)
  // Computed once for the whole grid: the layout depends only on the declared
  // summaries and the visible columns, never on which group is being drawn.
  const layout =
    groupSummary && groupSummary.items.length > 0
      ? buildGroupSummaryLayout(groupSummary.columnFields, groupSummary.items)
      : undefined
  // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- a render-scoped bag whose own members (notably `ctx`) are rebuilt by the caller every render, so memoizing this would keep no reference stable
  const shared: GroupRenderContext = {
    allColumns,
    borderClass,
    ctx,
    levels,
    toggled: new Set(collapsedGroups),
    ...(onToggleGroupCollapsed && { onToggle: onToggleGroupCollapsed }),
    ...(groupCounts && { groupCounts }),
    ...(layout && groupSummary && { summary: { layout, context: groupSummary } }),
    ...(addRow && { addRow }),
  }
  return (
    <GroupNodes
      nodes={buildGroupTree(rows, levels)}
      shared={shared}
    />
  )
}
