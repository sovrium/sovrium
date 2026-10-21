/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import` — reading Baserow: a workspace export ZIP, or a snapshot
 * its REST API was fetched into.
 *
 * ─── THE ZIP IS READ, NEVER EXTRACTED ─────────────────────────────────────
 *
 * Nothing is unpacked onto the disk: members are read into memory and the
 * user files the records reference are written later, by the writer, under
 * their content hash. Even so the archive is held to the shape Baserow
 * writes, and refused otherwise, before any member is inflated:
 *
 * - every member sits at the root: a name holding `/`, `\`, a drive colon or
 *   a leading dot (`..` among them) is refused — the zip-slip guard;
 * - at most {@link MAX_ENTRIES} members, none declaring more than
 *   {@link MAX_ENTRY_BYTES}, all together no more than {@link MAX_TOTAL_BYTES},
 *   and each member inflated no further than the size it declared.
 */

import { createHash } from 'node:crypto'
import {
  readZipDirectory,
  readZipEntries,
} from '@/application/use-cases/automations/action-handlers/file-zip-read'
import {
  adaptBaserowExport,
  isBaserowDatabase,
} from '@/domain/models/import/baserow-export-adapter-service'
import {
  adaptBaserowAutomations,
  isBaserowAutomation,
} from '@/domain/models/import/baserow-flow-adapter-service'
import { adaptBaserowSnapshot } from '@/domain/models/import/baserow-rest-adapter-service'
import { refuse } from './app-prelude'
import { firstRaw, type ImportInput } from './import-input'
import type { SourceRead } from './import-sources'
import type { CanonicalBase } from '@/domain/models/import/canonical-base'

/** Members a workspace export may hold. */
const MAX_ENTRIES = 100_000
/** The largest member, as declared: 512 MiB. */
const MAX_ENTRY_BYTES = 512 * 1024 * 1024
/** Every member together, as declared: 2 GiB. */
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024

/** The members that are the export's own bookkeeping, never a user file. */
const BOOKKEEPING = new Set(['manifest.json', 'manifest_signature.json'])

/** An application member: `<type>__<uuid hex>_<sha256>.json`. */
const APPLICATION_MEMBER = /^[a-z_]+__[0-9a-f]{32}_[0-9a-f]{64}\.json$/

/** A member name that stays at the root of the archive. */
const isFlatName = (name: string): boolean =>
  name !== '' && !/[/\\:]/.test(name) && !name.startsWith('.') && name.length <= 255

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

const parse = (bytes: Uint8Array): unknown => {
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    // Not JSON: the member is not an application, and is read as a user file.
    return undefined
  }
}

/** The archive's members, refused unless every one has the shape Baserow writes. */
const membersOf = (input: ImportInput): ReadonlyMap<string, Uint8Array> => {
  const bytes = firstRaw(input)?.bytes ?? new Uint8Array()
  const directory = readZipDirectory(bytes)
  if (directory === undefined) {
    return refuse(`Error: "${input.display}" cannot be opened as a ZIP archive.`)
  }
  const outside = directory.find((entry) => !isFlatName(entry.name))
  if (outside !== undefined) {
    return refuse(
      `Error: "${input.display}" holds a member outside its root ("${outside.name}"), which a Baserow export never does. Nothing was read.`
    )
  }
  const total = directory.reduce((sum, entry) => sum + entry.uncompressedSize, 0)
  if (
    directory.length > MAX_ENTRIES ||
    directory.some((entry) => entry.uncompressedSize > MAX_ENTRY_BYTES) ||
    total > MAX_TOTAL_BYTES
  ) {
    return refuse(
      `Error: "${input.display}" is larger than the import reads (${String(MAX_ENTRIES)} members, 512 MiB each, 2 GiB in all).`
    )
  }
  const entries = readZipEntries(bytes, { boundByDeclaredSize: true })
  if (entries === undefined) {
    return refuse(`Error: "${input.display}" holds a member that cannot be read.`)
  }
  return new Map(entries.map((entry) => [entry.name, entry.bytes] as const))
}

/** The extension a user file keeps, lower-case, from its internal name. */
const extensionOf = (name: string): string =>
  /\.([A-Za-z0-9]{1,8})$/.exec(name)?.[1]?.toLowerCase() ?? ''

/** The user files: each one's asset path (`assets/<sha256>.<ext>`), and its bytes by that path. */
const userFilesOf = (
  members: ReadonlyMap<string, Uint8Array>,
  applications: ReadonlySet<string>
) => {
  const files = [...members.entries()].filter(
    ([name]) => !BOOKKEEPING.has(name) && !applications.has(name)
  )
  const pathOf = new Map(
    files.map(([name, bytes]) => {
      const extension = extensionOf(name)
      return [name, `assets/${sha256(bytes)}${extension === '' ? '' : `.${extension}`}`] as const
    })
  )
  const assets = new Map(files.map(([name, bytes]) => [pathOf.get(name) ?? name, bytes] as const))
  return { pathOf, assets }
}

/** How the flows name the base's tables and fields, by their Baserow ids. */
const namesOf = (base: CanonicalBase) => {
  const tables = new Map(base.tables.map((table) => [table.sourceId, table] as const))
  return {
    table: (tableId: string) => tables.get(tableId)?.name,
    field: (tableId: string, fieldId: string) =>
      tables.get(tableId)?.fields.find((field) => field.sourceId === fieldId)?.name,
  }
}

/** Read a Baserow workspace export ZIP: its databases, its automations and its user files. */
export const readBaserowZip = (input: ImportInput): SourceRead => {
  const members = membersOf(input)
  if (!members.has('manifest.json')) {
    return refuse(
      `Error: "${input.display}" is not a Baserow workspace export: it holds no manifest.json.`
    )
  }
  const parsed = [...members.entries()]
    .filter(([name]) => APPLICATION_MEMBER.test(name))
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([name, bytes]) => ({ name, json: parse(bytes) }))
  const databases = parsed.flatMap((one) => (isBaserowDatabase(one.json) ? [one.json] : []))
  const automations = parsed.flatMap((one) => (isBaserowAutomation(one.json) ? [one.json] : []))
  const { pathOf, assets } = userFilesOf(members, new Set(parsed.map((one) => one.name)))
  const tables = adaptBaserowExport(databases, { assetOf: (name) => pathOf.get(name) })
  const flows = adaptBaserowAutomations(automations, namesOf(tables.base))
  return {
    ...(databases.length === 0 ? {} : { tables }),
    ...(automations.length === 0 ? {} : { flows }),
    assets,
  }
}

/** Read a snapshot `sovrium import fetch baserow:…` wrote. */
export const readBaserowSnapshot = (input: ImportInput): SourceRead => {
  const raw = new Map(
    [...input.raw.entries()].flatMap(([path, bytes]) => {
      const json = parse(bytes)
      return json === undefined ? [] : [[path, json] as const]
    })
  )
  const databaseId = input.manifest?.source.ids[0]
  if (databaseId === undefined) {
    return refuse(`Error: The snapshot in "${input.display}" names no Baserow database.`)
  }
  return { tables: adaptBaserowSnapshot(raw, databaseId) }
}
