/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const TimelineDependencySchema = Schema.Struct({
  from: Schema.String.annotations({ description: 'Record ID of the predecessor task' }),

  to: Schema.String.annotations({ description: 'Record ID of the successor task' }),

  type: Schema.optional(
    Schema.Literal('FS', 'SS', 'FF', 'SF').annotations({
      description:
        'Dependency type: FS (finish-to-start), SS (start-to-start), FF (finish-to-finish), SF (start-to-finish)',
    })
  ),
}).annotations({
  identifier: 'TimelineDependency',
  title: 'Timeline Dependency',
  description: 'Dependency link between two timeline items for drawing arrows',
})

export const DataTimelineSchema = Schema.Struct({
  startField: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'Field name for the start date of each timeline bar' })
  ),

  endField: Schema.optional(
    Schema.String.annotations({
      description:
        'Field name for the end date; records without end date render as point/diamond markers',
    })
  ),

  labelField: Schema.optional(
    Schema.String.annotations({
      description: 'Field name displayed as the label on each timeline bar or point',
    })
  ),

  groupBy: Schema.optional(
    Schema.String.annotations({
      description: 'Field name to organise records into horizontal swimlanes',
    })
  ),

  colorField: Schema.optional(
    Schema.String.annotations({
      description: 'Field name whose values map to bar colours via the field colour config',
    })
  ),

  defaultZoom: Schema.optional(
    Schema.Literal('day', 'week', 'month', 'quarter', 'year').annotations({
      description: 'Initial zoom level for the time axis (default: month)',
    })
  ),

  showToday: Schema.optionalWith(
    Schema.Boolean.annotations({
      description: 'Display a vertical marker line at the current date (default true)',
    }),
    { default: () => true }
  ),

  draggable: Schema.optionalWith(
    Schema.Boolean.annotations({
      description: 'Allow drag-to-reschedule on timeline bars (default false)',
    }),
    { default: () => false }
  ),

  resizable: Schema.optionalWith(
    Schema.Boolean.annotations({
      description: 'Allow drag-to-resize on timeline bars to change duration (default false)',
    }),
    { default: () => false }
  ),

  showDependencies: Schema.optionalWith(
    Schema.Boolean.annotations({
      description: 'Render dependency arrows between linked tasks (default false)',
    }),
    { default: () => false }
  ),

  dependencyField: Schema.optional(
    Schema.String.annotations({
      description: 'Field name containing an array of predecessor record IDs for dependencies',
    })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'DataTimeline',
    title: 'Data Timeline (Gantt)',
    description:
      'Configuration for a timeline/Gantt component that displays table records as horizontal bars on a time axis',
  })
)

export type DataTimeline = Schema.Schema.Type<typeof DataTimelineSchema>
export type TimelineDependency = Schema.Schema.Type<typeof TimelineDependencySchema>
