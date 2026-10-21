/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `snapshot.json` — the manifest of one snapshot folder, the boundary between
 * the online and the offline half of `sovrium import`.
 *
 * ```
 * <out>/
 *   snapshot.json            <- this file
 *   raw/…                    <- what the API returned, page by page, or the export file, untouched
 *   assets/<sha256>.<ext>    <- attachments, downloaded during the fetch because their URLs expire
 * ```
 *
 * The conversion reads the snapshot and nothing else, so the same snapshot
 * always yields the same bytes. That is what lets a team rehearse a migration
 * on Monday and cut over on Friday from the same folder.
 *
 * ## Where it lands
 *
 * By default under `.sovrium-imports/` (see {@link IMPORT_SNAPSHOT_ROOT});
 * `--out` overrides it, and an `--out` inside the instance's data directory is
 * refused.
 *
 * ## What the manifest never holds
 *
 * No token, no connection string, no credential of any kind. A source URI that
 * carries one (a Postgres URL) is recorded by the name of the environment
 * variable it was read from, never by value.
 *
 * ## Resumable
 *
 * A large base outlives a rate limit: Airtable locks a base for 30 seconds
 * after a 429, and a Notion query returns at most 10,000 rows. Each paginated
 * resource therefore records its last cursor, and a second `fetch` into the
 * same folder resumes from it instead of starting over.
 */

import { Schema } from 'effect'
import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { ImportDomainSchema, ImportExportKindSchema, ImportSourceToolSchema } from './import-source'

/** The manifest format identifier. */
export const IMPORT_SNAPSHOT_FORMAT = 'sovrium.import-snapshot'

/**
 * Where `sovrium import fetch` writes a snapshot when `--out` is not given:
 * `.sovrium-imports/<tool>-<timestamp>/` in the project root. The folder is a
 * SIBLING of the instance's data directory `.sovrium/`, never inside it, and
 * the importer adds it to `.gitignore`: a snapshot holds the operator's records
 * and attachments, which have no place in a repository or in a folder an
 * instance reads.
 */
export const IMPORT_SNAPSHOT_ROOT = '.sovrium-imports'

/** The default snapshot folder name: `<tool>-<UTC timestamp>`, sortable and free of `:`. */
export const defaultSnapshotFolder = (tool: string, fetchedAt: string): string =>
  `${IMPORT_SNAPSHOT_ROOT}/${tool}-${fetchedAt.replace(/\.\d{1,3}Z$/, 'Z').replaceAll(':', '')}`

/** The file name of the manifest at the snapshot root. */
export const IMPORT_SNAPSHOT_MANIFEST = 'snapshot.json'

/**
 * A path inside the snapshot: relative, under `raw/` or `assets/`, with no
 * `..` segment, no backslash and no leading slash. The pattern is the zip-slip
 * guard at the schema level — a manifest naming a path outside its own folder
 * does not decode.
 */
const SNAPSHOT_FILE_PATH = /^(?!(?:.*\/)?\.\.(?:\/|$))(?:raw|assets)\/[^\\:]+$/

/**
 * Whether a path may be written or read inside a snapshot: the manifest's own
 * rule, asked by the writer too, so a path built from a vendor's id (`raw/
 * workflows/<id>.json`) never lands outside the folder whatever the id holds.
 */
export const isSnapshotFilePath = (path: string): boolean => SNAPSHOT_FILE_PATH.test(path)

/** The fetch's own index of the attachments it downloaded, beside the API's pages. */
export const IMPORT_ATTACHMENT_INDEX = 'raw/sovrium-attachments.json'

/** A downloaded attachment's place in the snapshot: `assets/<sha256>[.<ext>]`. */
const ASSET_PATH = /^assets\/[0-9a-f]{64}(?:\.[A-Za-z0-9]+)?$/

/** One downloaded attachment: its snapshot path and the file name the source gave it. */
export interface SnapshotAsset {
  readonly asset: string
  readonly filename: string
}

/**
 * The attachment index ({@link IMPORT_ATTACHMENT_INDEX}) as a map from the key
 * the fetch named each file with to where it sits in the snapshot. An entry
 * whose path is not an `assets/<sha256>` file is left out, so the conversion
 * never copies a file the index names from anywhere else.
 */
export const attachmentIndexOf = (index: unknown): ReadonlyMap<string, SnapshotAsset> =>
  new Map(
    arrayOf(index).flatMap((entry) => {
      if (!isRecord(entry)) return []
      const { source, asset, filename } = entry
      return typeof source === 'string' &&
        typeof asset === 'string' &&
        typeof filename === 'string' &&
        ASSET_PATH.test(asset)
        ? [[source, { asset, filename }] as const]
        : []
    })
  )

