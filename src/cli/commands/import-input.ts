/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import <input>` — reading what the conversion converts: a snapshot
 * folder written by `sovrium import fetch`, or an export file the operator
 * already holds. A URL is refused: the conversion reads a path, never the
 * network ([internal ref] A14, bound 1).
 *
 * ─── A SNAPSHOT IS READ THROUGH ITS MANIFEST ───────────────────────────────
 *
 * Only the files `snapshot.json` lists are read, each under `raw/` or
 * `assets/` (the manifest schema refuses any other path, and every path is
 * normalised again here), never through a symbolic link, and each must still
 * hash to what the manifest recorded: a conversion replays exactly the bytes
 * the fetch wrote, or it does not run. A snapshot whose fetch did not finish —
 * a cursor still open — is refused, because converting it would silently drop
 * the records the fetch never reached.
 *
 * An export file is its own snapshot: it is read as one `raw/<file>` entry.
 * A folder with no manifest is read as the JSON export files it holds.
 * Files past {@link MAX_INPUT_BYTES} are refused rather than truncated.
 */

import { createHash } from 'node:crypto'
import { lstat, readdir } from 'node:fs/promises'
import { basename, extname, join, relative, resolve } from 'node:path'
import { Schema } from 'effect'
import { normaliseSourcePath } from '@/domain/models/app/design/adapters/import/dtcg-import-service'
import { addressForDisplay } from '@/domain/models/import/capability-url-service'
import {
  IMPORT_SNAPSHOT_MANIFEST,
  ImportSnapshotManifestSchema,
  openCursors,
  type ImportSnapshotManifest,
} from '@/domain/models/import/snapshot-manifest'
import { refuse } from './app-prelude'
import type { ImportExportKind } from '@/domain/models/import/import-source'

/** One input file past this size is refused: 1 GiB. */
const MAX_INPUT_BYTES = 1024 * 1024 * 1024

/** `scheme://…` — a URL, as opposed to a local path. */
const URL_INPUT = /^[a-z][a-z0-9+.-]*:\/\//i

/** What the conversion reads. */
export interface ImportInput {
  /** The path as given on the command line. */
  readonly display: string
  /** The absolute path of the snapshot folder or the export file. */
  readonly path: string
  /** A fetched snapshot, one export file, or a folder of JSON export files. */
  readonly kind: 'snapshot' | 'file' | 'folder'
  /** The snapshot's manifest; absent for an export file. */
  readonly manifest: ImportSnapshotManifest | undefined
  /** The export kind: the manifest's, or the file's extension. */
  readonly exportKind: ImportExportKind
  /** The file name an export file was given, without its extension. */
  readonly stem: string
  /** Every `raw/` file, by snapshot path. */
  readonly raw: ReadonlyMap<string, Uint8Array>
}

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

const KIND_BY_EXTENSION: Readonly<Record<string, ImportExportKind>> = {
  '.csv': 'csv',
  '.xlsx': 'xlsx',
  '.json': 'json',
  '.zip': 'zip',
  '.sql': 'sql-dump',
}

const readCapped = async (path: string, display: string): Promise<Uint8Array> => {
  const info = await lstat(path)
  if (info.isSymbolicLink())
    return refuse(`Error: "${display}" is a symbolic link inside a snapshot; it is not followed.`)
  if (info.size > MAX_INPUT_BYTES) {
    return refuse(`Error: "${display}" is larger than 1 GiB, which the import does not read.`)
  }
  return new Uint8Array(await Bun.file(path).arrayBuffer())
}

const decodeManifest = Schema.decodeUnknownResult(ImportSnapshotManifestSchema)

const readManifest = async (folder: string, display: string): Promise<ImportSnapshotManifest> => {
  const text = await Bun.file(join(folder, IMPORT_SNAPSHOT_MANIFEST)).text()
  const parsed = (() => {
    try {
      return JSON.parse(text) as unknown
    } catch {
      // Not JSON at all: reported as an unreadable manifest just below.
      return undefined
    }
  })()
  const decoded = decodeManifest(parsed)
  if (decoded._tag === 'Failure') {
    return refuse(
      `Error: "${display}/${IMPORT_SNAPSHOT_MANIFEST}" is not a snapshot manifest the import reads.\n\n` +
        '  Fetch the snapshot again with `sovrium import fetch`.'
    )
  }
  return decoded.success
}

