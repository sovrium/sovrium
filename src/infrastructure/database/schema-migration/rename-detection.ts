/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { detectCycles } from '@/domain/kernel/matching/cycle-detection'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

/**
 * A named thing whose identity is carried by an `id` that config may omit.
 *
 * Both tables and fields are this shape, and both get their missing ids filled
 * in by position — `autoGenerateTableIds` and `autoGenerateFieldIds` each assign
 * `maxId + 1, +2, …` in ARRAY ORDER. So for a config that declares no ids the id
 * IS the array index, and an id-keyed diff silently degrades into a POSITIONAL
 * one: inserting an entry anywhere but the end shifts every id after it and
 * manufactures a cascade of renames between entries nobody renamed.
 *
 * The stored snapshot holds the DECODED config, so those generated ids are
 * exactly what the next boot diffs against — the loop closes with the author
 * never having written an id by hand.
 */
type IdentifiedEntry = {
  readonly id: number | string
  readonly name: string
}

/**
 * One entry's claim that it used to be called something else: the snapshot
 * recorded `oldName` under this entry's id, and the config now declares
 * `newName` under the same id. Only ever a *hypothesis* — see
 * {@link IdentifiedEntry}.
 */
type RenameCandidate = {
  readonly oldName: string
  readonly newName: string
}

/** Keep only the entries that carry both an id and a name, in a uniform shape. */
const toIdentifiedEntries = (values: readonly unknown[]): readonly IdentifiedEntry[] =>
  values.filter((v): v is IdentifiedEntry => {
    if (typeof v !== 'object' || v === null) return false
    const entry = v as { readonly id?: unknown; readonly name?: unknown }
    return (
      (typeof entry.id === 'number' || typeof entry.id === 'string') &&
      typeof entry.name === 'string'
    )
  })

/** Every id-matched (oldName → newName) hypothesis, before any safety filtering. */
const buildRenameCandidates = (
  current: readonly IdentifiedEntry[],
  previous: readonly IdentifiedEntry[]
): readonly RenameCandidate[] => {
  const previousNameById = new Map(previous.map((e) => [e.id, e.name] as const))

  return current
    .map((e) => ({ oldName: previousNameById.get(e.id), newName: e.name }))
    .filter((c): c is RenameCandidate => c.oldName !== undefined && c.oldName !== c.newName)
}

/**
 * The renames that BOTH names agree really happened.
 *
 * An id match alone is not evidence (see {@link IdentifiedEntry}), so a
 * candidate survives only when:
 *
 *  - the old name has genuinely LEFT the config. A name still declared has an
 *    owner, and renaming something else onto it would either abort the migration
 *    on a shape mismatch or — when the shapes happen to be compatible — silently
 *    rehome data with no error at all.
 *  - the new name is genuinely NEW. A name already present in the snapshot still
 *    has a physical table or column behind it, so renaming onto it collides.
 *
 * Callers must consult {@link findAmbiguousRenames} first: this function quietly
 * drops the candidates of a name swap, which is the right DDL to emit (none) but
 * the wrong thing to do silently.
 */
const findSafeRenames = (
  current: readonly IdentifiedEntry[],
  previous: readonly IdentifiedEntry[]
): ReadonlyMap<string, string> => {
  const candidates = buildRenameCandidates(current, previous)
  if (candidates.length === 0) return new Map()

  const currentNames = new Set(current.map((e) => e.name))
  const previousNames = new Set(previous.map((e) => e.name))

  return new Map<string, string>(
    candidates
      .filter((c) => !currentNames.has(c.oldName) && !previousNames.has(c.newName))
      .map((c) => [c.oldName, c.newName] as const)
  )
}

