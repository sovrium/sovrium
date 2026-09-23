/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as path from 'node:path'
import { parseProjectDir } from './desktop'

/**
 * Base directory for runtime-generated artifacts (frugal-by-default, single
 * folder). Consolidating the zero-config SQLite database, the server lock file,
 * and local file storage under one `./.sovrium/` directory keeps a fresh
 * project root clean instead of scattering `database.db`, `lock`, and
 * `storage/` across the working directory.
 *
 * Default layout mirrors the operator's env-var vocabulary (purpose-named,
 * never product-named) so `ls .sovrium/` self-documents:
 *
 *     .sovrium/
 *       database.db    ← SQLite default (DATABASE_URL overrides)
 *       encryption-key ← per-install root secret (SOVRIUM_ENCRYPTION_KEY overrides)
 *       lock           ← server PID + config hash (SOVRIUM_LOCK_DIR overrides)
 *       storage/       ← local file uploads (STORAGE_LOCAL_DIRECTORY overrides)
 *
 * `SOVRIUM_DATA_DIR` overrides the location. Each artifact also keeps its own
 * dedicated override env var (`DATABASE_URL`, `SOVRIUM_LOCK_DIR`,
 * `STORAGE_LOCAL_DIRECTORY`) which take precedence over the data-dir default —
 * `SOVRIUM_DATA_DIR` only changes the *fallback*. Operator-facing infrastructure
 * lives in env vars, never in the app schema.
 */
export const DEFAULT_DATA_DIR = './.sovrium'

/**
 * Resolve the base data directory to an absolute path.
 *
 * `SOVRIUM_DATA_DIR` overrides; unset/empty falls back to {@link DEFAULT_DATA_DIR}.
 * Resolved to an absolute path (mirroring `parseDatabaseDialectConfig`) so the
 * spawned server and any tooling agree on the same location regardless of CWD.
 *
 * Anchored on the PROJECT directory rather than the working directory, because
 * the data dir belongs to the project: `SOVRIUM_DATA_DIR=.sovrium` under two
 * different projects has to mean two different directories, or two apps opened
 * from one shell end up sharing a database. An absolute value is unaffected —
 * `path.resolve` returns it unchanged — and with no `SOVRIUM_PROJECT_DIR` set
 * the project directory IS the working directory, so nothing that resolves
 * today resolves differently.
 *
 * @public
 */
export const parseDataDir = (): string =>
  path.resolve(parseProjectDir(), process.env.SOVRIUM_DATA_DIR || DEFAULT_DATA_DIR)

/**
 * Default SQLite database file path (`<dataDir>/database.db`), used when
 * `DATABASE_URL` is unset. Overridden by `DATABASE_URL`.
 *
 * @public
 */
export const defaultSqliteDbPath = (): string => path.join(parseDataDir(), 'database.db')

/**
 * Default lock-file directory (the data dir itself). Overridden by
 * `SOVRIUM_LOCK_DIR`.
 *
 * @public
 */
export const defaultLockDir = (): string => parseDataDir()

/**
 * Default local file-storage directory (`<dataDir>/storage`), used in SQLite
 * (zero-config) mode. Overridden by `STORAGE_LOCAL_DIRECTORY`.
 *
 * @public
 */
export const defaultUploadsDir = (): string => path.join(parseDataDir(), 'storage')

/**
 * File name of the per-install root secret inside the data dir.
 *
 * Named here rather than in the crypto module so the CLI's `secret adopt` verb
 * and the runtime resolver cannot drift onto two different file names — a drift
 * whose only symptom would be an adopted key that the next boot ignores.
 *
 * @public
 */
export const ENCRYPTION_KEY_FILENAME = 'encryption-key'

/**
 * Default root-secret file path (`<dataDir>/encryption-key`).
 *
 * The secret lives beside the SQLite database it protects, so an ephemeral
 * filesystem loses both together instead of leaving unreadable ciphertext
 * behind. Overridden — in the sense of "not consulted at all" — by
 * `SOVRIUM_ENCRYPTION_KEY`.
 *
 * @public
 */
export const defaultEncryptionKeyPath = (): string =>
  path.join(parseDataDir(), ENCRYPTION_KEY_FILENAME)
