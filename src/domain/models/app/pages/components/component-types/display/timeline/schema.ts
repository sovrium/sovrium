/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Schema } from 'effect'

// ---------------------------------------------------------------------------
// Timeline / Gantt Component Schema
// ---------------------------------------------------------------------------

/**
 * Dependency link between two timeline items.
 *
 * Supports finish-to-start (FS), start-to-start (SS), finish-to-finish (FF),
 * and start-to-finish (SF) relationship types.
 */
export const TimelineDependencySchema = Schema.Struct({
  /** Record ID of the predecessor task */
  from: Schema.String.annotate({ description: 'Record ID of the predecessor task' }),

  /** Record ID of the successor task */
  to: Schema.String.annotate({ description: 'Record ID of the successor task' }),

  /** Dependency type (default: finish-to-start) */
  type: Schema.optional(
    Schema.Literals(['FS', 'SS', 'FF', 'SF']).annotate({
      description:
        'Dependency type: FS (finish-to-start), SS (start-to-start), FF (finish-to-finish), SF (start-to-finish)',
    })
  ),
}).annotate({
  identifier: 'TimelineDependency',
  title: 'Timeline Dependency',
  description: 'Dependency link between two timeline items for drawing arrows',
})

/**
 * Timeline / Gantt component configuration.
 *
 * Displays records as horizontal bars on a time axis. Each record is
 * positioned based on a start date field, with optional end date for
 * duration bars. Records without an end date render as point markers.
 *
 * @example
 * ```yaml
 * components:
 *   - type: data-timeline
 *     dataSource:
 *       table: projects
 *     props:
 *       startField: startDate
 *       endField: endDate
 *       labelField: name
 *       groupBy: team
 *       colorField: status
 *       defaultZoom: month
 *       showToday: true
 * ```
 */
export const DataTimelineSchema = Schema.Struct({
  /** Field name containing the record's start date (required) */
  startField: Schema.String.pipe(
    Schema.annotate({ description: 'Field name for the start date of each timeline bar' }),
    Schema.check(Schema.isMinLength(1))
  ),

  /** Field name containing the record's end date (omit for point markers) */
  endField: Schema.optional(
    Schema.String.annotate({
      description:
        'Field name for the end date; records without end date render as point/diamond markers',
    })
  ),

  /** Field name whose value is shown as the label on each bar/point */
  labelField: Schema.optional(
    Schema.String.annotate({
      description: 'Field name displayed as the label on each timeline bar or point',
    })
  ),

  /** Field name to group records into swimlanes */
  groupBy: Schema.optional(
    Schema.String.annotate({
      description: 'Field name to organise records into horizontal swimlanes',
    })
  ),

  /** Field name whose values determine bar colour (using field colour config) */
  colorField: Schema.optional(
    Schema.String.annotate({
      description: 'Field name whose values map to bar colours via the field colour config',
    })
  ),

  /** Default zoom level when the timeline first renders */
  defaultZoom: Schema.optional(
    Schema.Literals(['day', 'week', 'month', 'quarter', 'year']).annotate({
      description: 'Initial zoom level for the time axis (default: month)',
    })
  ),

  /** Whether to show a "today" marker line on the time axis */
  showToday: Schema.Boolean.annotate({
    defaultNote: 'true',
    description: 'Display a vertical marker line at the current date (default true)',
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),

  /** Whether users can drag bars to reschedule (requires dataSource write permission) */
  draggable: Schema.Boolean.annotate({
    description: 'Allow drag-to-reschedule on timeline bars (default false)',
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),

  /** Whether users can resize bars to change duration */
  resizable: Schema.Boolean.annotate({
    description: 'Allow drag-to-resize on timeline bars to change duration (default false)',
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),

  /** Whether to draw dependency arrows between linked tasks */
  showDependencies: Schema.Boolean.annotate({
    description: 'Render dependency arrows between linked tasks (default false)',
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),

  /** Field name containing the dependency references (array of record IDs) */
  dependencyField: Schema.optional(
    Schema.String.annotate({
      description: 'Field name containing an array of predecessor record IDs for dependencies',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'DataTimeline',
    title: 'Data Timeline (Gantt)',
    description:
      'Configuration for a timeline/Gantt component that displays table records as horizontal bars on a time axis',
  })
)

/** @public Public type surface of the timeline schema; awaiting adoption at callsites. */
export type DataTimeline = Schema.Schema.Type<typeof DataTimelineSchema>
/** @public Public type surface of the timeline schema; awaiting adoption at callsites. */
export type TimelineDependency = Schema.Schema.Type<typeof TimelineDependencySchema>
