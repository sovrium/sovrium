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
 * File Parse XLSX Action (type: file, operator: parseXlsx)
 *
 * Read a sheet out of an `.xlsx` workbook into an array of rows.
 *
 * ## The closed OOXML subset
 *
 * This action deliberately supports a NAMED, CLOSED subset of SpreadsheetML
 * rather than the format at large:
 *
 * - shared strings (`xl/sharedStrings.xml`) and inline strings (`t="inlineStr"`)
 * - numbers, and booleans (`t="b"`)
 * - dates, recognised via the cell's `numFmt` (an Excel date serial is
 *   otherwise indistinguishable from a plain number)
 * - formulas, read as their CACHED value (`<v>`); the expression is not evaluated
 *
 * The refusal boundary falls at DATA OUTSIDE THE CELL GRID. A package carrying
 * a chart, a drawing, an embedded image, a pivot table or a macro is REFUSED
 * with a named error rather than silently misparsed — reading it would hand
 * back the cells and quietly drop the part of the document the author cared
 * about. Refusal is detected on both the ZIP part paths and the
 * `[Content_Types].xml` overrides, since the two can disagree.
 *
 * Cosmetic style records — fonts, fills, borders — are NOT refused; they are
 * ignored. They carry no data, and refusing them would refuse essentially every
 * real workbook, which makes the action useless rather than safe. The one style
 * fact this reader consumes is `numFmt`, because in OOXML a date is a plain
 * number plus a date format and nothing else.
 *
 * That boundary is the whole reason a hand-rolled reader is defensible here:
 * without it, this is an open-ended format-compatibility project. A workbook
 * that leans on an unsupported feature must fail loudly and name the feature,
 * so the operator converts the file rather than trusting a wrong answer.
 *
 * ## Output
 *
 * `{{steps.<name>.data}}` is an array of rows; the step output additionally
 * carries `sheetName`, `sheetNames`, `rowCount` and `columns`. `sheetNames` is
 * what lets an automation discover the workbook's sheets on a first call and
 * target a specific one on a second.
 */
export const FileParseXlsxActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('parseXlsx'),
  props: Schema.Struct({
    /** Storage key of the workbook to parse */
    source: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Storage key of the .xlsx workbook to parse. Also accepts a `data:` URI or an https:// URL.',
        })
      )
    ),

    /** Storage key of the workbook to parse (alias of `source`) */
    key: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Storage key of the .xlsx workbook to parse (alias of `source`)',
        })
      )
    ),

    /**
     * Which sheet to read — by name, or by zero-based position.
     *
     * Omitted, the FIRST sheet in the workbook's declared order is read. A
     * number selects positionally; any other value is matched against the
     * sheet name.
     */
    sheet: Schema.optional(
      Schema.Union([
        TemplateStringSchema,
        Schema.Finite.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))),
      ]).pipe(
        Schema.annotate({
          description:
            'Sheet to read: a sheet name, or a zero-based sheet index (default: first sheet)',
        })
      )
    ),

    /**
     * Treat the first read row as a header row.
     *
     * When true the first row is lifted out of `data` and reported as
     * `columns`; when false (the default) every row lands in `data` and
     * `columns` is empty.
     */
    header: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          description:
            'Treat the first row as a header row — it becomes `columns` and is excluded from `data` (default: false)',
        })
      )
    ),

    /**
     * Restrict reading to an A1-style rectangle, e.g. `"A1:C10"`.
     *
     * Left unvalidated at config-decode time on purpose: the value is a
     * template string, so a literal pattern check would reject a legitimate
     * `"{{trigger.data.range}}"`. A malformed range is refused at RUN time with
     * a named error instead.
     */
    range: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'A1-style range to read, e.g. "A1:C10" (default: the sheet\'s full used range)',
        })
      )
    ),

    /** Number of rows to skip from the top, applied before `header` */
    skipRows: Schema.optional(
      Schema.Finite.pipe(
        Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
        Schema.annotate({
          description:
            'Number of rows to skip from the top, applied before `header` is taken (default: 0)',
        })
      )
    ),
  }).pipe(
    Schema.check(
      Schema.makeFilter((props) => (props.source ?? props.key) !== undefined, {
        message: 'parseXlsx requires `source` (or `key`)',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'FileParseXlsxAction',
    title: 'File Parse XLSX Action',
    description: 'Parse a sheet of an .xlsx workbook into structured row data',
  })
)

/** @public */
export type FileParseXlsxAction = Schema.Schema.Type<typeof FileParseXlsxActionSchema>
