/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { commonFieldProps } from '../../../shared/form-field-props'

export const TableBoundFieldSchema = Schema.Struct({
  kind: Schema.Literal('table-field'),
  column: Schema.String.pipe(Schema.minLength(1)),
  accept: Schema.optional(Schema.String),
  maxFileSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))),
  maxFiles: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))),
  dropZone: Schema.optional(Schema.Boolean),
  ...commonFieldProps,
}).annotations({
  identifier: 'TableBoundField',
  title: 'Table-Bound Form Field',
  description: 'Form field bound to a column on submitTo.table',
})

export type TableBoundField = Schema.Schema.Type<typeof TableBoundFieldSchema>
