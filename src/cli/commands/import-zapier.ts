/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import` — reading Zapier Zaps: an export file (`Zapfile.json`, an
 * "Export Zaps" download), the "Export my data" ZIP that holds `Zapfile.json`,
 * a one-Zap API dump, or a folder of them.
 *
 * From the ZIP only `Zapfile.json` is read: its siblings are run history and
 * other products, which are not Zap definitions. The member is held to the
 * size its directory declares, so a ZIP cannot inflate past what it said.
 */

import {
  readZipDirectory,
  readZipEntries,
} from '@/application/use-cases/automations/action-handlers/file-zip-read'
import { ZAPFILE_ENTRY } from '@/domain/models/import/import-detection-service'
import {
  adaptZapierExport,
  type ZapierDocument,
} from '@/domain/models/import/zapier-adapter-service'
import { refuse } from './app-prelude'
import { firstRaw, type ImportInput } from './import-input'
import type { SourceRead } from './import-sources'

/** The largest `Zapfile.json` the import inflates: 512 MiB. */
const MAX_ZAPFILE_BYTES = 512 * 1024 * 1024

/** The most the whole ZIP may inflate to, since every member is read: 2 GiB. */
const MAX_ZIP_BYTES = 2 * 1024 * 1024 * 1024

const NEVER_IMPORTABLE = [
  {
    what: 'Zapier connections',
    reason:
      'No Zapier export carries a credential: each app the Zaps used is reconnected in Sovrium, from the env names the report lists.',
  },
]

const parse = (bytes: Uint8Array): unknown => {
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    // Not JSON: refused by name below.
    return undefined
  }
}

/** The `Zapfile.json` members of an "Export my data" ZIP. */
const zapfilesOf = (input: ImportInput): readonly ZapierDocument[] => {
  const bytes = firstRaw(input)?.bytes ?? new Uint8Array()
  const directory = readZipDirectory(bytes)
  if (directory === undefined) {
    return refuse(`Error: "${input.display}" cannot be opened as a ZIP archive.`)
  }
  const wanted = directory.filter((entry) => ZAPFILE_ENTRY.test(entry.name))
  if (wanted.length === 0) {
    return refuse(`Error: "${input.display}" holds no Zapfile.json, so it holds no Zap.`)
  }
  const total = directory.reduce((sum, entry) => sum + entry.uncompressedSize, 0)
  if (wanted.some((entry) => entry.uncompressedSize > MAX_ZAPFILE_BYTES) || total > MAX_ZIP_BYTES) {
    return refuse(
      `Error: "${input.display}" is larger than the import reads (a 512 MiB Zapfile.json, 2 GiB in all).`
    )
  }
  const names = new Set(wanted.map((entry) => entry.name))
  const entries = readZipEntries(bytes, { boundByDeclaredSize: true })
  if (entries === undefined) {
    return refuse(`Error: "${input.display}" holds a member that cannot be read.`)
  }
  return entries
    .filter((entry) => names.has(entry.name))
    .map((entry) => ({ path: entry.name, json: parse(entry.bytes) }))
}

const documentsOf = (input: ImportInput): readonly ZapierDocument[] =>
  input.exportKind === 'zip'
    ? zapfilesOf(input)
    : [...input.raw.entries()].map(([path, bytes]) => ({ path, json: parse(bytes) }))

/** Every Zap of a Zapier input. */
export const readZapier = (input: ImportInput): SourceRead => {
  const documents = documentsOf(input)
  const unreadable = documents.find((document) => document.json === undefined)
  if (unreadable !== undefined) {
    return refuse(
      `Error: "${input.display}" cannot be read as a Zapier export: ${unreadable.path} is not JSON.`
    )
  }
  const read = adaptZapierExport(documents)
  if (read.flows.length === 0) {
    return refuse(
      `Error: "${input.display}" holds no Zap.\n\n` +
        '  Pass the Zapfile.json of "Export my data" (or its ZIP), the "Export Zaps" download, or one-Zap JSON files.'
    )
  }
  return { flows: read.flows, flowNotes: read.notes, neverImportable: NEVER_IMPORTABLE }
}
