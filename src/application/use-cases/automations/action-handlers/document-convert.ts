/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { DocumentRenderer } from '@/application/ports/services/document-renderer'
import { OfficeConverter } from '@/application/ports/services/office-converter'
import { PdfEditor } from '@/application/ports/services/pdf-editor'
import { PdfToolkit } from '@/application/ports/services/pdf-toolkit'
import { sniffContentType } from '@/domain/kernel/identity/content-sniff'
import { sanitizeOfficePackage } from '../ooxml/office-package-sanitize'
import { sanitizeOpenDocumentPackage } from '../ooxml/opendocument-sanitize'
import { resolveFileRef, type FileRefScope } from './document-file-ref'
import { writeGeneratedFile } from './document-output'
import {
  actionPropsOf,
  documentAssetResolver,
  outputPropOf,
  runDocumentAction,
  typedOwnProp,
  type Raw,
} from './document-run'
import { fileRefOf } from './file-ref-origin'
import { actionAttributes, type ActionHandler } from './shared'

/**
 * `document/convert`: an existing file turned into a PDF, as it is — nothing
 * in it is templated.
 *
 * - Word, Excel, PowerPoint and OpenDocument files go to the office engine
 *   (`OFFICE_*`) under a fixed name of ours carrying only their extension
 *   (`input.docx`), so LibreOffice reads each as what it is and the name the
 *   file was stored or generated under never reaches the engine. Each package
 *   first loses its external links (`ooxml/office-package-sanitize.ts`,
 *   `ooxml/opendocument-sanitize.ts`). RTF is not accepted: its fetching
 *   constructs are control words in free text, with no package to clean.
 * - HTML goes to the browser engine, in the sandbox of every HTML render.
 * - A PNG, JPEG or WebP becomes one page, laid out as `pdf/fromImages` does by
 *   default; no engine is needed.
 *
 * The type is `inputType`, else the stored content type, else the file name's
 * extension. The engine's answer is stored only when it is a PDF.
 */

type InputType = 'docx' | 'xlsx' | 'pptx' | 'odt' | 'ods' | 'odp' | 'html' | 'image'

/** The file could not be converted; the message starts with the reason. */
class ConvertFailed extends Data.TaggedError('ConvertFailed')<{ readonly message: string }> {}

const OOXML_TYPES: ReadonlySet<string> = new Set(['docx', 'xlsx', 'pptx'])
const OPENDOCUMENT_TYPES: ReadonlySet<string> = new Set(['odt', 'ods', 'odp'])
const OFFICE_TYPES: ReadonlySet<string> = new Set([...OOXML_TYPES, ...OPENDOCUMENT_TYPES])
const ACCEPTED = 'docx, xlsx, pptx, odt, ods, odp, html, png, jpeg and webp'

/** The name every office file reaches the engine under: ours, only its type kept. */
const officeInputName = (type: string): string => `input.${type}`

const BY_CONTENT_TYPE: Readonly<Record<string, InputType>> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.oasis.opendocument.presentation': 'odp',
  'text/html': 'html',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
}

const BY_EXTENSION: Readonly<Record<string, InputType>> = {
  docx: 'docx',
  xlsx: 'xlsx',
  pptx: 'pptx',
  odt: 'odt',
  ods: 'ods',
  odp: 'odp',
  html: 'html',
  htm: 'html',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
}

const extensionOf = (name: string): string | undefined =>
  /\.([^./]+)$/.exec(name)?.[1]?.toLowerCase()

/** What the file is: the step's `inputType`, else its content type, else its extension. */
const inputTypeOf = (
  declared: unknown,
  file: { readonly filename: string; readonly contentType: string }
): InputType | undefined => {
  if (
    typeof declared === 'string' &&
    (declared === 'html' || declared === 'image' || OFFICE_TYPES.has(declared))
  ) {
    return declared as InputType
  }
  const byType = BY_CONTENT_TYPE[file.contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '']
  const extension = extensionOf(file.filename)
  return byType ?? (extension === undefined ? undefined : BY_EXTENSION[extension])
}