/** Read a snapshot folder's `raw/` files, every one checked against its hash. */
const readSnapshot = async (folder: string, display: string): Promise<ImportInput> => {
  const manifest = await readManifest(folder, display)
  const open = openCursors(manifest)
  if (open.length > 0) {
    return refuse(
      `Error: The snapshot in "${display}" is incomplete: the fetch stopped before the end of ${open.join(', ')}.\n\n` +
        '  Run the same `sovrium import fetch` into the same folder: it resumes where it stopped.'
    )
  }
  const rawFiles = manifest.files.filter((file) => file.path.startsWith('raw/'))
  const raw = await Promise.all(
    rawFiles.map(async (file) => {
      const path = normaliseSourcePath(file.path)
      if (path !== file.path)
        return refuse(`Error: The snapshot lists a path it may not: "${file.path}".`)
      const bytes = await readCapped(join(folder, path), `${display}/${path}`)
      if (sha256(bytes) !== file.sha256) {
        return refuse(
          `Error: "${display}/${path}" no longer holds the bytes the fetch wrote, so the snapshot is not converted.\n\n` +
            '  Fetch it again, or restore the file.'
        )
      }
      return [path, bytes] as const
    })
  )
  return {
    display,
    path: folder,
    kind: 'snapshot',
    manifest,
    exportKind: manifest.exportKind,
    stem: basename(folder),
    raw: new Map(raw),
  }
}

/** The JSON files a folder of exports may hold, at most. */
const MAX_FOLDER_FILES = 10_000

/**
 * A folder with no manifest, read as its JSON export files (a folder of
 * one-Zap or one-workflow files): every `.json` file under it, hidden entries
 * and symbolic links skipped, each as one `raw/<relative path>` entry.
 */
const readExportFolder = async (folder: string, display: string): Promise<ImportInput> => {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.json')
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)))
    .filter((path) => !path.split(/[/\\]/).some((part) => part.startsWith('.')))
    .toSorted()
  if (files.length === 0 || files.length > MAX_FOLDER_FILES) {
    return refuse(
      `Error: "${display}" is a folder but not a snapshot: it holds no ${IMPORT_SNAPSHOT_MANIFEST}${files.length === 0 ? ' and no JSON export file' : `, and more than ${String(MAX_FOLDER_FILES)} JSON files`}.\n\n` +
        '  Pass a snapshot written by `sovrium import fetch`, an export file, or a folder of JSON export files.'
    )
  }
  const raw = await Promise.all(
    files.map(
      async (path) =>
        [
          `raw/${path.replaceAll('\\', '/')}`,
          await readCapped(join(folder, path), `${display}/${path}`),
        ] as const
    )
  )
  return {
    display,
    path: folder,
    kind: 'folder',
    manifest: undefined,
    exportKind: 'json',
    stem: basename(folder),
    raw: new Map(raw),
  }
}

/** Read the conversion's input: a snapshot folder, an export file, or a folder of JSON exports. */
export const readImportInput = async (given: string): Promise<ImportInput> => {
  if (URL_INPUT.test(given)) {
    return refuse(
      `Error: "${addressForDisplay(given)}" is a URL. The conversion reads a local snapshot or export file, never the network.\n\n` +
        '  Fetch the tool first with `sovrium import fetch <source-uri>`, or download its export file.'
    )
  }
  const path = resolve(process.cwd(), given)
  const info = await lstat(path).catch(() => undefined)
  if (info === undefined) return refuse(`Error: No snapshot or export file at "${given}".`)
  if (info.isDirectory()) {
    const hasManifest = await Bun.file(join(path, IMPORT_SNAPSHOT_MANIFEST)).exists()
    return hasManifest ? readSnapshot(path, given) : readExportFolder(path, given)
  }
  const bytes = await readCapped(path, given)
  const extension = extname(path).toLowerCase()
  return {
    display: given,
    path,
    kind: 'file',
    manifest: undefined,
    exportKind: KIND_BY_EXTENSION[extension] ?? 'csv',
    stem: basename(path, extname(path)),
    raw: new Map([[`raw/${basename(path)}`, bytes]]),
  }
}

/** The one raw file of an export-file input, or the first raw file of a snapshot. */
export const firstRaw = (
  input: ImportInput
): { readonly name: string; readonly bytes: Uint8Array } | undefined => {
  const [entry] = [...input.raw.entries()].toSorted(([a], [b]) => a.localeCompare(b))
  return entry === undefined ? undefined : { name: entry[0].slice('raw/'.length), bytes: entry[1] }
}
