/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Read a `seed/` directory into the shape the planner validates.
 *
 * The only I/O concern here is *naming the file*. A directory of seed files
 * fails as a set — one unparseable file, one wrong table name — and an error
 * that does not say which file it came from forces the operator to bisect a
 * directory by hand, on a host where the run is a systemd unit and the only
 * artefact is a journal line.
 */

import { readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Schema } from 'effect'
import {
  SeedFileSchema,
  SeedUsersFileSchema,
  findDuplicateAccountEmails,
  isSeedUsersFile,
  resolveSeedTableName,
} from '@/domain/models/seed'
import {
  SEED_IMPORT_LAYER,
  SEED_JSONL_EXTENSION,
  parseSeedJsonl,
} from '@/domain/models/seed/seed-jsonl'
import type { LoadedSeedFile } from '@/application/use-cases/seed/seed-plan'
import type { SeedAccount } from '@/domain/models/seed'

/** Extensions a seed file may carry — the app config set, plus JSON Lines for large tables. */
const SEED_EXTENSIONS = ['.yaml', '.yml', '.json', SEED_JSONL_EXTENSION] as const

/** Every seed file in a directory, sorted, excluding `assets/` and dotfiles. */
export const discoverSeedFiles = async (seedDir: string): Promise<readonly string[]> => {
  const entries = await readdir(seedDir, { withFileTypes: true })
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.name.startsWith('.') &&
        SEED_EXTENSIONS.some((extension) => entry.name.endsWith(extension))
    )
    .map((entry) => entry.name)
    .toSorted()
}

const decodeSeedFile = Schema.decodeUnknownResult(SeedFileSchema)
const decodeUsersFile = Schema.decodeUnknownResult(SeedUsersFileSchema)

/** What one file in the seed folder turned out to be. */
type LoadOutcome =
  | { readonly file: LoadedSeedFile }
  | { readonly accounts: readonly SeedAccount[] }
  | { readonly error: string }

/** Decode an accounts file (`users:` at the top level). */
const loadAccounts = (fileName: string, parsed: unknown): LoadOutcome => {
  const decoded = decodeUsersFile(parsed)
  return decoded._tag === 'Failure'
    ? {
        error:
          `${fileName}: not a valid accounts file — ${decoded.failure.message}\n` +
          `  Expected: users: [ { email: <address>, name: <name>, role: <role>, password?: <secret> } ].`,
      }
    : { accounts: decoded.success.users }
}

/** Parse one file's text into a plain object, or the reason it could not be. */
export const parseSeedText = (
  fileName: string,
  text: string
):
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: string } => {
  try {
    return {
      ok: true,
      value: fileName.endsWith('.json') ? JSON.parse(text) : Bun.YAML.parse(text),
    }
  } catch (error) {
    return {
      ok: false,
      error: `${fileName}: could not be parsed — ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/** A `.jsonl` seed file: the header line, then one record per line. */
const loadJsonl = (fileName: string, text: string): LoadOutcome => {
  const read = parseSeedJsonl(text)
  if (!read.ok) return { error: `${fileName}, line ${String(read.line)}: ${read.message}` }
  return {
    file: {
      fileName,
      table: read.file.table ?? basename(fileName, SEED_JSONL_EXTENSION),
      mergeOn: read.file.mergeOn,
      records: read.file.records.map((record) => ({ key: record.key, fields: record.fields })),
    },
  }
}

/** Read, parse and decode one seed file. `prefix` names its layer in every message. */
const loadOne = async (seedDir: string, fileName: string, prefix = ''): Promise<LoadOutcome> => {
  const text = await Bun.file(join(seedDir, fileName)).text()
  if (fileName.endsWith(SEED_JSONL_EXTENSION)) return loadJsonl(`${prefix}${fileName}`, text)
  const parsed = parseSeedText(fileName, text)
  if (!parsed.ok) return { error: parsed.error }
  if (isSeedUsersFile(parsed.value)) return loadAccounts(fileName, parsed.value)

  const decoded = decodeSeedFile(parsed.value)
  if (decoded._tag === 'Failure') {
    return {
      error:
        `${fileName}: not a valid seed file — ${decoded.failure.message}\n` +
        `  Expected: records: [ { key: <name>, fields: { … } } ], with an optional mergeOn: [ … ].`,
    }
  }

  return {
    file: {
      fileName: `${prefix}${basename(fileName)}`,
      table: resolveSeedTableName(decoded.success, fileName),
      mergeOn: decoded.success.mergeOn,
      records: decoded.success.records.map((record) => ({
        key: record.key,
        fields: record.fields,
      })),
    },
  }
}

/** What reading a seed folder gave. */
type SeedLoad =
  | {
      readonly ok: true
      readonly files: readonly LoadedSeedFile[]
      readonly accounts: readonly SeedAccount[]
      /** Whether the folder holds an accounts file at all, even one listing nobody. */
      readonly accountsFile: boolean
    }
  | { readonly ok: false; readonly errors: readonly string[] }

/**
 * A table seeded from both layers — `seed/<table>.yaml` and
 * `seed/import/<table>.yaml` — is refused, naming both files: two files
 * competing for one table are never merged silently.
 */
const seededTwice = (files: readonly LoadedSeedFile[]): readonly string[] =>
  [...Map.groupBy(files, (file) => file.table).entries()].flatMap(([table, same]) => {
    const layers = new Set(same.map((file) => file.fileName.startsWith(`${SEED_IMPORT_LAYER}/`)))
    return layers.size > 1
      ? [
          `${same.map((file) => `seed/${file.fileName}`).join(' and ')} both seed the table "${table}". ` +
            'Keep one of them: the seed/import/ layer holds imported data, seed/ the files you write.',
        ]
      : []
  })

/**
 * Every seed file in `seedDir` — table files and the accounts `users:` files
 * list — or every reason one could not be read. With `layered`, the
 * `seed/import/` layer beside them is read too, as one set.
 */
export const loadSeedFiles = async (seedDir: string, layered = false): Promise<SeedLoad> => {
  const names = await discoverSeedFiles(seedDir)
  const layer = join(seedDir, SEED_IMPORT_LAYER)
  const withLayer = layered && (await stat(layer).catch(() => undefined))?.isDirectory() === true
  const layerNames = withLayer ? await discoverSeedFiles(layer) : []
  const outcomes = await Promise.all([
    ...names.map((name) => loadOne(seedDir, name)),
    ...layerNames.map((name) => loadOne(layer, name, `${SEED_IMPORT_LAYER}/`)),
  ])
  const files = outcomes.flatMap((outcome) => ('file' in outcome ? [outcome.file] : []))
  const accounts = outcomes.flatMap((outcome) => ('accounts' in outcome ? outcome.accounts : []))
  const errors = [
    ...outcomes.flatMap((outcome) => ('error' in outcome ? [outcome.error] : [])),
    ...seededTwice(files),
    ...findDuplicateAccountEmails(accounts).map(
      (email) => `accounts: "${email}" is listed more than once. Each email must name one account.`
    ),
  ]
  return errors.length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        files,
        accounts,
        accountsFile: outcomes.some((outcome) => 'accounts' in outcome),
      }
}
