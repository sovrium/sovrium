/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { resolveTranscribeSource } from './ai-transcribe-source'
import {
  FILE_SOURCE_MAX_BYTES,
  isSelfContainedSource,
  mimeByExt,
  resolveSource,
} from './file-support'
import { authoredActionProps, resolveOwnProp } from './run-context-resolution'
import type { ActionRunContext } from './shared'
import type { ConnectionOperation } from '@/domain/models/app/connections'

/** The request could not be built, or a file it names could not be read; nothing is sent. */
export class WrittenBodyFileError extends Data.TaggedError('WrittenBodyFileError')<{
  readonly message: string
}> {}

/** A file a connection call sends: its bytes, its original name and its content type. */
export interface OperationFile {
  readonly bytes: Uint8Array
  readonly fileName: string
  readonly contentType: string
}

const OCTET_STREAM = 'application/octet-stream'

/** How a value names its file in an error: the string itself, or its JSON. */
const describe = (value: unknown): string =>
  typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value))

/** The last path segment of a URL, or `fallback` for a `data:` URI or a bare host. */
const urlFileName = (source: string, fallback: string): string => {
  if (source.startsWith('data:')) return fallback
  const segment = URL.parse(source)?.pathname.split('/').at(-1) ?? ''
  if (segment === '') return fallback
  // A malformed escape (`%E0`) keeps the segment as written rather than throwing.
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/** The refusal of a file past the 100 MiB the `file` actions read. */
const tooLarge = (label: string): Readonly<WrittenBodyFileError> =>
  new WrittenBodyFileError({ message: `file '${label}' is larger than 100 MiB` })

/** Refuse a file past the 100 MiB the `file` actions read. */
const withinCap = (
  file: OperationFile,
  label: string
): Effect.Effect<OperationFile, WrittenBodyFileError> =>
  file.bytes.length > FILE_SOURCE_MAX_BYTES ? Effect.fail(tooLarge(label)) : Effect.succeed(file)

/**
 * A `data:` URI decoded, or an `https://` URL fetched behind the outbound guard.
 * The fetch answers no bytes for a non-2xx, a transport failure and a body cut
 * at the 100 MiB cap alike, so an empty URL read fails the call by name rather
 * than sending an empty part in the file's place.
 */
const readSelfContained = (
  source: string,
  fallbackName: string
): Effect.Effect<OperationFile, WrittenBodyFileError, StorageService> =>
  resolveSource(source).pipe(
    Effect.mapError(
      (blocked) =>
        new WrittenBodyFileError({
          message: `file '${source}' is refused: invalid_outbound_url_${blocked.reason}`,
        })
    ),
    Effect.filterOrFail(
      (resolved) => source.startsWith('data:') || resolved.bytes.length > 0,
      () => new WrittenBodyFileError({ message: `file '${source}' could not be read` })
    ),
    Effect.map((resolved) => ({
      bytes: resolved.bytes,
      fileName: urlFileName(source, fallbackName),
      contentType: resolved.detectedMime ?? OCTET_STREAM,
    }))
  )

/** A stored file, named by its key or by an attachment field's value. */
const readStored = (
  value: unknown
): Effect.Effect<OperationFile, WrittenBodyFileError, StorageService> => {
  const located = resolveTranscribeSource(value, undefined)
  if (located === undefined) {
    return Effect.fail(
      new WrittenBodyFileError({ message: `file '${describe(value)}' names no file` })
    )
  }
  return Effect.gen(function* () {
    const storage = yield* StorageService
    // The catalogued size refuses an oversized file before a byte is buffered.
    // No catalog row (a key written outside the upload routes) is the ordinary
    // case and falls through to the download, which the cap re-checks.
    const catalogued = yield* Effect.result(storage.getMetadata(located.key, UNATTRIBUTED_BUCKET))
    if (catalogued._tag === 'Success' && catalogued.success.size > FILE_SOURCE_MAX_BYTES) {
      return yield* tooLarge(located.key)
    }
    // Unattributed, like the `file` actions: any stored key is readable, so
    // which keys reach a call is the config's to decide.
    const bytes = yield* storage
      .download(located.key, UNATTRIBUTED_BUCKET)
      .pipe(
        Effect.mapError(
          () => new WrittenBodyFileError({ message: `file '${located.key}' could not be read` })
        )
      )
    return {
      bytes,
      fileName: located.fileName,
      contentType: located.mimeType ?? mimeByExt(located.key) ?? OCTET_STREAM,
    }
  })
}

/**
 * Read the file a connection call names, the way the `file` actions and
 * `ai/transcribe` read one: a `data:` URI decoded, an `https://` URL fetched
 * behind the outbound guard, a storage key or an attachment field's value
 * (`{ key, url }`, the `storeMetadata` object, the first of a list) downloaded.
 * A file that is not stored, a URL the guard refuses or a file past the cap
 * fails the call by name rather than sending an empty part.
 */
export const readOperationFile = (
  value: unknown,
  fallbackName: string
): Effect.Effect<OperationFile, WrittenBodyFileError, StorageService> =>
  (typeof value === 'string' && isSelfContainedSource(value.trim())
    ? readSelfContained(value.trim(), fallbackName)
    : readStored(value)
  ).pipe(
    Effect.flatMap((file) => withinCap(file, describe(value))),
    Effect.withSpan('automations.connection-file-read')
  )

/**
 * A call's `params`, each `file` parameter re-read whole from the authored
 * props. The run loop renders every prop to a string, which turns an
 * attachment OBJECT into `"[object Object]"`; a whole `{{path}}` is re-read so
 * the attachment value arrives intact, as `ai/transcribe` reads its `source`.
 */
export const withWholeFileParams = (
  params: Readonly<Record<string, unknown>>,
  operation: ConnectionOperation,
  runContext: ActionRunContext | undefined
): Readonly<Record<string, unknown>> => {
  if (runContext === undefined) return params
  const authored = (authoredActionProps(runContext)['params'] ?? {}) as Readonly<
    Record<string, unknown>
  >
  return Object.entries(operation.params ?? {})
    .filter(([name, param]) => param.type === 'file' && authored[name] !== undefined)
    .reduce<Readonly<Record<string, unknown>>>((resolved, [name]) => {
      const whole = resolveOwnProp(runContext, authored[name])
      return typeof whole === 'object' && whole !== null ? { ...resolved, [name]: whole } : resolved
    }, params)
}
