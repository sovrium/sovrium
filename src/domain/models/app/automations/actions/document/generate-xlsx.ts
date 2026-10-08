/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import {
  BinaryTemplateSourceSchema,
  DocumentOutputSchema,
  TemplateDataSchema,
  TemplateLocaleSchema,
} from './shared'

/**
 * Column definition shared by the single-sheet and multi-sheet forms.
 *
 * Mirrors `file/generateCsv`'s column shape — `key`/`field` are aliases for the
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
 * Document Generate XLSX Action (type: document, operator: generateXlsx)
 *
 * Write an `.xlsx` workbook from row data.
 *
 * Moved from `file/generateXlsx` with its behaviour kept; the only change is
 * where the file goes — `output` replaces `filename` + `destination`, so the
 * workbook follows the family's output rules.
 *
 * ## Two modes, told apart by `template`
 *
 * - **From data** (no `template`): `data` is ONE template naming the rows of a
 *   single sheet, or `sheets` lists several; the writer below builds the
 *   workbook from nothing.
 * - **Template fill** (`template` set): a designed `.xlsx` is filled. `data`
 *   is then the template's values — an object of names, like every other
 *   `document/*` operator — and `sheets`, `columns` and `sheetName` are
 *   refused, since the template already says what the sheets and columns are.
 *   Cells holding `{{ }}` tags are filled, a row opening `{{#each}}` in its
 *   first cell and closing `{{/each}}` in its last repeats per item, and
 *   everything else — styles, number formats, formulas, merged cells, column
 *   widths — is kept as the template has it.
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
export const DocumentGenerateXlsxActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('document').pipe(
    Schema.annotate({
      description: "Constant value 'document' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('generateXlsx').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'document' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** A designed workbook to fill; its presence selects the template-fill mode. */
    template: Schema.optional(
      BinaryTemplateSourceSchema.pipe(
        Schema.annotate({
          description:
            'A designed .xlsx to fill: { asset: <path> } or { key, bucket? }. With it, cells holding {{ }} tags are filled from data and everything else in the workbook is kept; without it, the workbook is written from rows.',
        })
      )
    ),

    /**
     * Without `template`: one template naming the rows of the single output
     * sheet — an array of objects (keys become columns) or of arrays
     * (positional cells); mutually exclusive with `sheets`. With `template`:
     * the template's values, an object of names.
     */
    data: Schema.optional(
      Schema.Union([
        TemplateStringSchema.pipe(
          Schema.annotate({
            description:
              'Without template: one template naming an array of row objects or row arrays (e.g., "{{steps.fetchRecords.result}}")',
          })
        ),
        TemplateDataSchema,
      ]).pipe(
        Schema.annotate({
          description:
            'Without template, the rows of the single sheet ("{{steps.fetchRecords.result}}"); with template, the values its tags read by name ({ invoice: "{{trigger.data}}" }).',
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

    /** Language the template-fill mode renders in */
    locale: Schema.optional(TemplateLocaleSchema),

    /** Where the workbook is written */
    output: DocumentOutputSchema,
  })
    .annotate({
      description:
        'The workbook template and its values, or the rows and sheets to write and their columns, and where the workbook is written.',
    })
    .pipe(
      Schema.check(
        Schema.makeFilter(
          (props) =>
            props.template === undefined ||
            (props.sheets === undefined &&
              props.columns === undefined &&
              props.sheetName === undefined),
          {
            message:
              'with `template`, generateXlsx fills that workbook: `sheets`, `columns` and `sheetName` belong to writing a workbook from rows; remove them',
          }
        ),
        Schema.makeFilter(
          (props) =>
            props.template === undefined ||
            props.data === undefined ||
            typeof props.data !== 'string',
          {
            message:
              "with `template`, `data` is the template's values — an object of names such as { invoice: '{{trigger.data}}' } — not a list of rows",
          }
        ),
        Schema.makeFilter(
          (props) =>
            props.template !== undefined ||
            ((props.data === undefined) !== (props.sheets === undefined) &&
              (props.data === undefined || typeof props.data === 'string')),
          {
            message:
              'without `template`, generateXlsx requires exactly one of `data` (one template naming the rows of a single sheet) or `sheets`',
          }
        )
      )
    ),
}).pipe(
  Schema.annotate({
    identifier: 'DocumentGenerateXlsxAction',
    title: 'Document Generate XLSX Action',
    description: 'Generate an .xlsx workbook from row data, or fill a designed .xlsx template',
  })
)

/** @public */
export type DocumentGenerateXlsxAction = Schema.Schema.Type<typeof DocumentGenerateXlsxActionSchema>
