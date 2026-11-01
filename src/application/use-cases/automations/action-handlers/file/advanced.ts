/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  ImageTransformService,
  type ImageFit,
  type ImageOutputFormat,
} from '@/application/ports/services/image-transform-service'
import { StorageService } from '@/application/ports/services/storage-service'
import { logStorageFailure } from '@/application/use-cases/buckets/storage-failure-log'
import { decodedHandler, type DecodedAction } from '../decoded-handler'
import { builtFromRunBytes, recordRunArtifact } from '../run-written-files'
import { actionAttributes } from '../shared'
import { extractTextFromBytes } from './extract'
import {
  FileCompressSettings,
  FileExtractTextSettings,
  FileTransformImageSettings,
} from './settings'
import {
  extOf,
  FILE_SOURCE_MAX_BYTES,
  mimeByExt,
  readStoredSource,
  storedReadMessage,
  tempKey,
  uploadArtifact,
} from './support'
import { buildStoredZip } from './zip'
import type { ActionOutcome } from '../shared'

/**
 * Advanced `file:*` action handlers — `compress`, `extractText`,
 * `transformImage`. These complement `file.ts` (upload /
 * download / CSV) and `file-ops.ts` (list / move / copy / sign); kept in a
 * sibling module so neither file outgrows the per-file line cap.
 *
 * The heavy lifting (ZIP container, text extraction) lives in the small
 * sibling pure modules `file-zip.ts`, `file-extract.ts`, plus the `ImageTransformService` port (the composed image
 * pipeline in `infrastructure/storage/image-transform-live.ts`), so each
 * concern stays individually testable and the handler stays a thin
 * storage-port glue.
 */

/** A failure callers may swallow via `output.error` (status stays success). */
const softError = (message: string): ActionOutcome => ({
  status: 'success',
  output: { error: message },
})

// ---------------------------------------------------------------------------
// compress
// ---------------------------------------------------------------------------

/** Resolve `props.keys` (array) or `props.files` (alias, a list a template names) to keys. */
const compressKeys = (
  p: DecodedAction<typeof FileCompressSettings>['props']
): readonly string[] => {
  const raw = p.keys ?? p.files
  if (Array.isArray(raw)) return raw.map((k) => String(k))
  return []
}

/** Why a `compress` stops: the inputs together are past the single-file limit. */
const COMPRESS_TOTAL_TOO_LARGE = 'the files to compress are larger than 100 MiB in total'

/**
 * The sizes the store reports for `keys`, summed, stopping once the sum passes
 * {@link FILE_SOURCE_MAX_BYTES}: an archive whose inputs are known to be too
 * large is refused before any is read. A size the store cannot report counts
 * as nothing here — the read that follows is bounded by what the limit leaves,
 * and reports a missing file itself.
 */
const reportedTotal = (
  storage: Effect.Success<typeof StorageService>,
  keys: readonly string[]
): Effect.Effect<number> =>
  Effect.reduce(
    keys,
    () => 0,
    (total, key) =>
      total > FILE_SOURCE_MAX_BYTES
        ? Effect.succeed(total)
        : // effect-swallow: a size the store cannot report counts as nothing; the read that follows stays bounded by the cap. A failure other than a missing object is logged.
          Effect.result(
            storage
              .statObject(key)
              .pipe(
                logStorageFailure(
                  '[automations] file.compress could not stat an input; counting it as 0 bytes',
                  { 'sovrium.storage.key': key }
                )
              )
          ).pipe(
            Effect.map((stat) => (stat._tag === 'Success' ? total + stat.success.size : total))
          )
  )

interface CompressRead {
  readonly total: number
  readonly entries: readonly { readonly name: string; readonly bytes: Uint8Array }[]
  readonly refusal?: string
}

/**
 * Read each of `keys` no further than what {@link FILE_SOURCE_MAX_BYTES} leaves
 * after the files before it, stopping at the first that cannot be read: the
 * bytes one archive holds stay within the limit however many files it names,
 * and however the store's reported sizes compare with what it holds.
 */
const readWithinTotal = (
  keys: readonly string[]
): Effect.Effect<CompressRead, never, StorageService> =>
  Effect.reduce(
    keys,
    (): CompressRead => ({ total: 0, entries: [] }),
    (read, key) =>
      read.refusal !== undefined
        ? Effect.succeed(read)
        : Effect.result(readStoredSource(key, FILE_SOURCE_MAX_BYTES - read.total)).pipe(
            Effect.map((res): CompressRead => {
              if (res._tag === 'Success') {
                const entry = { name: key.slice(key.lastIndexOf('/') + 1), bytes: res.success }
                return { total: read.total + res.success.length, entries: [...read.entries, entry] }
              }
              const pastTotal = res.failure._tag === 'StoredSourceTooLargeError' && read.total > 0
              return {
                ...read,
                refusal: pastTotal ? COMPRESS_TOTAL_TOO_LARGE : storedReadMessage(res.failure),
              }
            })
          )
  )

