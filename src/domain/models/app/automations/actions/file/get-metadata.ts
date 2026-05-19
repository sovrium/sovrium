/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const FileGetMetadataActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('getMetadata'),
  props: Schema.Struct({
    key: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Storage key of the file',
      })
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'FileGetMetadataAction',
    title: 'File Get Metadata Action',
    description: 'Get file metadata (size, type, date) without downloading content',
  })
)

export type FileGetMetadataAction = Schema.Schema.Type<typeof FileGetMetadataActionSchema>
