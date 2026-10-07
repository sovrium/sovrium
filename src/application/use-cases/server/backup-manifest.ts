/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The archive contract `sovrium backup` writes and `sovrium restore` reads
 * (`formatVersion: 1`).
 *
 * One gzipped tar: `manifest.json`, `database/database.db` (SQLite) or
 * `database/dump.sql` (PostgreSQL), `encryption-key` when the key lives in the
 * data directory, `project/<config tree>` and `storage/<local uploads>`. The
 * manifest lists every other entry with its size and sha256 — restore writes
 * ONLY what the manifest lists, and only once every checksum matched.
 *
 * Changing a field here changes a file format operators keep for years. Add
 * optional fields; never rename or remove one without a `formatVersion` bump.
 */

export const BACKUP_FORMAT = 'sovrium-backup'
export const BACKUP_FORMAT_VERSION = 1

export const MANIFEST_ENTRY = 'manifest.json'
export const SQLITE_ENTRY = 'database/database.db'
export const POSTGRES_ENTRY = 'database/dump.sql'
export const KEY_ENTRY = 'encryption-key'
export const PROJECT_PREFIX = 'project/'
export const STORAGE_PREFIX = 'storage/'

/** The variable an environment-supplied key is read from. */
export const KEY_ENVIRONMENT_VARIABLE = 'SOVRIUM_ENCRYPTION_KEY'

/** The reason the manifest gives for leaving `.env` out. */
export const ENV_FILE_EXCLUSION = {
  path: '.env',
  reason: 'secrets stay in your own secret store',
} as const

const ManifestFileSchema = Schema.Struct({
  path: Schema.String,
  size: Schema.Int,
  sha256: Schema.String,
})

const EncryptionKeySchema = Schema.Union([
  Schema.Struct({ source: Schema.Literal('file'), path: Schema.String }),
  Schema.Struct({
    source: Schema.Literal('environment'),
    variable: Schema.String,
    included: Schema.Literal(false),
  }),
])

const StorageSchema = Schema.Union([
  Schema.Struct({ provider: Schema.Literal('local'), path: Schema.String }),
  Schema.Struct({
    provider: Schema.Literals(['s3', 'database']),
    bucket: Schema.optionalKey(Schema.String),
    files: Schema.Int,
    included: Schema.Literal(false),
  }),
])

export const BackupManifestSchema = Schema.Struct({
  format: Schema.Literal(BACKUP_FORMAT),
  formatVersion: Schema.Int,
  engineVersion: Schema.String,
  createdAt: Schema.String,
  app: Schema.Struct({ name: Schema.String, config: Schema.String }),
  database: Schema.Struct({
    dialect: Schema.Literals(['sqlite', 'postgres']),
    path: Schema.Literals([SQLITE_ENTRY, POSTGRES_ENTRY]),
  }),
  encryptionKey: EncryptionKeySchema,
  storage: StorageSchema,
  excluded: Schema.Array(Schema.Struct({ path: Schema.String, reason: Schema.String })),
  files: Schema.Array(ManifestFileSchema),
})

export type BackupManifest = Schema.Schema.Type<typeof BackupManifestSchema>
export type BackupManifestStorage = Schema.Schema.Type<typeof StorageSchema>

/**
 * Whether an entry path is one restore may write: under a known prefix, or one
 * of the two fixed entries, and never climbing out with `..` or starting at `/`.
 *
 * A crafted archive naming `project/../../etc/passwd` is not a Sovrium backup,
 * and is refused as one before anything is compared.
 */
export const isRestorableEntry = (path: string): boolean => {
  const segments = path.split('/')
  const safe =
    !path.startsWith('/') &&
    !path.includes('\\') &&
    segments.every((segment) => segment !== '..' && segment !== '.' && segment !== '')
  const known =
    path === SQLITE_ENTRY ||
    path === POSTGRES_ENTRY ||
    path === KEY_ENTRY ||
    (path.startsWith(PROJECT_PREFIX) && path.length > PROJECT_PREFIX.length) ||
    (path.startsWith(STORAGE_PREFIX) && path.length > STORAGE_PREFIX.length)
  return safe && known
}

/**
 * Read `manifest.json` bytes into a manifest, or `undefined` when they are not
 * one in this format: unparsable JSON, a foreign shape, an unknown format, or
 * an entry restore would refuse to write.
 */
export const parseBackupManifest = (bytes: Uint8Array | undefined): BackupManifest | undefined => {
  if (bytes === undefined) return undefined
  const json = ((): unknown => {
    try {
      return JSON.parse(new TextDecoder().decode(bytes))
    } catch {
      return undefined
    }
  })()
  const decoded = Schema.decodeUnknownOption(BackupManifestSchema)(json)
  if (decoded._tag === 'None') return undefined
  const manifest = decoded.value
  return manifest.files.every((file) => isRestorableEntry(file.path)) ? manifest : undefined
}

const twoDigits = (value: number): string => String(value).padStart(2, '0')

/**
 * `sovrium-backup-<app>-<YYYYMMDD>-<HHMMSS>.tar.gz`, on the operator's clock.
 *
 * The app name is reduced to the characters a file name can always carry, so a
 * config named `Atelier / Marceau` still lands as one file in the current
 * directory rather than in a subdirectory nobody created.
 */
export const defaultArchiveName = (appName: string, at: Readonly<Date>): string => {
  const slug = appName.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'app'
  const day = `${at.getFullYear()}${twoDigits(at.getMonth() + 1)}${twoDigits(at.getDate())}`
  const time = `${twoDigits(at.getHours())}${twoDigits(at.getMinutes())}${twoDigits(at.getSeconds())}`
  return `sovrium-backup-${slug}-${day}-${time}.tar.gz`
}
