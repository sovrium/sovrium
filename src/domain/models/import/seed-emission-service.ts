/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Records as seed files: the data half of a migration.
 *
 * Each imported table gets one seed file under the gitignored `seed/import/`
 * layer — YAML up to {@link SEED_JSONL_THRESHOLD} records, JSON Lines above it —
 * declaring `mergeOn: [source_id]`, so `sovrium seed --mode upsert` matches a
 * re-import onto the rows it wrote. A record's `key` is its source id (made to
 * fit the seed key pattern), so a link is written `@<table>.<key>` and
 * resolved by the seed's own reference pass, and a multi-valued link is a list
 * of them; a collaborator is `@user:<email>`, an attachment
 * `@asset:<sha256>/<filename>` — the folder named after the bytes, the file
 * after the name the source showed, so the seeded row keeps that name.
 *
 * This file decides the CONTENT of each file and renders the JSON Lines
 * spelling; the YAML spelling is rendered by the writer, which has a YAML
 * printer.
 */

import { DateTime, Option } from 'effect'
import {
  SEED_IMPORT_LAYER,
  SEED_JSONL_FORMAT,
  SEED_JSONL_THRESHOLD,
} from '@/domain/models/seed/seed-jsonl'
import { SOURCE_ID_FIELD } from './field-type-mappings'
import { seedKeysOf } from './import-names-service'
import type { CanonicalBase, CanonicalValue } from './canonical-base'
import type { ImportReport } from './import-report'
import type { MappedField, TablePlan } from './table-mapper-service'
import type { RecordIdentity } from './tabular-adapter-service'

type DataSection = NonNullable<ImportReport['data']>

/** One record of a seed file. */
export interface SeedRecordOut {
  readonly key: string
  readonly fields: Readonly<Record<string, unknown>>
}

/** One seed file the import writes. */
export interface PlannedSeedFile {
  readonly table: string
  /** Relative to the project: `seed/import/<table>.yaml` or `.jsonl`. */
  readonly path: string
  readonly format: 'yaml' | 'jsonl'
  readonly identity: RecordIdentity
  readonly mergeOn: readonly string[]
  readonly records: readonly SeedRecordOut[]
}

/** One attachment file the seed needs, copied byte for byte. */
export interface SeedAssetCopy {
  /** In the snapshot: `assets/<sha256>.<ext>`. */
  readonly from: string
  /** Under `seed/import/assets/`: `<sha256>/<filename>`. */
  readonly to: string
}

/** The seed half of a migration. */
export interface SeedPlan {
  readonly files: readonly PlannedSeedFile[]
  /** `seed/import/users.yaml`, when the records name collaborators. */
  readonly users: readonly { readonly email: string; readonly name: string }[]
  /** The files the records reference: each snapshot file and where it is copied. */
  readonly assets: readonly SeedAssetCopy[]
  readonly section: DataSection
}

/** The folder, relative to the project, the seed files go to. */
export const SEED_IMPORT_DIR = `seed/${SEED_IMPORT_LAYER}`

/**
 * The types whose values the database computes; a seed never writes them. An
 * `autonumber` is not one of them: the source's number is kept, written on
 * insert only, and the next new row continues after the highest.
 */
const COMPUTED_TYPES: ReadonlySet<string> = new Set([
  'formula',
  'rollup',
  'lookup',
  'count',
  'created-at',
  'updated-at',
  'created-by',
  'updated-by',
])

const ATTACHMENT_TYPES: ReadonlySet<string> = new Set(['single-attachment', 'multiple-attachments'])

const asArray = (value: CanonicalValue): readonly unknown[] =>
  Array.isArray(value) ? value : [value]

/** The SHA-256 a snapshot asset path is named after. */
const assetDigest = (path: string): string => {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.indexOf('.')
  return dot === -1 ? name : name.slice(0, dot)
}

/**
 * A source filename as an `@asset:` path segment: a letter or a digit first,
 * then letters, digits, `.`, `_` and `-`; anything else becomes `-`.
 */
export const assetSegment = (filename: string): string => {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, '-')
  return /^[A-Za-z0-9]/.test(safe) ? safe : `file-${safe}`
}

/** Where one attachment of a record is copied under `seed/import/assets/`, or `undefined`. */
const assetCopyOf = (item: unknown): SeedAssetCopy | undefined => {
  const file = item as { readonly asset?: unknown; readonly filename?: unknown } | null
  if (typeof file?.asset !== 'string') return undefined
  const name =
    typeof file.filename === 'string' && file.filename.length > 0 ? file.filename : file.asset
  return { from: file.asset, to: `${assetDigest(file.asset)}/${assetSegment(name)}` }
}

