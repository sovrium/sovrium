/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { DestinationPropSchema } from './shared'

export const FileCompressActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('compress'),
  props: Schema.Struct({
    files: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Template resolving to array of storage keys to compress',
      })
    ),

    filename: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Output archive filename',
      })
    ),

    destination: DestinationPropSchema,
  }),
}).pipe(
  Schema.annotations({
    identifier: 'FileCompressAction',
    title: 'File Compress Action',
    description: 'Create a ZIP archive from one or more storage files',
  })
)

export type FileCompressAction = Schema.Schema.Type<typeof FileCompressActionSchema>