/**
 * Names caught in a rename CYCLE — the one shape no name-based test can resolve,
 * because every name involved both survives and moves.
 *
 * Two entries exchanging names in a single edit (`alpha` ⇄ `beta`) is
 * indistinguishable from an id renumbering by inspection alone: each old name is
 * still live in the config, and each new name still existed in the snapshot.
 * Guessing either way rehomes data, so the caller must refuse instead. An id
 * SHIFT, by contrast, produces an open CHAIN (`views → body → summary`) whose
 * head name is genuinely new, and so resolves safely as "nothing was renamed".
 *
 * @returns the names in the cycle, or an empty array when the candidates form no cycle
 */
const findAmbiguousRenames = (
  current: readonly IdentifiedEntry[],
  previous: readonly IdentifiedEntry[]
): readonly string[] => {
  const candidates = buildRenameCandidates(current, previous)
  if (candidates.length === 0) return []

  const renameGraph: ReadonlyMap<string, ReadonlyArray<string>> = new Map(
    candidates.map((c) => [c.oldName, [c.newName]] as const)
  )

  return detectCycles(renameGraph)
}

// ---------------------------------------------------------------------------
// Fields. Scoped to ONE table, located in the snapshot by NAME — so a field
// rename is only ever compared against the fields of the same table.
// ---------------------------------------------------------------------------

/** The snapshot's fields for `tableName`, or `[]` when the table is new. */
const previousFieldsOf = (
  tableName: string,
  previousSchema?: { readonly tables: readonly object[] }
): readonly IdentifiedEntry[] => {
  if (!previousSchema) return []

  const previousTable = previousSchema.tables.find(
    (t: object) => 'name' in t && t.name === tableName
  ) as { readonly fields?: readonly unknown[] } | undefined

  return toIdentifiedEntries(previousTable?.fields ?? [])
}

/**
 * Detect field renames by comparing field IDs between previous and current schema
 * Returns a map of old field name to new field name for renamed fields
 *
 * A false positive here is worse than its table-level twin: the emitted
 * `RENAME COLUMN` also removes its target from the columns the migration would
 * ADD, so the field the author is still declaring silently loses its column
 * entirely while its data survives under the wrong name.
 */
export const detectFieldRenames = (
  tableName: string,
  currentFields: readonly Fields[number][],
  previousSchema?: { readonly tables: readonly object[] }
): ReadonlyMap<string, string> =>
  findSafeRenames(toIdentifiedEntries(currentFields), previousFieldsOf(tableName, previousSchema))

/**
 * Field names of `tableName` caught in a rename cycle — two fields exchanging
 * names in one edit. The caller must refuse the migration rather than guess an
 * order, since either guess mislabels a populated column.
 */
export const detectAmbiguousFieldRenames = (
  tableName: string,
  currentFields: readonly Fields[number][],
  previousSchema?: { readonly tables: readonly object[] }
): readonly string[] =>
  findAmbiguousRenames(
    toIdentifiedEntries(currentFields),
    previousFieldsOf(tableName, previousSchema)
  )

// ---------------------------------------------------------------------------
// Tables. Compared across the whole snapshot.
// ---------------------------------------------------------------------------

/**
 * Detect table renames by comparing table IDs between previous and current schema
 * Returns a map of old table name to new table name for renamed tables
 */
export const detectTableRenames = (
  currentTables: readonly Table[],
  previousSchema?: { readonly tables: readonly object[] }
): ReadonlyMap<string, string> =>
  findSafeRenames(
    toIdentifiedEntries(currentTables),
    toIdentifiedEntries(previousSchema?.tables ?? [])
  )

/**
 * Table names caught in a rename cycle — two tables exchanging names in one
 * edit. The caller must refuse the boot rather than guess an order, since either
 * guess moves rows into the wrong table.
 */
export const detectAmbiguousTableRenames = (
  currentTables: readonly Table[],
  previousSchema?: { readonly tables: readonly object[] }
): readonly string[] =>
  findAmbiguousRenames(
    toIdentifiedEntries(currentTables),
    toIdentifiedEntries(previousSchema?.tables ?? [])
  )