export const handleFileCompress = decodedHandler(FileCompressSettings, (action, _app, automation) =>
  Effect.gen(function* () {
    const p = action.props
    const keys = compressKeys(p)
    if (keys.length === 0) return softError('file.compress requires keys')

    const storage = yield* StorageService
    if ((yield* reportedTotal(storage, keys)) > FILE_SOURCE_MAX_BYTES) {
      return softError(COMPRESS_TOTAL_TOO_LARGE)
    }
    const read = yield* readWithinTotal(keys)
    if (read.refusal !== undefined) return softError(read.refusal)
    const zip = buildStoredZip(read.entries)

    const destination = p.destination || undefined
    const key = destination ?? tempKey('.zip')
    const wrote = yield* uploadArtifact(storage, key, zip, 'application/zip')
    if (!wrote) return softError(`failed to write zip to ${key}`)
    // An archive carries run bytes only when every file in it does.
    const carriesRunBytes = builtFromRunBytes(automation.writtenFiles, keys)
    yield* recordRunArtifact(automation.writtenFiles, key, { carriesRunBytes })

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
  }).pipe(
    Effect.withSpan('automations.handle-file-compress', { attributes: actionAttributes(action) })
  )
)

// ---------------------------------------------------------------------------
// extractText
// ---------------------------------------------------------------------------

export const handleFileExtractText = decodedHandler(FileExtractTextSettings, (action) =>
  Effect.gen(function* () {
    const p = action.props
    const key = p.key ?? p.source ?? ''
    if (!key) return softError('file.extractText requires a key')

    const downloaded = yield* Effect.result(readStoredSource(key))
    if (downloaded._tag === 'Failure') return softError(storedReadMessage(downloaded.failure))

    const format = p.format ?? 'plain'
    const extracted = extractTextFromBytes(downloaded.success, key, format)
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
  }).pipe(
    Effect.withSpan('automations.handle-file-extract-text', {
      attributes: actionAttributes(action),
    })
  )
)

// ---------------------------------------------------------------------------
// transformImage
// ---------------------------------------------------------------------------

interface TransformImageInputs {
  readonly operation: 'resize' | 'convert'
  readonly outputFormat: ImageOutputFormat | undefined
  readonly width: number | undefined
  readonly height: number | undefined
  readonly fit: ImageFit | undefined
  readonly quality: number | undefined
}

type TransformImageProps = DecodedAction<typeof FileTransformImageSettings>['props']

/** `transformImage` props in the typed shape the port consumes. */
const parseTransformImageInputs = (p: TransformImageProps): TransformImageInputs => ({
  operation: p.operation ?? 'resize',
  outputFormat: p.outputFormat ?? p.format,
  width: p.width,
  height: p.height,
  fit: p.fit,
  quality: p.quality,
})

/** Resolve the destination key + suffix used for the upload target. */
const resolveDestinationKey = (
  p: TransformImageProps,
  sourceKey: string,
  inputs: TransformImageInputs
): { readonly destination: string | undefined; readonly destinationKey: string } => {
  const destination = p.destination || undefined
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

export const handleFileTransformImage = decodedHandler(
  FileTransformImageSettings,
  (action, _app, automation) =>
    Effect.gen(function* () {
      const p = action.props
      const key = p.key ?? p.source ?? ''
      if (!key) return softError('file.transformImage requires a key')

      const storage = yield* StorageService
      const downloaded = yield* Effect.result(readStoredSource(key))
      if (downloaded._tag === 'Failure') return softError(storedReadMessage(downloaded.failure))

      const inputs = parseTransformImageInputs(p)
      const imageTransform = yield* ImageTransformService
      // The port reports a transform it could not perform. Reporting it as a
      // failed STEP is a deliberate, visible choice here — the alternative,
      // returning the source bytes unchanged, would write an untransformed file
      // and call it success.
      const transformed = yield* Effect.result(imageTransform.transform(downloaded.success, inputs))
      if (transformed._tag === 'Failure') {
        const { cause } = transformed.failure
        const detail = cause instanceof Error ? cause.message : String(cause)
        return softError(`file.transformImage could not transform ${key}: ${detail}`)
      }
      const result = transformed.success

      const { destination, destinationKey } = resolveDestinationKey(p, key, inputs)
      const contentType = mimeByExt(destinationKey) ?? result.contentType
      const wrote = yield* uploadArtifact(storage, destinationKey, result.bytes, contentType)
      if (!wrote) return softError(`failed to write image to ${destinationKey}`)
      // A transformed image carries the standing of the image it was made from.
      yield* recordRunArtifact(automation.writtenFiles, destinationKey, {
        carriesRunBytes: builtFromRunBytes(automation.writtenFiles, [key]),
      })

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
    }).pipe(
      Effect.withSpan('automations.handle-file-transform-image', {
        attributes: actionAttributes(action),
      })
    )
)
