/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import fetch <source-uri>` — the one network step of a migration
 * ([internal ref] A14, bounds 9 to 11). It reads a tool's API read-only, with a token
 * taken from the environment, and writes a snapshot folder:
 *
 * ```
 * <out>/snapshot.json          the manifest: tool, API version, cursors, a SHA-256 per file
 * <out>/raw/…                  what the API returned, page by page, untouched
 * <out>/assets/<sha256>.<ext>  attachments, downloaded now because their links expire
 * ```
 *
 * - The token is read from `--token-env <VAR>` or the tool's default variable,
 *   and is written nowhere: not in the snapshot, not in a line of output.
 * - The default folder is `.sovrium-imports/<tool>-<timestamp>/`, which the
 *   fetch adds to `.gitignore`; an `--out` inside the instance's data
 *   directory, or inside a folder it serves (`public/`), is refused before any
 *   request.
 * - The manifest is rewritten after every page, so an interrupted fetch run
 *   again into the same folder resumes from its cursors.
 *
 * The HTTP half — timeouts, retries, rate limits, the loopback override — and
 * each tool's fetcher live in `src/infrastructure/egress/import-fetch-*`.
 */

import { createHash } from 'node:crypto'
import { mkdir, realpath } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { Effect, Schema } from 'effect'
import {
  IMPORT_ATTACHMENT_INDEX,
  IMPORT_SNAPSHOT_FORMAT,
  IMPORT_SNAPSHOT_MANIFEST,
  IMPORT_SNAPSHOT_ROOT,
  ImportSnapshotManifestSchema,
  defaultSnapshotFolder,
  isSnapshotFilePath,
  type ImportSnapshotCursor,
  type ImportSnapshotFile,
  type ImportSnapshotManifest,
} from '@/domain/models/import/snapshot-manifest'
import { parseDataDir } from '@/domain/models/process-env/data-dir'
import { isPathWithin } from '@/domain/models/process-env/desktop'
import { ImportFetchError } from '@/infrastructure/egress/import-fetch-client'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { refuse } from './app-prelude'
import { fetchRunnerOf } from './import-fetchers'
import { readFetchRequest, type FetchRequest } from './import-request'
import { ensureGitignored } from './import-write'
import { isPublicDirOptOut } from './option-parsing'
import type { ImportDomain, ImportExportKind } from '@/domain/models/import/import-source'
import type { AttachmentOutcome, FetchContext } from '@/infrastructure/egress/import-fetch-sink'

/** The fetch's own index of the attachments it downloaded, beside the API's pages. */
const ATTACHMENT_INDEX = IMPORT_ATTACHMENT_INDEX

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

/**
 * A path with its nearest existing ancestor resolved through symbolic links, so
 * `/var/…` and `/private/var/…` (macOS) compare as the one folder they are.
 */
const realOf = async (path: string): Promise<string> => {
  const real = await realpath(path).catch(() => undefined)
  if (real !== undefined) return real
  const parent = dirname(path)
  return parent === path ? path : join(await realOf(parent), basename(path))
}

/** The folders an instance serves its static files from: `public/` here, and `SOVRIUM_PUBLIC_DIR`. */
const servedDirsOf = (cwd: string): readonly string[] => {
  const named = process.env['SOVRIUM_PUBLIC_DIR']
  return [
    join(cwd, 'public'),
    ...(named === undefined || named === '' || isPublicDirOptOut(named)
      ? []
      : [resolve(cwd, named)]),
  ]
}

/**
 * The snapshot folder, refused inside the instance's data directory and inside
 * a folder it serves: a snapshot holds the operator's raw records.
 */
const resolveOut = async (
  request: FetchRequest,
  fetchedAt: string
): Promise<{ readonly out: string; readonly isDefault: boolean }> => {
  const cwd = process.cwd()
  const out = resolve(cwd, request.out ?? defaultSnapshotFolder(request.source.tool, fetchedAt))
  const real = await realOf(out)
  const dataDirs = await Promise.all([parseDataDir(), join(cwd, '.sovrium')].map(realOf))
  if (dataDirs.some((dir) => isPathWithin(dir, real))) {
    return refuse(
      `Error: --out "${request.out ?? out}" is inside the instance's data directory (.sovrium), which a snapshot never goes into.\n\n` +
        `  Write it beside it — the default is ${IMPORT_SNAPSHOT_ROOT}/<tool>-<timestamp>/.`
    )
  }
  const servedDirs = await Promise.all(servedDirsOf(cwd).map(realOf))
  if (servedDirs.some((dir) => isPathWithin(dir, real))) {
    return refuse(
      `Error: --out "${request.out ?? out}" is inside a folder the instance serves (public/), which a snapshot never goes into.\n\n` +
        `  Write it outside it — the default is ${IMPORT_SNAPSHOT_ROOT}/<tool>-<timestamp>/.`
    )
  }
  return {
    out,
    isDefault: request.out === undefined || isPathWithin(join(cwd, IMPORT_SNAPSHOT_ROOT), out),
  }
}

