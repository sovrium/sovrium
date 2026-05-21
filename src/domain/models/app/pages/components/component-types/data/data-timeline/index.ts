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


export const TimelineZoomSchema = Schema.Literal('day', 'week', 'month', 'quarter', 'year').pipe(
  Schema.annotations({
    title: 'Timeline Zoom',
    description: 'Time-axis granularity for the data-timeline component',
  })
)

export type TimelineZoom = Schema.Schema.Type<typeof TimelineZoomSchema>


export const DataTimelineTypeLiteral = Schema.Literal('data-timeline')

export const dataTimelineFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
} as const
