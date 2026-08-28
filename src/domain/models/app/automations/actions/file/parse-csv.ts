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
 * File Parse CSV Action (type: file, operator: parseCsv)
 *
 * Parse a CSV file into structured JSON data.
 * The parsed data is available as the step output for subsequent actions.
 */
export const FileParseCsvActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('parseCsv'),
  props: Schema.Struct({
    /** Storage key of the CSV file to parse */
    source: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Storage key of the CSV file to parse',
        })
      )
    ),

    /** Storage key of the CSV file to parse (alias of `source`) */
    key: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Storage key of the CSV file to parse',
        })
      )
    ),

    /**
     * Inline CSV text to parse, bypassing storage entirely.
     *
     * Mutually complementary with `source`/`key`: supplying `content` lets an
     * automation parse CSV that already exists in the run context (a webhook
     * body, a previous step's text output) without a storage round-trip.
     */
    content: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Inline CSV text to parse (alternative to `source`/`key`)',
        })
      )
    ),

    /** Column mapping */
    columns: Schema.optional(
      Schema.Array(
        Schema.Struct({
          /** Object key for the parsed value (alias of `name`) */
          key: Schema.optional(
            Schema.String.pipe(
              Schema.annotate({
                description: 'Object key for the parsed value',
              })
            )
          ),
          /** Object key for the parsed value */
          name: Schema.optional(
            Schema.String.pipe(
              Schema.annotate({
                description: 'Object key for the parsed value',
              })
            )
          ),
          /** Zero-based CSV column index this entry maps to */
          index: Schema.optional(
            Schema.Finite.pipe(
              Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
              Schema.annotate({
                description: 'Zero-based CSV column index to read this value from',
              })
            )
          ),
          header: Schema.optional(
            Schema.String.pipe(
              Schema.annotate({
                description: 'CSV column header name (defaults to key)',
              })
            )
          ),
        })
      ).pipe(
        Schema.annotate({
          description: 'Column mapping. If omitted, uses header row as keys.',
        })
      )
    ),

    /** Number of rows to skip from the top */
    skipRows: Schema.optional(
      Schema.Finite.pipe(
        Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
        Schema.annotate({
          description: 'Number of rows to skip from the top (default: 0)',
        })
      )
    ),

    /** Field delimiter */
    delimiter: Schema.optional(
      Schema.Literals([',', ';', '\t', '|']).pipe(
        Schema.annotate({
          description: 'Field delimiter (default: auto-detect)',
        })
      )
    ),
  }).pipe(
    Schema.check(
      Schema.makeFilter((props) => (props.source ?? props.key ?? props.content) !== undefined, {
        message: 'parseCsv requires `source` (or `key`, or inline `content`)',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'FileParseCsvAction',
    title: 'File Parse CSV Action',
    description: 'Parse a CSV file into structured JSON data',
  })
)

/** @public */
export type FileParseCsvAction = Schema.Schema.Type<typeof FileParseCsvActionSchema>
