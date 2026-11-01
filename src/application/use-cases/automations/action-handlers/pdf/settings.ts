/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, Struct } from 'effect'
import {
  PdfFillFormActionSchema,
  PdfFromImagesActionSchema,
  PdfInspectActionSchema,
  PdfMergeActionSchema,
  PdfPagesActionSchema,
  PdfSplitActionSchema,
  PdfStampActionSchema,
  PdfWatermarkActionSchema,
} from '@/domain/models/app/automations/actions/pdf'
import {
  FilledDocumentOutput,
  FilledFileRef,
  FilledText,
  OptionalFilledText,
  filledSettings,
} from '../document/filled-settings'

/**
 * The settings a `pdf/*` handler is dispatched with (see `../decoded-handler.ts`):
 * each operator's declared props, refused when outside them on every road the
 * action comes by, except the ones a template fills (`../document/filled-settings.ts`).
 *
 * Kept as declared, and so refused rather than replaced by a default when a
 * script, an agent or an MCP client hands over a value outside them: `every`,
 * `ranges`, `angle`, `opacity`, `fontSize`, `color`, `position`, `at`,
 * `margin`, `width`, `pageNumbers`, `pageSize`, `orientation`, `fit` and
 * `flatten`. Filled: the file references (`file`, `image`, `inputs`, `images`),
 * `fields` (a map, or one template naming one), `text`, `pages` and `output`.
 */

const filledFile = { file: FilledFileRef, output: FilledDocumentOutput }

const filledMark = {
  ...filledFile,
  text: OptionalFilledText,
  image: Schema.optional(FilledFileRef),
  pages: OptionalFilledText,
}

export const PdfMergeSettings = filledSettings(PdfMergeActionSchema, {
  inputs: FilledFileRef,
  output: FilledDocumentOutput,
})

export const PdfSplitSettings = filledSettings(PdfSplitActionSchema, filledFile)

export const PdfWatermarkSettings = filledSettings(PdfWatermarkActionSchema, filledMark)

export const PdfStampSettings = filledSettings(PdfStampActionSchema, filledMark)

export const PdfFillFormSettings = filledSettings(PdfFillFormActionSchema, {
  ...filledFile,
  fields: Schema.Unknown,
})

export const PdfInspectSettings = filledSettings(PdfInspectActionSchema, { file: FilledFileRef })

export const PdfFromImagesSettings = filledSettings(PdfFromImagesActionSchema, {
  images: FilledFileRef,
  output: FilledDocumentOutput,
})

/** `pdf/pages`: one shape per page operation, each with its file, pages and output filled. */
const [deletePages, extractPages, reorderPages, rotatePages] =
  PdfPagesActionSchema.fields.props.members

export const PdfPagesSettings = Schema.Struct({
  type: PdfPagesActionSchema.fields.type,
  operator: PdfPagesActionSchema.fields.operator,
  props: Schema.Union([
    deletePages.mapFields(Struct.assign({ ...filledFile, pages: FilledText })),
    extractPages.mapFields(Struct.assign({ ...filledFile, pages: FilledText })),
    reorderPages.mapFields(Struct.assign({ ...filledFile, pages: FilledText })),
    rotatePages.mapFields(Struct.assign({ ...filledFile, pages: OptionalFilledText })),
  ]),
})
