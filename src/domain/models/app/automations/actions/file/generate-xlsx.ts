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
 * Column definition shared by the single-sheet and multi-sheet forms.
 *
 * Mirrors `generateCsv`'s column shape — `key`/`field` are aliases for the
 * object key to read, `header` overrides the emitted header label — so an
 * author converting a CSV export to XLSX moves the same block across.
 */
const XlsxColumnSchema = Schema.Struct({
  /** Object key to extract as column value (alias of `field`) */
  key: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'Object key to extract as column value' }))
  ),
  /** Object key to extract as column value */
  field: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'Object key to extract as column value' }))
  ),
  header: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'Column header name (defaults to key)' }))
  ),
})

/**
 * File Generate XLSX Action (type: file, operator: generateXlsx)
 *
 * Write an `.xlsx` workbook from row data.
 *
 * ## The closed OOXML subset
 *
 * The writer emits the MINIMAL part set an `.xlsx` consumer requires:
 * `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml` and its rels,
 * one `xl/worksheets/sheetN.xml` per sheet, and `xl/sharedStrings.xml`. A
 * `xl/styles.xml` is added only when at least one date cell is written, since
 * an Excel date is a number plus a number format and nothing else.
 *
 * It emits no charts, drawings, images, pivot tables or macros, and no
 * cosmetic styling (fonts, fills, borders) — the same closed subset
 * `parseXlsx` reads. The refusal that IS enforced is per CELL VALUE: a value
 * outside string / number / boolean / date — an object, an array, a bigint,
 * `NaN`, `Infinity`, an invalid `Date` — fails the step with a named error
 * citing the sheet and the A1 reference, rather than being coerced to a
 * plausible-looking string that would only be discovered downstream in Excel.
 *
 * Round-tripping `generateXlsx` → `parseXlsx` is therefore lossless WITHIN the
 * subset, and only within it.
 */
export const FileGenerateXlsxActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('generateXlsx'),
  props: Schema.Struct({
    /**
     * Template variable referencing the rows of the single output sheet.
     *
     * Accepts an array of objects (keys become columns) or an array of arrays
     * (positional cells). Mutually exclusive with `sheets`.
     */
    data: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Template variable referencing an array of row objects or row arrays (e.g., "{{fetchRecords.result}}")',
        })
      )
    ),

    /**
     * Multi-sheet form: one entry per worksheet, in emitted order.
     *
     * Mutually exclusive with the single-sheet `data`/`sheetName` pair.
     */
    sheets: Schema.optional(
      Schema.Array(
        Schema.Struct({
          /** Worksheet name as it appears on the tab */
          name: TemplateStringSchema.pipe(
            Schema.annotate({ description: 'Worksheet name as it appears on the tab' })
          ),
          /** Template variable referencing this sheet's rows */
          data: TemplateStringSchema.pipe(
            Schema.annotate({ description: "Template variable referencing this sheet's rows" })
          ),
          /** Per-sheet column definitions */
          columns: Schema.optional(
            Schema.Array(XlsxColumnSchema).pipe(
              Schema.annotate({ description: 'Column definitions for this sheet' })
            )
          ),
        })
      ).pipe(
        Schema.annotate({
          description: 'Multi-sheet output, one entry per worksheet (alternative to `data`)',
        })
      )
    ),

    /** Column definitions for the single-sheet form */
    columns: Schema.optional(
      Schema.Array(XlsxColumnSchema).pipe(
        Schema.annotate({
          description: 'Column definitions. If omitted, all keys from first data item are used.',
        })
      )
    ),

    /** Worksheet name for the single-sheet form */
    sheetName: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({ description: 'Worksheet name for the single sheet (default: "Sheet1")' })
      )
    ),

    /** Output filename */
    filename: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Output filename (e.g., "export-{{now}}.xlsx")',
      })
    ),

    /** Storage destination for generated file */
    destination: DestinationPropSchema,
  }).pipe(
    Schema.check(
      Schema.makeFilter((props) => (props.data === undefined) !== (props.sheets === undefined), {
        message: 'generateXlsx requires exactly one of `data` (single sheet) or `sheets`',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'FileGenerateXlsxAction',
    title: 'File Generate XLSX Action',
    description: 'Generate an .xlsx workbook from row data',
  })
)

/** @public */
export type FileGenerateXlsxAction = Schema.Schema.Type<typeof FileGenerateXlsxActionSchema>
