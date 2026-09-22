/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two things a timeline draws OVER its rows rather than in them: the rule
 * marking the current date, and the connectors joining a record to the records
 * it follows.
 *
 * They live beside `timeline-view.tsx` rather than inside it because both are
 * overlays with their own positioning story — the today rule spans the whole
 * plot including the axis, a connector spans one row — and folding either into
 * the view would mix two coordinate systems in one file.
 */

import {
  computeTimelineDependencyClasses,
  computeTimelineTodayClasses,
  computeTimelineTodayTagClasses,
} from '@/presentation/design/timeline-default-classes'
import {
  isWithinBounds,
  toPercent,
  type TimelineBounds,
  type TimelineLink,
} from './timeline-compute'
import type { ReactElement } from 'react'

const TODAY_CLASSES = computeTimelineTodayClasses()
const TODAY_TAG_CLASSES = computeTimelineTodayTagClasses()
const DEPENDENCY_CLASSES = computeTimelineDependencyClasses()

/**
 * The dashed rule at the current date, plus the tag naming it.
 *
 * Returns `undefined` — drawing NOTHING — when today falls outside the plotted
 * window. That is the half of `showToday` an author cannot see in the config: a
 * marker clamped to an edge would read as "today is the first day of this
 * project", which for a plan that finished last spring is simply false. A
 * timeline of a past or future period therefore shows no rule even with the
 * marker switched on.
 *
 * Positioned against the same 0–100 axis percentage the bars are, so the rule
 * and the data can never be measuring different scales.
 */
export function TimelineTodayMarker({
  bounds,
  now,
}: {
  readonly bounds: TimelineBounds
  /** Injected rather than read inline so a caller can render a fixed instant. */
  readonly now: number
}): ReactElement | undefined {
  if (!isWithinBounds(now, bounds)) return undefined
  const left = toPercent(now, bounds)

  return (
    <div
      data-timeline-today="true"
      className={TODAY_CLASSES}
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- the marker's axis position is genuinely dynamic; React Compiler not yet enabled in Bun
      style={{ left: `${String(left)}%` }}
    >
      <span className={TODAY_TAG_CLASSES}>Today</span>
    </div>
  )
}

/**
 * The connectors drawn in ONE record's row — one per predecessor it names.
 *
 * `data-timeline-dependency` carries both ends as `from:to`, so a reader (and a
 * spec) can tell WHICH pair a connector links rather than only that some link
 * exists. The order is predecessor-first, matching the direction of the
 * declaration.
 *
 * The connector is `aria-hidden`: the link it draws is a relationship between
 * two records, and a screen reader reaching it between two bars would announce
 * an unnamed decoration. Surfacing the relationship in the accessibility tree
 * needs the predecessor's LABEL, which belongs to a named affordance rather
 * than to a hairline.
 */
export function TimelineDependencyLinks({
  links,
}: {
  readonly links: readonly TimelineLink[]
}): ReactElement {
  return (
    <>
      {links.map((link) => (
        <div
          key={`dependency-${link.fromId}-${link.toId}`}
          data-timeline-dependency={`${link.fromId}:${link.toId}`}
          className={DEPENDENCY_CLASSES}
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- the connector's span is a per-link time-axis position; React Compiler not yet enabled in Bun
          style={{ left: `${String(link.left)}%`, width: `${String(link.width)}%` }}
          aria-hidden="true"
        />
      ))}
    </>
  )
}
