/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The database and storage an install uses, read from the process environment
 * by the same parsers `sovrium start` uses — so `usage`, `backup` and
 * `restore` read exactly the install a start would boot, with its defaults and
 * refusals (an empty variable counts as unset, as it does there).
 *
 * Each command projects the result into its own request shape: `usage` and
 * `backup` keep different storage fields, and only `usage` makes the SQLite
 * path absolute. A parser's throw becomes `{ error }`, carrying its message for
 * the command's refusal.
 */

import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import {
  parseStorageEnvConfig,
  type StorageEnvConfig,
} from '@/domain/models/process-env/storage/storage'

/** Why the environment could not be read: the parser's own message. */
export interface EnvironmentRefusal {
  readonly error: string
}

/** The database `sovrium start` would boot. The SQLite path is as configured, not yet absolute. */
export type InstallDatabaseSource =
  | { readonly dialect: 'sqlite'; readonly path: string }
  | { readonly dialect: 'postgres'; readonly url: string }

/** Run one environment read, turning a throw into the refusal carrying its message. */
const readOrRefuse = <A>(read: () => A): A | EnvironmentRefusal => {
  try {
    return read()
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

const parseDatabaseSource = (): InstallDatabaseSource => {
  const dialect = parseDatabaseDialectConfig()
  return dialect.dialect === 'postgres'
    ? { dialect: 'postgres', url: dialect.databaseUrl }
    : { dialect: 'sqlite', path: dialect.path }
}

/** The database alone, or why the environment does not describe one. */
export const readDatabaseSource = (): InstallDatabaseSource | EnvironmentRefusal =>
  readOrRefuse(parseDatabaseSource)

/** The storage provider and its settings alone, or why the environment does not describe one. */
export const readStorageConfig = (): StorageEnvConfig | EnvironmentRefusal =>
  readOrRefuse(parseStorageEnvConfig)

/**
 * Both, the database read first: when both are wrong, the database's message
 * is the one reported.
 */
export const readInstallSources = ():
  | { readonly database: InstallDatabaseSource; readonly storage: StorageEnvConfig }
  | EnvironmentRefusal =>
  readOrRefuse(() => {
    const database = parseDatabaseSource()
    return { database, storage: parseStorageEnvConfig() }
  })