const isPdf = (bytes: Uint8Array): boolean =>
  new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-'

/** An office file through the office engine, its PDF checked and counted. */
const convertOffice = (bytes: Uint8Array, filename: string, type: InputType) =>
  Effect.gen(function* () {
    const cleaned = OOXML_TYPES.has(type)
      ? sanitizeOfficePackage(bytes)
      : sanitizeOpenDocumentPackage(bytes)
    if (cleaned === undefined) {
      return yield* new ConvertFailed({
        message: `office_conversion_failed: "${filename}" is not a readable ${type} file`,
      })
    }
    const engineName = officeInputName(type)
    const pdf = yield* (yield* OfficeConverter)
      .convertToPdf({ name: engineName, bytes: cleaned })
      .pipe(
        // The engine only knew our fixed name; the step names the file as its author does.
        Effect.mapError(
          (error) =>
            new ConvertFailed({
              message: error.message.split(`"${engineName}"`).join(`"${filename}"`),
            })
        )
      )
    const refused = new ConvertFailed({
      message: `office_conversion_failed: the office engine did not answer "${filename}" with a PDF`,
    })
    if (!isPdf(pdf)) return yield* refused
    const loaded = yield* (yield* PdfToolkit).load(pdf, 0).pipe(Effect.mapError(() => refused))
    return { bytes: pdf, contentType: 'application/pdf', pages: loaded.pageCount }
  })

/** An HTML file through the browser engine, untemplated, in the render sandbox. */
const convertHtml = (bytes: Uint8Array) =>
  Effect.gen(function* () {
    const rendered = yield* (yield* DocumentRenderer).renderPdf(
      new TextDecoder().decode(bytes),
      {},
      { assetResolver: yield* documentAssetResolver, allowRemoteAssets: false }
    )
    return { bytes: rendered.bytes, contentType: rendered.contentType, pages: rendered.pages }
  })

/** A picture as one page, with the `pdf/fromImages` defaults (A4, orientation by shape). */
const convertImage = (bytes: Uint8Array, filename: string) =>
  Effect.gen(function* () {
    const built = yield* (yield* PdfEditor)
      .fromImages([bytes], { pageSize: 'A4', orientation: 'auto', fit: 'contain', margin: 0 })
      .pipe(
        Effect.mapError(
          (error) =>
            new ConvertFailed({ message: `unsupported_input: "${filename}" ${error.message}` })
        )
      )
    return { bytes: built.bytes, contentType: 'application/pdf', pages: built.pages }
  })

const convert = (props: Raw, scope: FileRefScope) =>
  Effect.gen(function* () {
    const { runContext } = scope
    const input = fileRefOf(typedOwnProp(props, 'input', runContext), 'input', runContext)
    const file = yield* resolveFileRef(input, scope)
    const type = inputTypeOf(props['inputType'], file)
    const picture = type === 'image' ? sniffContentType(file.bytes) : undefined
    if (type === undefined || (type === 'image' && picture === undefined)) {
      return yield* new ConvertFailed({
        message: `unsupported_input: "${file.filename}" (${file.contentType}) is not a type convert reads; it converts ${ACCEPTED}`,
      })
    }
    if (type === 'html') return yield* convertHtml(file.bytes)
    if (type === 'image') return yield* convertImage(file.bytes, file.filename)
    return yield* convertOffice(file.bytes, file.filename, type)
  })

export const handleDocumentConvert: ActionHandler = (action, app, automation, runContext) => {
  const props = actionPropsOf(action)
  return runDocumentAction(
    'document.convert',
    Effect.flatMap(convert(props, { app, automation, runContext }), (file) =>
      writeGeneratedFile({
        output: { filename: 'converted.pdf', ...outputPropOf(props) },
        file,
        app,
        automation,
        runContext,
      })
    )
  ).pipe(
    Effect.withSpan('automations.handle-document-convert', { attributes: actionAttributes(action) })
  )
}
