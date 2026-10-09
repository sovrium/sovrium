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
 * File Get Metadata Action (type: file, operator: getMetadata)
 *
 * Get a stored file's catalogue entry without downloading its bytes. The
 * step output carries `key`, `contentType`, `size` and `lastModified`, plus
 * `uploadedBy` and `generatedBy` when the catalogue records them.
 */
export const FileGetMetadataActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file').pipe(
    Schema.annotate({
      description: "Constant value 'file' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('getMetadata').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'file' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Storage key of the file */
    key: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Storage key of the file',
      })
    ),
  }).annotate({
    description: 'The file whose catalogue entry is read.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'FileGetMetadataAction',
    title: 'File Get Metadata Action',
    description:
      "Read a stored file's metadata without downloading it. The step output carries `key`, `contentType`, `size` (bytes) and `lastModified` (ISO 8601), plus `uploadedBy` (the id of the user who uploaded it, signed in or through an API key) and `generatedBy` (the automation whose document action wrote it), each present only when recorded. A key with no stored file leaves `error` in the output instead.",
  })
)

/** @public */
export type FileGetMetadataAction = Schema.Schema.Type<typeof FileGetMetadataActionSchema>
