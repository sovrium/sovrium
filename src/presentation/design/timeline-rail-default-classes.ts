/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The parts a STRUCTURAL `timeline` (children, no `dataSource`) adds to its
 * container and rail (`display-default-classes.ts`): one event per authored
 * child, and the marker drawn on the rail beside it. The marker is the record-
 * bound timeline's milestone diamond (`computeTimelineMarkerClasses`), so the
 * two shapes of the one `timeline` type mark an event alike.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { computeTimelineMarkerClasses } from '@/presentation/design/timeline-default-classes'

/**
 * One event: the positioning context its marker is placed in, so the authored
 * child keeps its own element and test id and the marker sits level with it.
 */
export const computeTimelineEventClasses = (): string => 'relative'

/**
 * The marker beside each event, on the container's rail and level with the
 * child's first line. The rail is centred 9px into the container and an event
 * starts 24px in (`pl-6`), so `-left-5` centres the 12px diamond within a pixel
 * of the line. Painted in the primary tone: an authored child carries no
 * record colour for it to take.
 */
export const computeTimelineRailMarkerClasses = (): string =>
  [
    computeTimelineMarkerClasses(),
    'absolute -left-5 top-1.5',
    `bg-[${v('sv-primary', T.primary)}]`,
  ].join(' ')
