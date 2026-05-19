/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const FileDeleteActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('delete'),
  props: Schema.Struct({
    key: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Storage key of the file to delete',
      })
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'FileDeleteAction',
    title: 'File Delete Action',
    description: 'Delete a file from storage by key',
  })
)

export type FileDeleteAction = Schema.Schema.Type<typeof FileDeleteActionSchema>