/** A value as text, for a field kept as text. */
const asText = (value: CanonicalValue): string =>
  asArray(value)
    .map((item) => {
      if (item === null || typeof item !== 'object') return String(item)
      const object = item as Readonly<Record<string, unknown>>
      return String(
        object['email'] ?? object['filename'] ?? object['record'] ?? JSON.stringify(item)
      )
    })
    .join(', ')

type KeyOf = (table: string, record: string) => string | undefined

/** One list or one item: a single value stays single, several become a list. */
const oneOrMany = (items: readonly string[], many: boolean): unknown => {
  if (items.length === 0) return undefined
  return many && items.length > 1 ? items : items[0]
}

const linkValue = (field: MappedField, value: CanonicalValue, keyOf: KeyOf): unknown => {
  const listed = asArray(value).flatMap((item) => {
    const link = item as {
      readonly kind?: unknown
      readonly table?: unknown
      readonly record?: unknown
    }
    if (link.kind !== 'link' || typeof link.record !== 'string') return []
    const key = keyOf(String(link.table), link.record)
    return key === undefined ? [] : [`@${field.relatedTable ?? ''}.${key}`]
  })
  // A multi-valued link is a list, even of one, in one order whatever the source's.
  if (field.multiple === true) return listed.length === 0 ? undefined : listed.toSorted()
  return oneOrMany(listed, Array.isArray(value))
}

const userValue = (value: CanonicalValue): unknown =>
  oneOrMany(
    asArray(value).flatMap((item) => {
      const email = (item as { readonly email?: unknown } | null)?.email
      return typeof email === 'string' ? [`@user:${email}`] : []
    }),
    true
  )

const attachmentValue = (field: MappedField, value: CanonicalValue): unknown => {
  const files = asArray(value).flatMap((item) => {
    const copy = assetCopyOf(item)
    return copy === undefined ? [] : [`@asset:${copy.to}`]
  })
  if (files.length === 0) return undefined
  return field.type === 'single-attachment' ? files[0] : files
}

/** The types whose value is a list, written as one. */
const LIST_TYPES: ReadonlySet<string> = new Set(['multi-select', 'array'])

/** A JSON field's value: the document its source text holds, or the text itself. */
const jsonValue = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown
  } catch {
    // Not a JSON document: the text is the value.
    return value
  }
}

/**
 * A date-time with an offset, as one UTC instant spelled as the database reads
 * it back (`2026-10-01T09:30:00.000Z`), so a re-run compares equal; a value
 * that names no zone is read as UTC. Anything that is not a date-time is left.
 */
const instantValue = (value: string): string => {
  const zoned = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(value) ? value : `${value}Z`
  return Option.match(DateTime.make(zoned), {
    onNone: () => value,
    onSome: (instant) => DateTime.formatIso(instant),
  })
}

/**
 * The instant the source created a record, as the `created_at` its row keeps;
 * nothing when the source gave none, or gave text that is not an instant.
 */
const creationOf = (createdAt: string | undefined): { readonly created_at?: string } => {
  if (createdAt === undefined || createdAt.trim() === '') return {}
  const instant = instantValue(createdAt)
  return Option.isNone(DateTime.make(instant)) ? {} : { created_at: instant }
}

/** The types whose text value is rewritten before it is seeded. */
const TEXT_VALUES: Readonly<Record<string, (value: string) => unknown>> = {
  json: jsonValue,
  datetime: instantValue,
}

/** The types whose value names one of their options. */
const OPTION_TYPES: ReadonlySet<string> = new Set(['single-select', 'multi-select', 'status'])

/** A select's value with its empty choices left out: the import drops the unnamed option. */
const optionValue = (field: MappedField, value: CanonicalValue): CanonicalValue | undefined => {
  if (!OPTION_TYPES.has(field.type)) return value
  if (value === '') return undefined
  return Array.isArray(value) ? value.filter((item) => item !== '') : value
}

