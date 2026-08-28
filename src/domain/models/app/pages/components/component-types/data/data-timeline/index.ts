/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'

// ---------------------------------------------------------------------------
// Timeline zoom levels
// ---------------------------------------------------------------------------

/**
 * Supported zoom levels for the time axis of a data-timeline component.
 */
export const TimelineZoomSchema = Schema.Literals(['day', 'week', 'month', 'quarter', 'year']).pipe(
  Schema.annotate({
    title: 'Timeline Zoom',
    description: 'Time-axis granularity for the data-timeline component',
  })
)

/** @public */
export type TimelineZoom = Schema.Schema.Type<typeof TimelineZoomSchema>

// ---------------------------------------------------------------------------
// Component type definition
// ---------------------------------------------------------------------------

export const DataTimelineTypeLiteral = Schema.Literal('data-timeline')

/**
 * data-timeline component fields.
 *
 * The data-timeline plots table records as horizontal bars (or point markers
 * for records with only a start date) on a shared time axis. Its display
 * configuration — `startField`, `endField`, `labelField`, `groupBy`,
 * `colorField`, `defaultZoom` — is supplied inside the freeform `props`
 * object (see {@link coreFields}), so no typed timeline sub-schema is needed
 * at the union level.
 */
export const dataTimelineFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
} as const
