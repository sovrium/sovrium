/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  KANBAN_COLUMN_TITLE_CLASSES,
  computeKanbanLaneRowClasses,
  computeKanbanSwimlaneChevronClasses,
  computeKanbanSwimlaneClasses,
  computeKanbanSwimlaneHeaderClasses,
  computeKanbanSwimlaneRuleClasses,
  computeKanbanSwimlaneToggleClasses,
} from '@/presentation/design/kanban-default-classes'
import { cellDropId } from './collision-detection'
import { KanbanCell } from './kanban-cell'
import type { KanbanLaneData } from './group-lanes'
import type { KanbanCard } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { ReactElement } from 'react'

/**
 * The chevron that turns with the lane's open state.
 *
 * `aria-hidden`, because the button it sits in already carries `aria-expanded`
 * — a screen reader announcing both would announce the same fact twice, once
 * as a state and once as a triangle.
 */
function LaneChevron({ expanded }: { readonly expanded: boolean }): ReactElement {
  return (
    <svg
      className={`${computeKanbanSwimlaneChevronClasses()} ${expanded ? 'rotate-90' : ''}`}
      viewBox="0 0 8 8"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2 0.5 L6 4 L2 7.5 Z"
        fill="currentColor"
      />
    </svg>
  )
}

export interface KanbanSwimlaneProps {
  readonly lane: KanbanLaneData
  readonly expanded: boolean
  readonly onToggle: (laneValue: string) => void
  readonly emptyMessage?: string
  readonly card?: KanbanCard
  readonly draggableEnabled: boolean
  readonly colorFieldColors?: Readonly<Record<string, string>>
  /** Prefix for the body's DOM id, so `aria-controls` is unique per board. */
  readonly idPrefix: string
}

/**
 * One lane of a two-axis board — a horizontal band crossing every column.
 *
 * ─── THE HEADER IS A DISCLOSURE, AND THE WHOLE LABEL IS THE CONTROL ────────
 *
 * `<h3><button aria-expanded aria-controls>…</button></h3>` is the WAI-ARIA
 * disclosure pattern verbatim, and both halves are load-bearing. The heading is
 * how a reader working down the board by landmark finds the lane at all; the
 * button is how anyone not using a pointer opens and closes it. A lane whose
 * cards were hidden behind a click target with no `aria-expanded` is a section
 * that has silently vanished for everyone not looking at it.
 *
 * The button is the whole label rather than a chevron beside one: a lane title
 * is 10px text, so a glyph-sized hit target next to it would fail SC 2.5.8
 * while the obvious thing to click sat inert one pixel away.
 *
 * ─── A COLLAPSED LANE RENDERS ITS REGION AND NOT ITS CELLS ─────────────────
 *
 * The `aria-controls` target exists in both states — a dangling reference is
 * worse than a present empty one — but its cells are not rendered when closed,
 * rather than rendered and `hidden`. That is the difference between a lane that
 * holds nothing and a lane that holds everything invisibly: `[data-card]` inside
 * a closed lane must resolve to nothing, for a spec and for a `Ctrl-F` alike.
 */
export function KanbanSwimlane({
  lane,
  expanded,
  onToggle,
  emptyMessage,
  card,
  draggableEnabled,
  colorFieldColors,
  idPrefix,
}: KanbanSwimlaneProps): ReactElement {
  const bodyId = `${idPrefix}-lane-${encodeURIComponent(lane.value)}`

  return (
    <section
      data-swimlane={lane.value}
      className={computeKanbanSwimlaneClasses()}
    >
      <div className={computeKanbanSwimlaneHeaderClasses()}>
        <h3 className={KANBAN_COLUMN_TITLE_CLASSES}>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={bodyId}
            className={computeKanbanSwimlaneToggleClasses()}
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- one closure per lane over its own value; React Compiler not yet enabled in Bun
            onClick={() => onToggle(lane.value)}
          >
            <LaneChevron expanded={expanded} />
            {lane.value}
          </button>
        </h3>
        <span
          className={computeKanbanSwimlaneRuleClasses()}
          aria-hidden="true"
        />
      </div>
      <div
        id={bodyId}
        className={computeKanbanLaneRowClasses()}
      >
        {expanded
          ? lane.columns.map((column) => (
              <KanbanCell
                key={column.value}
                column={column}
                dropId={cellDropId({ lane: lane.value, column: column.value })}
                emptyMessage={emptyMessage}
                card={card}
                draggableEnabled={draggableEnabled}
                colorFieldColors={colorFieldColors}
              />
            ))
          : undefined}
      </div>
    </section>
  )
}
