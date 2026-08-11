/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Fragment } from 'react'
import { DataRow, type DataRowContext } from './data-row'
import { buildGroupTree, groupPathKey, type GroupLevel, type GroupNode } from './group-order'
import { buildGroupSummaryLayout } from './group-summary'
import { GroupSummaryCells, GroupSummaryLeadingCells } from './group-summary-cells'
import type { GroupSummaryContext, GroupSummaryLayout } from './group-summary'
import type { FieldMetaMap } from '../hooks/use-inline-editing'
import type { TableRecord } from '../shared/types'
import type { DataTableGroupBy } from '@/domain/models/app/pages/components/component-types/data/data-table/schema'
import type { ColumnDef, Row } from '@tanstack/react-table'
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
 * One spacer per level above this one, so a sub-group reads as sitting inside
 * its parent.
 *
 * Repeating ONE utility rather than scaling a per-level class keeps the indent
 * working off the already-compiled set: a `pl-14` no other module names renders
 * as no indent at all until the CSS corpus is regenerated, and depth is a poor
 * thing to make depend on that.
 */
function GroupIndent({ level }: { readonly level: number }): ReactElement {
  return (
    <>
      {Array.from({ length: level - 1 }, (_, depth) => (
        <span
          key={`indent-${String(depth)}`}
          aria-hidden="true"
          className="pl-8"
        />
      ))}
    </>
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
  readonly allColumns: readonly ColumnDef<TableRecord>[]
  readonly cellClass: string
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
  const { summary, cellClass, borderClass, onToggle } = shared
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
      className="group-header bg-background-subtle"
    >
      <td
        colSpan={summary ? summary.layout.leadSpan : shared.allColumns.length}
        className={`${cellClass} ${borderClass} text-foreground cursor-pointer font-medium`}
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
          cellClass={cellClass}
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
              className="divide-border bg-background-raised divide-y"
            >
              <GroupHeaderRow
                node={node}
                shared={shared}
                isCollapsed={collapsed}
              />
              {!collapsed &&
                node.dataRows.map((row, rowIndex) => (
                  <DataRow
                    key={row.id}
                    row={row}
                    rowIndex={rowIndex}
                    ctx={shared.ctx}
                  />
                ))}
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
  cellClass,
  borderClass,
  ctx,
  groupBy,
  collapsedGroups,
  onToggleGroupCollapsed,
  groupCounts,
  fieldMeta,
  groupSummary,
}: {
  readonly rows: readonly Row<TableRecord>[]
  readonly allColumns: readonly ColumnDef<TableRecord>[]
  readonly cellClass: string
  readonly borderClass: string
  readonly ctx: DataRowContext
  readonly groupBy: DataTableGroupBy
  readonly collapsedGroups: ReadonlyArray<string>
  readonly onToggleGroupCollapsed?: (pathKey: string) => void
  readonly groupCounts?: Readonly<Record<string, number>>
  readonly fieldMeta?: FieldMetaMap
  readonly groupSummary?: GroupSummaryContext
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
    cellClass,
    borderClass,
    ctx,
    levels,
    toggled: new Set(collapsedGroups),
    ...(onToggleGroupCollapsed && { onToggle: onToggleGroupCollapsed }),
    ...(groupCounts && { groupCounts }),
    ...(layout && groupSummary && { summary: { layout, context: groupSummary } }),
  }
  return (
    <GroupNodes
      nodes={buildGroupTree(rows, levels)}
      shared={shared}
    />
  )
}
