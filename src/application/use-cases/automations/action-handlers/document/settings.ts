/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, Struct } from 'effect'
import {
  DocumentConvertActionSchema,
  DocumentGenerateDocxActionSchema,
  DocumentGenerateImageActionSchema,
  DocumentGeneratePdfActionSchema,
} from '@/domain/models/app/automations/actions/document'
import {
  BinaryTemplateSourceSchema,
  HtmlTemplateSourceSchema,
} from '@/domain/models/app/automations/actions/document/shared'
import {
  FilledDocumentOutput,
  FilledFileRef,
  FilledText,
  OptionalFilledText,
  filledSettings,
} from './filled-settings'

/**
 * The settings a `document/*` handler is dispatched with (see
 * `../decoded-handler.ts`): each operator's declared props, refused when outside
 * them on every road the action comes by, except the ones a template fills
 * (`filled-settings.ts`).
 *
 * Kept as declared, and so refused rather than replaced by a default when a
 * script, an agent or an MCP client hands over a value outside them:
 * `pageSize`, `orientation`, `margins`, `allowRemoteAssets`, `templateType`,
 * `format`, `quality`, `width`, `height`, `preset` and `inputType`. Filled:
 * the template sources (a stored template's `key`), `locale`, `input` and
 * `output`. `data` is read with its types kept from the props as written.
 */

const [assetSource, bucketSource, inlineSource] = HtmlTemplateSourceSchema.members

/** A stored template, its key filled in. */
const filledBucketSource = bucketSource.mapFields(Struct.assign({ key: FilledText }))

/** An HTML template source as its handler reads it. */
export const FilledHtmlSource = Schema.Union([assetSource, filledBucketSource, inlineSource])

/** A binary (.docx, .xlsx) template source as its handler reads it. */
export const FilledBinarySource = Schema.Union([
  BinaryTemplateSourceSchema.members[0],
  filledBucketSource,
])

const filledTemplate = {
  template: FilledHtmlSource,
  locale: OptionalFilledText,
  output: FilledDocumentOutput,
}

export const DocumentGeneratePdfSettings = filledSettings(DocumentGeneratePdfActionSchema, {
  ...filledTemplate,
  header: Schema.optional(FilledHtmlSource),
  footer: Schema.optional(FilledHtmlSource),
})

export const DocumentGenerateImageSettings = filledSettings(
  DocumentGenerateImageActionSchema,
  filledTemplate
)

export const DocumentGenerateDocxSettings = filledSettings(DocumentGenerateDocxActionSchema, {
  ...filledTemplate,
  template: FilledBinarySource,
})

export const DocumentConvertSettings = filledSettings(DocumentConvertActionSchema, {
  input: FilledFileRef,
  output: FilledDocumentOutput,
})
