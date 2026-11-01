/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, Struct } from 'effect'
import { DocumentGenerateXlsxActionSchema } from '@/domain/models/app/automations/actions/document'
import {
  FileCompressActionSchema,
  FileCopyActionSchema,
  FileDeleteActionSchema,
  FileDownloadActionSchema,
  FileExtractAudioActionSchema,
  FileExtractTextActionSchema,
  FileGenerateCsvActionSchema,
  FileGetMetadataActionSchema,
  FileListActionSchema,
  FileMoveActionSchema,
  FileParseCsvActionSchema,
  FileParseXlsxActionSchema,
  FileSignUrlActionSchema,
  FileTransformImageActionSchema,
  FileUploadActionSchema,
} from '@/domain/models/app/automations/actions/file'
import {
  FilledDocumentOutput,
  FilledText,
  OptionalFilledText,
  filledSettings,
} from '../document/filled-settings'
import { FilledBinarySource } from '../document/settings'

/**
 * The settings a `file/*` handler (and `document/generateXlsx`, which shares
 * the `.xlsx` codec) is dispatched with (see `../decoded-handler.ts`): each
 * operator's declared props, refused when outside them on every road the
 * action comes by, except the ones a template fills
 * (`../document/filled-settings.ts`).
 *
 * Kept as declared, and so refused rather than read leniently when a script,
 * an agent or an MCP client hands over a value outside them: `bucket`,
 * `delimiter`, `includeHeaders`, `columns`, `skipRows`, `header`, `limit`,
 * `expiresIn`, `operation`, `format`, `outputFormat`, `fit`, `width`,
 * `height` and `quality`. Filled: every storage key, path, source,
 * destination, file name, content type, range and header value; and the
 * values a whole template names as a list (`data`, `keys`, `files`, a sheet's
 * rows) or an attachment value (`extractAudio`'s `source`), read where the
 * handler reads them.
 */

const optionalDestination = { destination: OptionalFilledText }

export const FileUploadSettings = filledSettings(FileUploadActionSchema, {
  source: FilledText,
  path: OptionalFilledText,
  headers: Schema.optional(Schema.Record(Schema.String, FilledText)),
  contentType: OptionalFilledText,
})

export const FileDownloadSettings = filledSettings(FileDownloadActionSchema, { key: FilledText })

export const FileGetMetadataSettings = filledSettings(FileGetMetadataActionSchema, {
  key: FilledText,
})

export const FileDeleteSettings = filledSettings(FileDeleteActionSchema, { key: FilledText })

export const FileListSettings = filledSettings(FileListActionSchema, { prefix: FilledText })

const filledKeys = { sourceKey: FilledText, destinationKey: FilledText }

export const FileMoveSettings = filledSettings(FileMoveActionSchema, filledKeys)

export const FileCopySettings = filledSettings(FileCopyActionSchema, filledKeys)

export const FileSignUrlSettings = filledSettings(FileSignUrlActionSchema, {
  key: FilledText,
  contentType: OptionalFilledText,
})

export const FileParseCsvSettings = filledSettings(FileParseCsvActionSchema, {
  source: OptionalFilledText,
  key: OptionalFilledText,
  content: OptionalFilledText,
})

export const FileGenerateCsvSettings = filledSettings(FileGenerateCsvActionSchema, {
  data: Schema.Unknown,
  filename: FilledText,
  ...optionalDestination,
})

export const FileCompressSettings = filledSettings(FileCompressActionSchema, {
  keys: Schema.optional(Schema.Unknown),
  files: Schema.optional(Schema.Unknown),
  filename: OptionalFilledText,
  ...optionalDestination,
})

const filledSourceKey = { key: OptionalFilledText, source: OptionalFilledText }

export const FileExtractTextSettings = filledSettings(FileExtractTextActionSchema, filledSourceKey)

export const FileTransformImageSettings = filledSettings(FileTransformImageActionSchema, {
  ...filledSourceKey,
  ...optionalDestination,
})

export const FileExtractAudioSettings = filledSettings(FileExtractAudioActionSchema, {
  source: Schema.Unknown,
  ...optionalDestination,
})

/** A sheet named by number is read by position, by text by name. */
export const FileParseXlsxSettings = filledSettings(FileParseXlsxActionSchema, {
  ...filledSourceKey,
  sheet: Schema.optional(Schema.Union([Schema.Finite, FilledText])),
  range: OptionalFilledText,
})

const generateXlsxProps = DocumentGenerateXlsxActionSchema.fields.props
const sheetSchema = generateXlsxProps.fields.sheets.schema.members[0].value

/**
 * `document/generateXlsx`: its rows (`data`, each sheet's `data`) are a list a
 * whole template names, read with their types kept. The rules on which
 * settings go together are the declared ones, judged on the filled shape:
 * a template's `data` names values, never rows.
 */
export const DocumentGenerateXlsxSettings = Schema.Struct({
  type: DocumentGenerateXlsxActionSchema.fields.type,
  operator: DocumentGenerateXlsxActionSchema.fields.operator,
  props: generateXlsxProps
    .mapFields(
      Struct.assign({
        template: Schema.optional(FilledBinarySource),
        data: Schema.optional(Schema.Unknown),
        sheets: Schema.optional(
          Schema.Array(
            sheetSchema.mapFields(Struct.assign({ name: FilledText, data: Schema.Unknown }))
          )
        ),
        sheetName: OptionalFilledText,
        locale: OptionalFilledText,
        output: FilledDocumentOutput,
      })
    )
    .check(
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
          (props.data === undefined) !== (props.sheets === undefined),
        {
          message:
            'without `template`, generateXlsx requires exactly one of `data` (the rows of a single sheet) or `sheets`',
        }
      )
    ),
})
