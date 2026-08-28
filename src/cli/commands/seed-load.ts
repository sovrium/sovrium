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

import { readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Schema } from 'effect'
import { SeedFileSchema, resolveSeedTableName } from '@/domain/models/seed'
import type { LoadedSeedFile } from '@/application/use-cases/seed/seed-plan'

/** Extensions a seed file may carry — the same set app configs accept. */
const SEED_EXTENSIONS = ['.yaml', '.yml', '.json'] as const

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

/** Parse one file's text into a plain object, or the reason it could not be. */
const parseSeedText = (
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

/** Read, parse and decode one seed file. */
const loadOne = async (
  seedDir: string,
  fileName: string
): Promise<{ readonly file: LoadedSeedFile } | { readonly error: string }> => {
  const text = await Bun.file(join(seedDir, fileName)).text()
  const parsed = parseSeedText(fileName, text)
  if (!parsed.ok) return { error: parsed.error }

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
      fileName: basename(fileName),
      table: resolveSeedTableName(decoded.success, fileName),
      mergeOn: decoded.success.mergeOn,
      records: decoded.success.records.map((record) => ({
        key: record.key,
        fields: record.fields,
      })),
    },
  }
}

/** Every seed file in `seedDir`, or every reason one could not be read. */
export const loadSeedFiles = async (
  seedDir: string
): Promise<
  | { readonly ok: true; readonly files: readonly LoadedSeedFile[] }
  | { readonly ok: false; readonly errors: readonly string[] }
> => {
  const names = await discoverSeedFiles(seedDir)
  const outcomes = await Promise.all(names.map((name) => loadOne(seedDir, name)))
  const errors = outcomes.flatMap((outcome) => ('error' in outcome ? [outcome.error] : []))
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, files: outcomes.flatMap((outcome) => ('file' in outcome ? [outcome.file] : [])) }
}
