/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * File Download Action (type: file, operator: download)
 *
 * Download a file from storage by key.
 * The file content is available as the step output for subsequent actions.
 */
export const FileDownloadActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file').pipe(
    Schema.annotate({
      description: "Constant value 'file' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('download').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'file' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Storage key of the file to download */
    key: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Storage key of the file to download',
      })
    ),
  }).annotate({
    description: 'The file to download.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'FileDownloadAction',
    title: 'File Download Action',
    description: 'Download a file from storage by key',
  })
)

/** @public */
export type FileDownloadAction = Schema.Schema.Type<typeof FileDownloadActionSchema>
