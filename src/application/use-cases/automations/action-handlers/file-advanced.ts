/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  ImageTransformService,
  type ImageOutputFormat,
} from '@/application/ports/services/image-transform-service'
import { StorageService } from '@/application/ports/services/storage-service'
import { extractTextFromBytes, type ExtractTextFormat } from './file-extract'
import { renderHtmlToPdf } from './file-pdf'
import { extOf, mimeByExt, tempKey, uploadArtifact } from './file-support'
import { buildStoredZip } from './file-zip'
import { numberProp, stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'

/**
 * Advanced `file:*` action handlers — `compress`, `extractText`,
 * `transformImage`, `generatePdf`. These complement `file.ts` (upload /
 * download / CSV) and `file-ops.ts` (list / move / copy / sign); kept in a
 * sibling module so neither file outgrows the per-file line cap.
 *
 * The heavy lifting (ZIP container, PDF wrapper, text extraction) lives in
 * the small sibling pure modules `file-zip.ts`, `file-pdf.ts`,
 * `file-extract.ts`, plus the `ImageTransformService` port (composed sharp
 * pipeline in `infrastructure/storage/image-transform-live.ts`), so each
 * concern stays individually testable and the handler stays a thin
 * storage-port glue.
 */

const props = (action: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  (action['props'] as Record<string, unknown> | undefined) ?? {}

/** A failure callers may swallow via `output.error` (status stays success). */
const softError = (message: string): ActionOutcome => ({
  status: 'success',
  output: { error: message },
})

const optionalString = (p: Readonly<Record<string, unknown>>, key: string): string | undefined =>
  p[key] !== undefined && stringProp(p, key) !== '' ? stringProp(p, key) : undefined

// ---------------------------------------------------------------------------
// compress
// ---------------------------------------------------------------------------

/** Resolve `props.keys` (array) or `props.files` (alias) to a string array. */
const compressKeys = (p: Readonly<Record<string, unknown>>): readonly string[] => {
  const raw = p['keys'] ?? p['files']
  if (Array.isArray(raw)) return raw.map((k) => String(k))
  return []
}

export const handleFileCompress: ActionHandler = (action) =>
  Effect.gen(function* () {
    const p = props(action)
    const keys = compressKeys(p)
    if (keys.length === 0) return softError('file.compress requires keys')

    const storage = yield* StorageService
    const downloads = yield* Effect.forEach(keys, (key) =>
      Effect.either(storage.download(key)).pipe(Effect.map((res) => ({ key, res })))
    )
    const missing = downloads.find((d) => d.res._tag === 'Left')
    if (missing) return softError(`file not found: ${missing.key}`)

    const entries = downloads.map((d) => ({
      name: d.key.slice(d.key.lastIndexOf('/') + 1),
      bytes: d.res._tag === 'Right' ? d.res.right : new Uint8Array(0),
    }))
    const zip = buildStoredZip(entries)

    const destination = optionalString(p, 'destination')
    const key = destination ?? tempKey('.zip')
    const wrote = yield* uploadArtifact(storage, key, zip, 'application/zip')
    if (!wrote) return softError(`failed to write zip to ${key}`)

    const base = {
      key,
      contentType: 'application/zip',
      size: zip.length,
      fileCount: keys.length,
    }
    return {
      status: 'success',
      output: destination ? { ...base, path: destination } : { ...base, temporary: true },
    } as const
  })

// ---------------------------------------------------------------------------
// extractText
// ---------------------------------------------------------------------------

const resolveExtractFormat = (raw: unknown): ExtractTextFormat =>
  raw === 'markdown' ? 'markdown' : 'plain'

export const handleFileExtractText: ActionHandler = (action) =>
  Effect.gen(function* () {
    const p = props(action)
    const key = p['key'] !== undefined ? stringProp(p, 'key') : stringProp(p, 'source')
    if (!key) return softError('file.extractText requires a key')

    const storage = yield* StorageService
    const downloaded = yield* Effect.either(storage.download(key))
    if (downloaded._tag === 'Left') return softError(`file not found: ${key}`)

    const format = resolveExtractFormat(p['format'])
    const extracted = extractTextFromBytes(downloaded.right, key, format)
    if (extracted === undefined) {
      return softError(`unsupported file type for text extraction: ${key}`)
    }

    return {
      status: 'success',
      output: {
        text: extracted.text,
        format,
        wordCount: extracted.wordCount,
        pageCount: extracted.pageCount,
      },
    } as const
  })

// ---------------------------------------------------------------------------
// transformImage
// ---------------------------------------------------------------------------

const resolveImageFormat = (raw: unknown): ImageOutputFormat | undefined =>
  raw === 'jpeg' || raw === 'png' || raw === 'webp' || raw === 'avif' ? raw : undefined

/** Optional numeric prop accessor — returns `undefined` when the key is absent. */
const optionalNumber = (
  p: Readonly<Record<string, unknown>>,
  key: string,
  fallback: number
): number | undefined => (p[key] !== undefined ? numberProp(p, key, fallback) : undefined)

type ImageOperation = 'resize' | 'crop' | 'noop'

const resolveImageOperation = (raw: string): ImageOperation =>
  raw === 'crop' || raw === 'noop' ? raw : 'resize'

interface TransformImageInputs {
  readonly operation: ImageOperation
  readonly outputFormat: ImageOutputFormat | undefined
  readonly width: number | undefined
  readonly height: number | undefined
  readonly quality: number | undefined
  readonly x: number | undefined
  readonly y: number | undefined
}

/** Parse `transformImage` props into the typed shape the port consumes. */
const parseTransformImageInputs = (p: Readonly<Record<string, unknown>>): TransformImageInputs => ({
  operation: resolveImageOperation(stringProp(p, 'operation') || 'resize'),
  outputFormat: resolveImageFormat(p['outputFormat'] ?? p['format']),
  width: optionalNumber(p, 'width', 0),
  height: optionalNumber(p, 'height', 0),
  quality: optionalNumber(p, 'quality', 80),
  x: optionalNumber(p, 'x', 0),
  y: optionalNumber(p, 'y', 0),
})

/** Resolve `(source key) | undefined` from either `props.key` or `props.source`. */
const resolveSourceKey = (p: Readonly<Record<string, unknown>>): string =>
  p['key'] !== undefined ? stringProp(p, 'key') : stringProp(p, 'source')

/** Resolve the destination key + suffix used for the upload target. */
const resolveDestinationKey = (
  p: Readonly<Record<string, unknown>>,
  sourceKey: string,
  inputs: TransformImageInputs
): { readonly destination: string | undefined; readonly destinationKey: string } => {
  const destination = optionalString(p, 'destination')
  const suffix = inputs.outputFormat
    ? `.${inputs.outputFormat}`
    : extOf(sourceKey) || extOf(destination) || '.png'
  return { destination, destinationKey: destination ?? tempKey(suffix) }
}

interface TransformImageOutputContext {
  readonly destinationKey: string
  readonly destination: string | undefined
  readonly contentType: string
  readonly inputs: TransformImageInputs
  readonly byteSize: number
}

/** Shape the `transformImage` action's `output.*` payload. */
const buildTransformImageOutput = (
  ctx: TransformImageOutputContext
): Readonly<Record<string, unknown>> => {
  const { destinationKey, destination, contentType, inputs, byteSize } = ctx
  const base = {
    key: destinationKey,
    destinationKey,
    contentType,
    operation: inputs.operation,
    size: byteSize,
    ...(inputs.width !== undefined && { width: inputs.width }),
    ...(inputs.height !== undefined && { height: inputs.height }),
    ...(inputs.quality !== undefined && { quality: inputs.quality }),
  } as const
  return destination ? { ...base, path: destination } : { ...base, temporary: true }
}

export const handleFileTransformImage: ActionHandler = (action) =>
  Effect.gen(function* () {
    const p = props(action)
    const key = resolveSourceKey(p)
    if (!key) return softError('file.transformImage requires a key')

    const storage = yield* StorageService
    const downloaded = yield* Effect.either(storage.download(key))
    if (downloaded._tag === 'Left') return softError(`file not found: ${key}`)

    const inputs = parseTransformImageInputs(p)
    const imageTransform = yield* ImageTransformService
    const result = yield* imageTransform.transform(downloaded.right, inputs)

    const { destination, destinationKey } = resolveDestinationKey(p, key, inputs)
    const contentType = mimeByExt(destinationKey) ?? result.contentType
    const wrote = yield* uploadArtifact(storage, destinationKey, result.bytes, contentType)
    if (!wrote) return softError(`failed to write image to ${destinationKey}`)

    return {
      status: 'success',
      output: buildTransformImageOutput({
        destinationKey,
        destination,
        contentType,
        inputs,
        byteSize: result.bytes.length,
      }),
    } as const
  })

// ---------------------------------------------------------------------------
// generatePdf
// ---------------------------------------------------------------------------

export const handleFileGeneratePdf: ActionHandler = (action) =>
  Effect.gen(function* () {
    const p = props(action)
    const template = stringProp(p, 'template')
    if (!template) return softError('file.generatePdf requires a template')

    const filename = stringProp(p, 'filename') || 'document.pdf'
    const pdf = renderHtmlToPdf(template)

    const destination = optionalString(p, 'destination')
    const key = destination ?? tempKey('.pdf')
    const storage = yield* StorageService
    const wrote = yield* uploadArtifact(storage, key, pdf, 'application/pdf')
    if (!wrote) return softError(`failed to write pdf to ${key}`)

    const base = { key, filename, contentType: 'application/pdf', size: pdf.length }
    return {
      status: 'success',
      output: destination ? { ...base, path: destination } : { ...base, temporary: true },
    } as const
  })
