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
 * File List Action (type: file, operator: list)
 *
 * List files in storage by key prefix.
 * The list of file metadata is available as the step output for subsequent actions.
 */
export const FileListActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file').pipe(
    Schema.annotate({
      description: "Constant value 'file' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('list').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'file' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Storage key prefix to list files under */
    prefix: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Storage key prefix to list files under',
      })
    ),

    /** Maximum number of files to return */
    limit: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Maximum number of files to return',
        }),
        Schema.check(Schema.isGreaterThan(0), Schema.isInt())
      )
    ),
  }).annotate({
    description: 'Which files are listed, and how many at most.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'FileListAction',
    title: 'File List Action',
    description: 'List files in storage by key prefix',
  })
)

/** @public */
export type FileListAction = Schema.Schema.Type<typeof FileListActionSchema>
