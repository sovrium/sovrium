/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `system.links` row ↔ `LinkRecord` codec — both directions, and nothing
 * that talks to a database.
 *
 * Split out of `link-repository-live.ts` so that file is only queries. The two
 * directions belong together because they are one contract read twice: a column
 * decoded on the way out (`toLinkRecord`) and encoded on the way in
 * (`createValues` / `updateAssignments`) must agree about absence, about JSON
 * shape, and about timestamps, and keeping them apart is how they stop agreeing.
 *
 * Three properties of that contract are load-bearing and are asserted here
 * rather than by review:
 *
 *  1. **No manual `JSON.stringify` on write.** The links SQLite mirror declares
 *     `text('targets', { mode: 'json' })`, and Drizzle owns the codec for a
 *     `json`-mode column — stringifying first would store a JSON string *inside*
 *     a JSON column and read back as a quoted blob. The read path still parses
 *     defensively, because a row written before this module existed is not
 *     something this module gets to assume about.
 *
 *  2. **Dates go through the column mapping, never raw SQL.** The SQLite mirror
 *     stores `integer(..., { mode: 'timestamp_ms' })`; a `Date` bound into a raw
 *     `sql` fragment is silently coerced to NULL on `bun:sqlite`, so every write
 *     is emitted as a `Date` value for `.set()` / `.values()` to map.
 *
 * 3. **`passwordHash` is never selected into the returned record.** [internal ref] D5
 *     keeps it out of the console payload, and the row-mapper is the last place
 *     that promise can be made structurally.
 */

/* eslint-disable unicorn/no-null -- every nullable column and every port field is spelled `null`, not `undefined`: SQL has one absence marker and the port contract mirrors it, so `undefined` here would mean "leave alone" on a write and would silently drop the key on a read. */

import type {
  CreateLinkInput,
  LinkRecord,
  LinkTargetRecord,
  LinkUtmRecord,
  UpdateLinkInput,
} from '@/application/ports/repositories/links/link-repository'
import type { links as linksPg } from '@/infrastructure/database/drizzle/schema/links'

/** A selected row, in the pg spelling both dialects are read through. */
type LinkRow = Readonly<typeof linksPg.$inferSelect>

// ---------------------------------------------------------------------------
// Row → record (read)
// ---------------------------------------------------------------------------

/**
 * Normalise a timestamp column to ISO 8601.
 *
 * Postgres hands back a `Date`; SQLite's `timestamp_ms` mapping also hands back
 * a `Date`, but a row written by an older path (or a raw migration) can surface
 * as a number or a string, so all three are accepted rather than assumed away.
 */
const toIso = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  if (typeof value === 'number') return new Date(value).toISOString()
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString()
  }
  return null
}

/** `toIso` for the two NOT NULL columns, which must still produce a string. */
const toIsoRequired = (value: unknown): string => toIso(value) ?? new Date(0).toISOString()

/**
 * Decode a JSON column.
 *
 * `jsonb` (pg) and `text({ mode: 'json' })` (sqlite) both round-trip objects
 * through Drizzle, so the `string` branch is defensive rather than routine — it
 * covers a row written before the json mode was declared, where the alternative
 * is a whole page 500ing on one malformed cell.
 */
const readJson = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** Decode the `tags` column into a string array, dropping non-string entries. */
const readTags = (raw: unknown): readonly string[] => {
  const parsed = readJson(raw)
  return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : []
}