/** One file of the snapshot, with the hash that makes a replay verifiable. */
export const ImportSnapshotFileSchema = Schema.Struct({
  path: Schema.String.annotate({
    description: 'The path of the file inside the snapshot folder, under `raw/` or `assets/`',
    examples: ['raw/tables/tblContacts/records-0001.json', 'assets/3f9a….png'],
  }).check(Schema.isPattern(SNAPSHOT_FILE_PATH)),
  sha256: Schema.String.annotate({
    description: 'The SHA-256 of the file, lower-case hex',
  }).check(Schema.isPattern(/^[0-9a-f]{64}$/)),
  bytes: Schema.Int.annotate({ description: 'The size of the file in bytes' }).check(
    Schema.isGreaterThanOrEqualTo(0)
  ),
}).annotate({
  identifier: 'ImportSnapshotFile',
  title: 'Import Snapshot File',
  description: 'One file the snapshot holds, by path, hash and size.',
})

export type ImportSnapshotFile = Schema.Schema.Type<typeof ImportSnapshotFileSchema>

/** Where a paginated resource stopped, so a second fetch resumes it. */
export const ImportSnapshotCursorSchema = Schema.Struct({
  resource: Schema.String.annotate({
    description: 'The paginated resource, as the fetcher names it',
    examples: ['tables/tblContacts/records', 'data_sources/7d1e…/query'],
  }).check(Schema.isMinLength(1)),
  cursor: Schema.optional(
    Schema.String.annotate({
      description:
        "The source's own pagination cursor for the next page (Airtable's `offset`, Notion's `next_cursor`); absent once the resource is complete",
    })
  ),
  pages: Schema.Int.annotate({ description: 'How many pages were fetched so far' }).check(
    Schema.isGreaterThanOrEqualTo(0)
  ),
  complete: Schema.Boolean.annotate({
    description: 'Whether the last page was reached',
  }),
}).annotate({
  identifier: 'ImportSnapshotCursor',
  title: 'Import Snapshot Cursor',
  description: 'The resume point of one paginated resource.',
})

export type ImportSnapshotCursor = Schema.Schema.Type<typeof ImportSnapshotCursorSchema>

/** The decoded `snapshot.json`. */
export const ImportSnapshotManifestSchema = Schema.Struct({
  format: Schema.Literal(IMPORT_SNAPSHOT_FORMAT).annotate({
    description: 'The manifest format identifier',
  }),
  version: Schema.Literal(1).annotate({ description: 'The manifest version' }),
  tool: ImportSourceToolSchema,
  exportKind: ImportExportKindSchema,
  toolVersion: Schema.optional(
    Schema.String.annotate({
      description:
        "The source tool's own version when it states one (an n8n release, a Webflow export version)",
    })
  ),
  apiVersion: Schema.optional(
    Schema.String.annotate({
      description: 'The API version the fetch spoke, when the tool versions its API',
      examples: ['v0', '2025-09-03'],
    })
  ),
  fetchedAt: Schema.String.annotate({
    description: 'When the fetch ran, as an ISO 8601 UTC instant',
    examples: ['2026-10-19T08:30:00.000Z'],
  }).check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)),
  source: Schema.Struct({
    uri: Schema.String.annotate({
      description:
        'The source URI as the operator gave it. A connection string read from the environment is recorded as `$env.<NAME>`, never by value',
      examples: ['airtable:appX9kQ2vLmN7', 'retool-db:$env.RETOOL_DB_URL'],
    }),
    ids: Schema.Array(Schema.String).annotate({
      description: "The source's own ids of what was fetched: a base, its tables, a form, a site",
    }),
  }).annotate({ description: 'What was fetched, as the source names it' }),
  domains: Schema.Array(ImportDomainSchema).annotate({
    description: 'The parts of the app the snapshot holds, as `--only` selected them',
  }),
  attachments: Schema.Struct({
    downloaded: Schema.Int.annotate({ description: 'Attachments written under `assets/`' }).check(
      Schema.isGreaterThanOrEqualTo(0)
    ),
    skipped: Schema.Int.annotate({
      description:
        'Attachments not downloaded, because `--skip-attachments` was passed or the URL was refused',
    }).check(Schema.isGreaterThanOrEqualTo(0)),
  }).annotate({ description: 'What became of the attachments the source referenced' }),
  files: Schema.Array(ImportSnapshotFileSchema).annotate({
    description: 'Every file of the snapshot but the manifest, in path order',
  }),
  cursors: Schema.Array(ImportSnapshotCursorSchema).annotate({
    description: 'The resume point of each paginated resource, in resource order',
  }),
}).annotate({
  identifier: 'ImportSnapshotManifest',
  title: 'Import Snapshot Manifest',
  description:
    'The manifest of a snapshot folder written by `sovrium import fetch`: what was fetched, from which tool and API version, when, and the hash of every file.',
})

export type ImportSnapshotManifest = Schema.Schema.Type<typeof ImportSnapshotManifestSchema>

/**
 * Whether every paginated resource reached its last page.
 *
 * A conversion of an incomplete snapshot would silently drop the records the
 * fetch never reached, so the importer refuses one and names the resources
 * still open.
 */
export const openCursors = (manifest: ImportSnapshotManifest): readonly string[] =>
  manifest.cursors.filter((cursor) => !cursor.complete).map((cursor) => cursor.resource)