const decodeManifest = Schema.decodeUnknownOption(ImportSnapshotManifestSchema)

/** A previous run's manifest in the same folder, for the same source, to resume from. */
const previousManifest = async (
  out: string,
  uri: string
): Promise<ImportSnapshotManifest | undefined> => {
  const file = Bun.file(join(out, IMPORT_SNAPSHOT_MANIFEST))
  if (!(await file.exists())) return undefined
  const decoded = decodeManifest(JSON.parse(await file.text()) as unknown)
  return decoded._tag === 'Some' && decoded.value.source.uri === uri ? decoded.value : undefined
}

/** The run's mutable state: the files, cursors and attachments written so far. */
interface FetchState {
  readonly files: Map<string, ImportSnapshotFile>
  readonly cursors: Map<string, ImportSnapshotCursor>
  attachments: readonly AttachmentOutcome[]
  /** What a previous, interrupted run into the same folder already counted. */
  readonly downloaded: number
  readonly skipped: number
  ids: readonly string[]
  apiVersion: string | undefined
}

const manifestOf = (
  request: FetchRequest,
  run: {
    readonly domains: readonly ImportDomain[]
    readonly fetchedAt: string
    readonly exportKind: ImportExportKind
  },
  state: FetchState
): ImportSnapshotManifest => ({
  format: IMPORT_SNAPSHOT_FORMAT,
  version: 1,
  tool: request.source.tool,
  exportKind: run.exportKind,
  ...(state.apiVersion === undefined ? {} : { apiVersion: state.apiVersion }),
  fetchedAt: run.fetchedAt,
  source: { uri: request.uri, ids: state.ids },
  domains: run.domains,
  attachments: {
    downloaded:
      state.downloaded +
      new Set(state.attachments.flatMap((one) => (one.kind === 'downloaded' ? [one.asset] : [])))
        .size,
    skipped: state.skipped + state.attachments.filter((one) => one.kind === 'skipped').length,
  },
  files: [...state.files.values()].toSorted((a, b) => a.path.localeCompare(b.path)),
  cursors: [...state.cursors.values()].toSorted((a, b) => a.resource.localeCompare(b.resource)),
})

const io = <A>(what: string, run: () => Promise<A>): Effect.Effect<A, ImportFetchError> =>
  Effect.tryPromise({
    try: run,
    catch: () => new ImportFetchError({ message: `could not write ${what}`, resumable: false }),
  })

/**
 * A snapshot path built from what a source answered (a table id, a workflow
 * id), refused when it would not stay under `raw/` or `assets/`: no id a source
 * returns may place a file outside the snapshot folder.
 */
const inSnapshot = <A>(
  path: string,
  run: () => Effect.Effect<A, ImportFetchError>
): Effect.Effect<A, ImportFetchError> =>
  isSnapshotFilePath(path)
    ? run()
    : Effect.fail(
        new ImportFetchError({
          message: 'the source named a file the snapshot cannot hold (an id with a path in it)',
          resumable: false,
        })
      )

/** The sink the fetcher writes through, persisting the manifest at every cursor. */
const sinkOf = (
  out: string,
  persist: () => Promise<void>,
  state: FetchState
): FetchContext['sink'] => {
  const writeFile = async (path: string, bytes: Uint8Array) => {
    await mkdir(dirname(join(out, path)), { recursive: true })
    await Bun.write(join(out, path), bytes)
    state.files.set(path, { path, sha256: sha256(bytes), bytes: bytes.byteLength })
  }
  return {
    readRaw: (path) =>
      inSnapshot(path, () =>
        io(path, async () => {
          const file = Bun.file(join(out, path))
          return state.files.has(path) && (await file.exists())
            ? (JSON.parse(await file.text()) as unknown)
            : undefined
        })
      ),
    writeRaw: (path, bytes) => inSnapshot(path, () => io(path, () => writeFile(path, bytes))),
    writeAsset: (hash, extension, bytes) => {
      const path = `assets/${hash}${extension === '' ? '' : `.${extension}`}`
      return inSnapshot(path, () => io(path, () => writeFile(path, bytes))).pipe(Effect.as(path))
    },
    cursorOf: (resource) => state.cursors.get(resource),
    saveCursor: (cursor) =>
      io(IMPORT_SNAPSHOT_MANIFEST, async () => {
        state.cursors.set(cursor.resource, cursor)
        await persist()
      }),
    attachment: (outcome) =>
      Effect.sync(() => {
        state.attachments = [...state.attachments, outcome]
      }),
  }
}