/** A plain value: a list kept for a list type, text for a field kept as text. */
const plainValue = (field: MappedField, value: CanonicalValue): unknown => {
  if (LIST_TYPES.has(field.type) && Array.isArray(value)) return value
  const rewrite = TEXT_VALUES[field.type]
  if (rewrite !== undefined && typeof value === 'string') return rewrite(value)
  const structured = Array.isArray(value) || (value !== null && typeof value === 'object')
  return structured || (field.type === 'long-text' && typeof value !== 'string')
    ? asText(value)
    : value
}

/** An autonumber's value: the number the source gave the record, or nothing. */
const autonumberValue = (value: CanonicalValue): number | undefined => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof number === 'number' && Number.isInteger(number) ? number : undefined
}

/** One cell as a seed value, or `undefined` when nothing is written. */
const seedValue = (field: MappedField, value: CanonicalValue, keyOf: KeyOf): unknown => {
  if (!field.seeded || COMPUTED_TYPES.has(field.type)) return undefined
  if (field.type === 'autonumber') return autonumberValue(value)
  if (field.type === 'relationship') return linkValue(field, value, keyOf)
  if (field.type === 'user') return userValue(value)
  if (ATTACHMENT_TYPES.has(field.type)) return attachmentValue(field, value)
  const kept = optionValue(field, value)
  return kept === undefined ? undefined : plainValue(field, kept)
}

/** Every file a base's records reference, sorted by destination, once each. */
const assetsOf = (base: CanonicalBase): readonly SeedAssetCopy[] => {
  const copies = base.tables.flatMap((table) =>
    table.records.flatMap((record) =>
      Object.values(record.values).flatMap((value) =>
        asArray(value).flatMap((item) => {
          const copy = assetCopyOf(item)
          return copy === undefined ? [] : [copy]
        })
      )
    )
  )
  return [...new Map(copies.map((copy) => [copy.to, copy] as const)).values()].toSorted((a, b) =>
    a.to.localeCompare(b.to)
  )
}

/**
 * Plan the seed files of a mapped base.
 *
 * @param identities - how each table's records are keyed, by table source id; a
 *   table the adapter did not name is keyed by its source record ids.
 */
export const planSeedFiles = (
  base: CanonicalBase,
  plan: TablePlan,
  identities: Readonly<Record<string, RecordIdentity>>
): SeedPlan => {
  const keys = new Map(
    base.tables.map((table) => {
      const ids = table.records.map((record) => record.sourceId)
      const keyed = seedKeysOf(ids)
      return [
        table.sourceId,
        new Map(ids.map((id, index) => [id, keyed[index] ?? id] as const)),
      ] as const
    })
  )
  const keyOf = (table: string, record: string) => keys.get(table)?.get(record)
  const files = plan.tables.map((mapped): PlannedSeedFile => {
    const records = mapped.source.records.map((record) => {
      const fields = Object.fromEntries(
        mapped.fields.flatMap((field) => {
          const raw = record.values[field.source.sourceId]
          if (raw === undefined) return []
          const value = seedValue(field, raw, keyOf)
          return value === undefined ? [] : [[field.name, value] as const]
        })
      )
      const created = creationOf(record.createdAt)
      return {
        key: keyOf(mapped.source.sourceId, record.sourceId) ?? record.sourceId,
        fields: { [SOURCE_ID_FIELD]: record.sourceId, ...fields, ...created },
      }
    })
    const format = records.length > SEED_JSONL_THRESHOLD ? 'jsonl' : 'yaml'
    return {
      table: mapped.name,
      path: `${SEED_IMPORT_DIR}/${mapped.name}.${format}`,
      format,
      identity: identities[mapped.source.sourceId] ?? 'source-id',
      mergeOn: [SOURCE_ID_FIELD],
      records,
    }
  })
  const users = base.users.map((user) => ({
    email: user.email,
    name: user.name ?? user.email.slice(0, user.email.indexOf('@')),
  }))
  return {
    files,
    users,
    assets: assetsOf(base),
    section: {
      tables: files.map((file) => ({
        table: file.table,
        records: file.records.length,
        file: file.path,
        format: file.format,
        identity: file.identity,
      })),
      users: users.length,
    },
  }
}

/** A seed file in the JSON Lines spelling: the header line, then one record per line. */
export const renderSeedJsonl = (file: Pick<PlannedSeedFile, 'mergeOn' | 'records'>): string =>
  [
    JSON.stringify({ format: SEED_JSONL_FORMAT, version: 1, mergeOn: file.mergeOn }),
    ...file.records.map((record) => JSON.stringify({ key: record.key, fields: record.fields })),
  ].join('\n') + '\n'
