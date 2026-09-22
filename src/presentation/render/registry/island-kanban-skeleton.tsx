/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The kanban board's SSR skeleton, in both of the board's shapes.
 *
 * Split out of `island-data-components.tsx` when the two-axis skeleton took
 * that file past its line cap. It is a module rather than an arbitrary slice:
 * everything here paints the board before its island mounts, and nothing else
 * does.
 */

// The kanban column shell comes from the WAVE R-D recipe, not from
// `data-default-classes.ts`. That module is a `presentation-component` and is
// therefore unreachable from `islands/kanban/*`, which is exactly why the
// hydrated board carried its own hand-written literals and drifted from this
// skeleton. `kanban-default-classes.ts` lives in `presentation-util` and both
// sides import it, so the well the skeleton paints is byte-identical to the one
// that replaces it.
import {
  computeKanbanBoardClasses,
  computeKanbanColumnClasses,
  computeKanbanGridClasses,
  computeKanbanLaneRowClasses,
  computeKanbanSwimlaneClasses,
  computeKanbanSwimlaneHeaderClasses,
  computeKanbanSwimlaneRuleClasses,
} from '@/presentation/design/kanban-default-classes'
import type { ReactElement } from 'react'

/**
 * ONE skeleton column well — the shell both kanban skeletons repeat.
 *
 * [internal ref]: painted via the shared helper so the SSR skeleton paints the same
 * chrome as the hydrated island. The `w-72 shrink-0` width sizing stays raw —
 * width is a layout concern owned by the consumer. The header bar rides on
 * `bg-background-inset` rather than `bg-background-subtle`: the well is now
 * `bg-background-subtle` itself, so a same-tone bar on it was invisible.
 */
function KanbanSkeletonColumn({
  withHeader = true,
}: {
  readonly withHeader?: boolean
}): ReactElement {
  return (
    <div className={`${computeKanbanColumnClasses()} w-72 shrink-0`}>
      {withHeader ? (
        <div className="bg-background-inset h-4 w-24 animate-pulse rounded-sm" />
      ) : undefined}
      <div className="bg-background-raised h-20 animate-pulse rounded-sm" />
      <div className="bg-background-raised h-20 animate-pulse rounded-sm" />
    </div>
  )
}

/**
 * The kanban skeleton for a board that declares a SECOND axis.
 *
 * It draws the GRID — a shared column-header row over a stack of lane bands —
 * rather than the flat row of columns, because a skeleton that showed a shape
 * the hydrated board does not have is a layout shift waiting to happen, and
 * because the design-system console captures this page before any client fetch
 * resolves: a lane axis absent from the SSR pass is a lane axis absent from
 * every screenshot of it.
 *
 * Lane labels come from `swimlaneOptions` when the bound table declares them,
 * and fall back to two anonymous bands otherwise — a system-source board has no
 * `app.tables` entry to read options from, and two bands still state "this is a
 * grid" where three grey columns state the opposite.
 */
function KanbanSwimlaneSkeleton({
  laneLabels,
}: {
  readonly laneLabels: readonly string[]
}): ReactElement {
  return (
    <div
      className={computeKanbanGridClasses()}
      aria-label="Loading kanban board..."
      role="status"
    >
      <div className={computeKanbanLaneRowClasses()}>
        {['a', 'b', 'c'].map((slot) => (
          <div
            key={`kanban-skeleton-head-${slot}`}
            className="w-72 shrink-0"
          >
            <div className="bg-background-inset h-4 w-24 animate-pulse rounded-sm" />
          </div>
        ))}
      </div>
      {laneLabels.map((label) => (
        <div
          key={`kanban-skeleton-lane-${label}`}
          className={computeKanbanSwimlaneClasses()}
        >
          <div className={computeKanbanSwimlaneHeaderClasses()}>
            <div className="bg-background-inset h-3 w-16 animate-pulse rounded-sm" />
            <span
              className={computeKanbanSwimlaneRuleClasses()}
              aria-hidden="true"
            />
          </div>
          <div className={computeKanbanLaneRowClasses()}>
            {['a', 'b', 'c'].map((slot) => (
              <KanbanSkeletonColumn
                key={`kanban-skeleton-cell-${label}-${slot}`}
                withHeader={false}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * The lane bands the skeleton draws: the declared lane options when the server
 * could resolve them, and two placeholders when it could not.
 */
function resolveSkeletonLaneLabels(elementProps: Record<string, unknown>): readonly string[] {
  const declared = elementProps.swimlaneOptions
  if (Array.isArray(declared) && declared.length > 0) {
    return declared.map((value) => String(value))
  }
  return ['lane-1', 'lane-2']
}

/**
 * The kanban SSR skeleton: the flat row of columns, or the grid a board with a
 * second axis will hydrate into.
 *
 * Which one is decided by the presence of `swimlanes` alone — the same config
 * key the island branches on — so the skeleton and the mounted board cannot
 * disagree about the board's shape and hand the reader a layout shift.
 */
export function KanbanSkeleton({
  elementProps,
}: {
  readonly elementProps: Record<string, unknown>
}): ReactElement {
  if (elementProps.swimlanes) {
    return <KanbanSwimlaneSkeleton laneLabels={resolveSkeletonLaneLabels(elementProps)} />
  }
  return (
    <div
      className={computeKanbanBoardClasses()}
      aria-label="Loading kanban board..."
      role="status"
    >
      {['a', 'b', 'c'].map((slot) => (
        <KanbanSkeletonColumn key={`kanban-skeleton-col-${slot}`} />
      ))}
    </div>
  )
}
