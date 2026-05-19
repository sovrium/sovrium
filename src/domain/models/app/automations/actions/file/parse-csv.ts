/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const FileParseCsvActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('parseCsv'),
  props: Schema.Struct({
    source: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Storage key of the CSV file to parse',
        })
      )
    ),

    key: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Storage key of the CSV file to parse',
        })
      )
    ),

    columns: Schema.optional(
      Schema.Array(
        Schema.Struct({
          key: Schema.optional(
            Schema.String.pipe(
              Schema.annotations({
                description: 'Object key for the parsed value',
              })
            )
          ),
          name: Schema.optional(
            Schema.String.pipe(
              Schema.annotations({
                description: 'Object key for the parsed value',
              })
            )
          ),
          index: Schema.optional(
            Schema.Number.pipe(
              Schema.int(),
              Schema.nonNegative(),
              Schema.annotations({
                description: 'Zero-based CSV column index to read this value from',
              })
            )
          ),
          header: Schema.optional(
            Schema.String.pipe(
              Schema.annotations({
                description: 'CSV column header name (defaults to key)',
              })
            )
          ),
        })
      ).pipe(
        Schema.annotations({
          description: 'Column mapping. If omitted, uses header row as keys.',
        })
      )
    ),

    skipRows: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.nonNegative(),
        Schema.annotations({
          description: 'Number of rows to skip from the top (default: 0)',
        })
      )
    ),

    delimiter: Schema.optional(
      Schema.Literal(',', ';', '\t', '|').pipe(
        Schema.annotations({
          description: 'Field delimiter (default: auto-detect)',
        })
      )
    ),
  }).pipe(
    Schema.filter((props) => (props.source ?? props.key) !== undefined, {
      message: () => 'parseCsv requires `source` (or `key`)',
    })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'FileParseCsvAction',
    title: 'File Parse CSV Action',
    description: 'Parse a CSV file into structured JSON data',
  })
)

export type FileParseCsvAction = Schema.Schema.Type<typeof FileParseCsvActionSchema>