/** Everything checked before the first request: the source, the token, the folder. */
const prepare = async (argv: readonly string[], positional: readonly string[]) => {
  const request = readFetchRequest(argv, positional)
  const { only } = request
  const domains =
    only === undefined
      ? request.source.domains
      : request.source.domains.filter((domain) => only.includes(domain))
  const { runner, exportKind } = fetchRunnerOf(request, domains)
  const fetchedAt = new Date().toISOString()
  const { out, isDefault } = await resolveOut(request, fetchedAt)
  return { request, domains, runner, exportKind, fetchedAt, out, isDefault }
}

/** A fresh run's state: nothing fetched yet. */
const EMPTY_MANIFEST_PART = {
  files: [],
  cursors: [],
  attachments: { downloaded: 0, skipped: 0 },
  source: { uri: '', ids: [] },
  apiVersion: undefined,
} as const

/** The run's state, carried over from a previous run into the same folder. */
const stateFrom = (previous: ImportSnapshotManifest | undefined): FetchState => {
  const held = previous ?? EMPTY_MANIFEST_PART
  return {
    files: new Map(held.files.map((file) => [file.path, file] as const)),
    cursors: new Map(held.cursors.map((cursor) => [cursor.resource, cursor] as const)),
    attachments: [],
    downloaded: held.attachments.downloaded,
    skipped: held.attachments.skipped,
    ids: held.source.ids,
    apiVersion: held.apiVersion,
  }
}

/** Write the fetch's own index of the attachments it downloaded. */
const writeAttachmentIndex = async (out: string, state: FetchState): Promise<void> => {
  const downloaded = state.attachments.flatMap(({ kind, ...rest }) =>
    kind === 'downloaded' ? [rest] : []
  )
  if (downloaded.length === 0) return
  const index = new TextEncoder().encode(`${JSON.stringify(downloaded, undefined, 2)}\n`)
  await Bun.write(join(out, ATTACHMENT_INDEX), index)
  state.files.set(ATTACHMENT_INDEX, {
    path: ATTACHMENT_INDEX,
    sha256: sha256(index),
    bytes: index.byteLength,
  })
}

/**
 * Run `sovrium import fetch`; returns the snapshot folder, relative to the
 * working directory, for the one-command path to convert.
 */
export const runFetch = async (
  argv: readonly string[],
  positional: readonly string[]
): Promise<string> => {
  const run = await prepare(argv, positional)
  const { request, out } = run
  const state = stateFrom(await previousManifest(out, request.uri))
  const persist = async () => {
    await mkdir(out, { recursive: true })
    const manifest = manifestOf(request, run, state)
    await Bun.write(
      join(out, IMPORT_SNAPSHOT_MANIFEST),
      `${JSON.stringify(manifest, undefined, 2)}\n`
    )
  }
  if (run.isDefault) await ensureGitignored(process.cwd(), `${IMPORT_SNAPSHOT_ROOT}/`)
  const outcome = await Effect.runPromise(Effect.result(run.runner(sinkOf(out, persist, state))))
  const shown = relative(process.cwd(), out) || '.'
  if (outcome._tag === 'Failure') {
    await persist()
    return refuse(
      `Error: The fetch stopped: ${outcome.failure.message}.\n\n` +
        (outcome.failure.resumable
          ? `  What was fetched is kept in ${shown}. Run the same command again to resume.`
          : '  Fix the cause, then run the same command again.')
    )
  }
  await writeAttachmentIndex(out, state)
  state.ids = outcome.success.ids
  state.apiVersion = outcome.success.apiVersion
  await persist()
  printStderr(`Fetched ${request.source.tool} into ${shown} (${String(state.files.size)} files).`)
  return shown
}
