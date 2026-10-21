/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The contract between a source fetcher and the snapshot folder it fills.
 *
 * A fetcher knows its vendor's API — which endpoints, which pagination, where
 * the attachments sit in a record — and nothing about files. The snapshot
 * writer (`sovrium import fetch`) knows the folder and the manifest and
 * nothing about vendors. This interface is all they share, so a new source is
 * one fetcher and no change to the writer.
 *
 * Every page is persisted with its cursor BEFORE the next one is requested,
 * so an interrupted fetch resumes from the manifest instead of starting over.
 */

import { Effect, Option } from 'effect'
import {
  fetchSourceJson,
  type ImportFetchError,
  type ImportFetchTarget,
} from './import-fetch-client'
import { downloadSourceAsset } from './import-fetch-download'
import type { ImportSnapshotCursor } from '@/domain/models/import/snapshot-manifest'

/** Where a fetcher writes. Paths are snapshot paths (`raw/…`). */
export interface SnapshotSink {
  /** A `raw/` file a previous run already wrote, parsed, or `undefined`. */
  readonly readRaw: (path: string) => Effect.Effect<unknown, ImportFetchError>
  /** Write a `raw/` file, exactly the bytes the API returned. */
  readonly writeRaw: (path: string, bytes: Uint8Array) => Effect.Effect<void, ImportFetchError>
  /** Write an attachment under `assets/<sha256>.<ext>`; returns its snapshot path. */
  readonly writeAsset: (
    sha256: string,
    extension: string,
    bytes: Uint8Array
  ) => Effect.Effect<string, ImportFetchError>
  /** The cursor a previous run recorded for a resource. */
  readonly cursorOf: (resource: string) => ImportSnapshotCursor | undefined
  /** Record a resource's progress in the manifest, durably. */
  readonly saveCursor: (cursor: ImportSnapshotCursor) => Effect.Effect<void, ImportFetchError>
  /** Record one attachment's outcome. */
  readonly attachment: (outcome: AttachmentOutcome) => Effect.Effect<void, ImportFetchError>
}

/** What became of one attachment the source referenced. */
export type AttachmentOutcome =
  | {
      readonly kind: 'downloaded'
      readonly source: string
      readonly filename: string
      readonly asset: string
    }
  | { readonly kind: 'skipped'; readonly source: string; readonly filename: string }

/** What every fetcher is handed. */
export interface FetchContext {
  readonly target: ImportFetchTarget
  /** The origin requests go to (the vendor's, or the loopback override). */
  readonly base: string
  /** The loopback override's origin, whose attachment URLs are trusted. */
  readonly overrideOrigin: string | undefined
  readonly sink: SnapshotSink
  readonly domains: readonly string[]
  readonly skipAttachments: boolean
}

/** A fetcher's summary: the source ids it read, and the API version it spoke when the API has one. */
export interface FetchSummary {
  readonly ids: readonly string[]
  readonly apiVersion?: string
}

const EXTENSION = /\.([A-Za-z0-9]{1,8})$/

/** The extension a downloaded file keeps: its name's, else none. */
const extensionOf = (filename: string): string => EXTENSION.exec(filename)?.[1]?.toLowerCase() ?? ''

/**
 * Download one attachment into the snapshot, or record it as skipped when
 * `--skip-attachments` was passed or its URL was refused.
 *
 * With `authenticated`, the request carries the source's credential, and only
 * when the file sits on the source's own API origin (Typeform serves response
 * files behind the token); a file anywhere else is fetched without it.
 */
export const fetchAttachment = (
  context: FetchContext,
  attachment: { readonly source: string; readonly url: string; readonly filename: string },
  authenticated = false
): Effect.Effect<void, ImportFetchError> => {
  const skip = context.sink.attachment({
    kind: 'skipped',
    source: attachment.source,
    filename: attachment.filename,
  })
  if (context.skipAttachments) return skip
  const credential = authenticated
    ? { origin: new URL(context.target.realBaseUrl).origin, headers: context.target.headers }
    : undefined
  return downloadSourceAsset(attachment.url, context.overrideOrigin, credential).pipe(
    Effect.flatMap((maybe) =>
      Option.match(maybe, {
        onNone: () => skip,
        onSome: (downloaded) =>
          context.sink
            .writeAsset(downloaded.sha256, extensionOf(attachment.filename), downloaded.bytes)
            .pipe(
              Effect.flatMap((asset) =>
                context.sink.attachment({
                  kind: 'downloaded',
                  source: attachment.source,
                  filename: attachment.filename,
                  asset,
                })
              )
            ),
      })
    )
  )
}

/**
 * A JSON document of the source, read once: re-read from the snapshot when a
 * previous, interrupted run already wrote it at `rawPath`, otherwise asked for
 * with a `GET` on `path` and written there before it is used.
 */
export const heldOrFetched = (
  context: FetchContext,
  rawPath: string,
  path: string,
  query: Readonly<Record<string, string>> = {}
): Effect.Effect<unknown, ImportFetchError> =>
  context.sink.readRaw(rawPath).pipe(
    Effect.filterOrElse(
      (held) => held !== undefined,
      () =>
        fetchSourceJson(context.target, context.base, { method: 'GET', path, query }).pipe(
          Effect.tap((response) => context.sink.writeRaw(rawPath, response.bytes)),
          Effect.map((response) => response.json)
        )
    )
  )