/** Decode the `targets` column into the port's target shape. */
const readTargets = (raw: unknown): readonly LinkTargetRecord[] | null => {
  const parsed = readJson(raw)
  if (!Array.isArray(parsed)) return null
  const targets = parsed
    .filter(
      (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null
    )
    .filter((entry) => typeof entry['to'] === 'string')
    .map((entry) => ({
      to: entry['to'] as string,
      ...(typeof entry['weight'] === 'number' ? { weight: entry['weight'] } : {}),
    }))
  return targets.length === 0 ? null : targets
}

/** The five campaign-parameter keys the `utm` column may carry. */
const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const

type UtmKey = (typeof UTM_KEYS)[number]

/** Decode the `utm` column, keeping only the five declared string keys. */
const readUtm = (raw: unknown): LinkUtmRecord | null => {
  const parsed = readJson(raw)
  if (typeof parsed !== 'object' || parsed === null) return null
  const source = parsed as Record<string, unknown>
  const entries = UTM_KEYS.map((key) => [key, source[key]] as const).filter(
    (entry): entry is readonly [UtmKey, string] => typeof entry[1] === 'string'
  )
  return entries.length === 0 ? null : (Object.fromEntries(entries) as LinkUtmRecord)
}

/** Map a Drizzle row into the port's normalised record. Never carries the hash. */
export const toLinkRecord = (row: LinkRow): LinkRecord => ({
  id: row.id,
  appName: row.appName,
  slug: row.slug,
  source: row.source === 'config' ? 'config' : 'db',
  destination: row.destination ?? null,
  targets: readTargets(row.targets),
  title: row.title ?? null,
  tags: readTags(row.tags),
  notes: row.notes ?? null,
  enabled: row.enabled === true,
  validFrom: toIso(row.validFrom),
  validUntil: toIso(row.validUntil),
  maxClicks: row.maxClicks ?? null,
  expiredTo: row.expiredTo ?? null,
  utm: readUtm(row.utm),
  disabledAt: toIso(row.disabledAt),
  shadowedAt: toIso(row.shadowedAt),
  archivedAt: toIso(row.archivedAt),
  createdBy: row.createdBy ?? null,
  createdAt: toIsoRequired(row.createdAt),
  updatedAt: toIsoRequired(row.updatedAt),
  deletedAt: toIso(row.deletedAt),
})

// ---------------------------------------------------------------------------
// Record → row (write)
// ---------------------------------------------------------------------------

/** Encode an ISO string (or an explicit clear) for a timestamp column. */
const toDate = (value: string | null | undefined): Readonly<Date> | null | undefined => {
  if (value === undefined) return undefined
  if (value === null) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : new Date(parsed)
}

/**
 * Project only the keys a sparse payload actually carries.
 *
 * `undefined` means "leave the column alone" and must therefore never reach the
 * `.set()` object, while `null` means "clear it" and must. Spreading the payload
 * wholesale would erase the difference, and with it the only way an operator has
 * to remove an expiry once set.
 */
const present = <T>(key: string, value: T | undefined): Readonly<Record<string, T>> =>
  value === undefined ? {} : { [key]: value }

/**
 * The destination half of a sparse update, where the two forms REPLACE each
 * other rather than merging.
 *
 * Setting one CLEARS the other, which `present()` alone cannot express: it
 * projects only the keys the payload carries, so re-pointing a rotating link at
 * a single URL would leave the old `targets` list in place. The resolver reads
 * `targets` first, so the link would keep rotating to destinations the operator
 * had just replaced — a write that reports success and changes nothing
 * observable.
 *
 * Neither present means neither column is touched.
 */
const replacedDestination = (
  input: Readonly<UpdateLinkInput>
): Readonly<Record<string, unknown>> => {
  if (input.targets !== undefined) return { destination: null, targets: [...input.targets] }
  if (input.destination !== undefined) return { destination: input.destination, targets: null }
  return {}
}

/** The `set` payload for a sparse update — timestamps mapped, absences dropped. */
export const updateAssignments = (
  input: Readonly<UpdateLinkInput>
): Readonly<Record<string, unknown>> => ({
  ...replacedDestination(input),
  ...present('enabled', input.enabled),
  ...present('title', input.title),
  ...present('tags', input.tags === undefined ? undefined : [...input.tags]),
  ...present('notes', input.notes),
  ...present('validFrom', toDate(input.validFrom)),
  ...present('validUntil', toDate(input.validUntil)),
  ...present('maxClicks', input.maxClicks),
  ...present('expiredTo', input.expiredTo),
  ...present('utm', input.utm),
  updatedAt: new Date(),
})

/**
 * The identity and free-text half of a new row.
 *
 * Split from the lifecycle half purely so neither builder carries ten `??`
 * defaults at once — the cyclomatic budget is a real ceiling here, and one
 * flat object literal spends it entirely on absence handling.
 */
const createContent = (input: Readonly<CreateLinkInput>) => ({
  appName: input.appName,
  slug: input.slug,
  source: 'db' as const,
  // Exactly one of the two is set (the request schema refuses both and
  // neither), so the unused column is explicitly NULL rather than absent — a
  // row carrying both would resolve through `targets` while the catalog
  // reported `destination`.
  destination: input.destination ?? null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dialect-conditional JSON column shape
  targets: (input.targets === undefined ? null : [...input.targets]) as any,
  title: input.title ?? null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dialect-conditional JSON column shape
  tags: [...(input.tags ?? [])] as any,
  notes: input.notes ?? null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dialect-conditional JSON column shape
  utm: (input.utm ?? null) as any,
  createdBy: input.createdBy ?? null,
})

/** The lifecycle window a new row opens with. Absent means "no bound", not zero. */
const createLifecycle = (input: Readonly<CreateLinkInput>) => ({
  enabled: input.enabled ?? true,
  validFrom: toDate(input.validFrom) ?? null,
  validUntil: toDate(input.validUntil) ?? null,
  maxClicks: input.maxClicks ?? null,
  expiredTo: input.expiredTo ?? null,
})

/** The full `values()` payload for a minted `source: 'db'` link. */
export const createValues = (input: Readonly<CreateLinkInput>) => ({
  ...createContent(input),
  ...createLifecycle(input),
  createdAt: new Date(),
  updatedAt: new Date(),
})

/**
 * The `values()` payload for the overlay row a config-declared slug gets.
 *
 * It carries no destination: the definition lives in the file, and this row
 * exists only so the operator's kill switch has somewhere to be recorded.
 */
export const overlayValues = (input: {
  readonly appName: string
  readonly slug: string
  readonly disabled: boolean
  readonly actorId?: string | null
  readonly now: Date
}) => ({
  appName: input.appName,
  slug: input.slug,
  source: 'config' as const,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dialect-conditional JSON column shape
  tags: [] as any,
  enabled: true,
  disabledAt: input.disabled ? input.now : null,
  createdBy: input.actorId ?? null,
  createdAt: input.now,
  updatedAt: input.now,
})

/* eslint-enable unicorn/no-null */
