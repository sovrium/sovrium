/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataSourceSchema } from '../../data-source'
import { SystemDetailSourceSchema } from '../../system-detail-source'
import { coreFields } from '../modules/core'
import { visibilityFields } from '../modules/visibility'

export const RecordFieldTypeLiteral = Schema.Literal('record-field')

export const recordFieldFields = {
  ...coreFields,
  ...visibilityFields,
  dataSource: Schema.optional(
    Schema.Union(
      DataSourceSchema,
      Schema.Struct({
        system: SystemDetailSourceSchema,
      }).annotations({
        title: 'Record Field System Detail Source',
        description: 'System detail-endpoint binding for a self-binding record-field',
      })
    ).annotations({
      identifier: 'RecordFieldDataSource',
      title: 'Record Field Data Source',
      description:
        'Optional own single-record binding: a DB-table source (DataSource) OR a system detail-endpoint binding',
    })
  ),
} as const
