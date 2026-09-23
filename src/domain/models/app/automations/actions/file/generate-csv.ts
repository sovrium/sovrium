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
 * File Generate CSV Action (type: file, operator: generateCsv)
 *
 * Generate a CSV file from an array of data objects.
 * The generated file is available as the step output for subsequent actions.
 */
export const FileGenerateCsvActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file').pipe(
    Schema.annotate({
      description: "Constant value 'file' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('generateCsv').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'file' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Template variable referencing an array of data objects */
    data: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Template variable referencing an array of objects (e.g., "{{fetchRecords.result}}")',
      })
    ),

    /** Output filename */
    filename: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Output filename (e.g., "export-{{now}}.csv")',
      })
    ),

    /** Column definitions for CSV output */
    columns: Schema.optional(
      Schema.Array(
        Schema.Struct({
          /** Object key to extract as column value (alias of `field`) */
          key: Schema.optional(
            Schema.String.pipe(
              Schema.annotate({
                description: 'Object key to extract as column value',
              })
            )
          ),
          /** Object key to extract as column value */
          field: Schema.optional(
            Schema.String.pipe(
              Schema.annotate({
                description: 'Object key to extract as column value',
              })
            )
          ),
          header: Schema.optional(
            Schema.String.pipe(
              Schema.annotate({
                description: 'Column header name (defaults to key)',
              })
            )
          ),
        })
      ).pipe(
        Schema.annotate({
          description: 'Column definitions. If omitted, all keys from first data item are used.',
        })
      )
    ),

    /** Field delimiter */
    delimiter: Schema.optional(
      Schema.Literals([',', ';', '\t', '|']).pipe(
        Schema.annotate({
          description: 'Field delimiter (default: ",")',
        })
      )
    ),

    /** Include header row */
    includeHeaders: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          description: 'Include column headers as first row (default: true)',
        })
      )
    ),

    /** Storage destination for generated file */
    destination: DestinationPropSchema,
  }).annotate({
    description:
      'The rows to write, their columns and separator, the file name, and where it is written.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'FileGenerateCsvAction',
    title: 'File Generate CSV Action',
    description: 'Generate a CSV file from an array of data objects',
  })
)

/** @public */
export type FileGenerateCsvAction = Schema.Schema.Type<typeof FileGenerateCsvActionSchema>
