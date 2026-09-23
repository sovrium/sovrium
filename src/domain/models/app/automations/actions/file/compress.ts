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

/**
 * File Compress Action (type: file, operator: compress)
 *
 * Create a ZIP archive from one or more storage files.
 * The archive is available as the step output for subsequent actions.
 */
export const FileCompressActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file').pipe(
    Schema.annotate({
      description: "Constant value 'file' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('compress').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'file' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Array of storage keys to compress into the archive */
    keys: Schema.optional(
      Schema.Array(TemplateStringSchema).pipe(
        Schema.annotate({
          description: 'Array of storage keys to compress into the archive',
        })
      )
    ),

    /** Template resolving to array of storage keys to compress (alias of `keys`) */
    files: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Template resolving to array of storage keys to compress',
        })
      )
    ),

    /** Output archive filename */
    filename: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Output archive filename',
        })
      )
    ),

    /** Storage destination for the archive */
    destination: DestinationPropSchema,
  })
    .annotate({
      description: 'The files to archive, the name of the archive, and where it is written.',
    })
    .pipe(
      Schema.check(
        Schema.makeFilter((props) => (props.keys ?? props.files) !== undefined, {
          message: 'compress requires `keys` (or `files`)',
        })
      )
    ),
}).pipe(
  Schema.annotate({
    identifier: 'FileCompressAction',
    title: 'File Compress Action',
    description: 'Create a ZIP archive from one or more storage files',
  })
)

/** @public */
export type FileCompressAction = Schema.Schema.Type<typeof FileCompressActionSchema>
