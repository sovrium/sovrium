/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The boot ledger's snapshot algebra — canonical serialisation, the row-to-row
 * diff, and the counts derived from it ([internal ref] amendment A6, surface 8).
 *
 * Pure throughout, and shared by the two sides that must agree: the capture
 * (`infrastructure/server/boot-ledger-capture.ts`) computes the summary and the
 * seven counts from it at write time, and the detail read renders the diff from
 * it. Two implementations would drift, and the first symptom would be a row
 * whose stored `added` count did not match the `+` lines the console drew
 * beside it.
 *
 * ─── BOTH SIDES OF ANY DIFF ARE BOOTS THAT HAPPENED ─────────────────────────
 *
 * A6's sharpest bound, and the reason {@link diffSnapshots} takes two
 * snapshots rather than one. There is no diff against an uploaded file, a
 * working copy, a branch, or a configuration typed into a console. The baseline
 * row has no other side, so its caller passes nothing and gets an EMPTY list —
 * not the whole configuration rendered as `+` lines, which would be a diff
 * against an empty configuration that never booted anywhere.
 *
 * ─── BOTH SIDES ARE ALREADY REDACTED ────────────────────────────────────────
 *
 * Nothing here scrubs. A snapshot reaches this module having been through
 * `redactSecretsForApp` before it was stored, which is why a diff line can be
 * serialised straight to the wire. It also means the two sides are comparable:
 * diffing a raw configuration against a stored (redacted) one would report
 * `***` → literal as a change on every single boot, and would carry the literal
 * into the diff on the way.
 */

import type { BootLedgerStats } from '@/application/ports/repositories/admin/boot-ledger-repository'

/** A snapshot as this module sees it: an opaque JSON document. */
export type Snapshot = Readonly<Record<string, unknown>>

/**
 * JSON with every object's keys in sorted order, recursively.
 *
 * The hash is taken over this, and an unstable serialisation is the single
 * failure that turns the whole surface into noise: two boots of the same
 * configuration would hash differently, every restart would write a row, and
 * the timeline would become a log of process supervision.
 *
 * Arrays keep their order — position is meaning in `tables[]` and `pages[]`,
 * and sorting them would make a re-ordered config look unchanged.
 */
export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .toSorted(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
  return `{${entries.join(',')}}`
}

/** One leaf of a snapshot: its dotted path and its serialised scalar. */
type Leaf = readonly [path: string, value: string]

/**
 * Flatten a document to its leaves.
 *
 * A leaf is a scalar — string, number, boolean or null. An empty object or
 * array contributes none, which is correct: there is nothing in it to have
 * changed, and a `{}` that later gains members shows up as the additions it
 * actually is.
 */
const leaves = (value: unknown, path: string): readonly Leaf[] => {
  if (value === null || typeof value !== 'object') return [[path, JSON.stringify(value) ?? 'null']]
  if (Array.isArray(value)) return value.flatMap((item, index) => leaves(item, `${path}[${index}]`))
  return Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .flatMap(([key, item]) => leaves(item, path === '' ? key : `${path}.${key}`))
}

/** The leaf map of one snapshot, keyed by path. */
const leafMap = (snapshot: Snapshot): ReadonlyMap<string, string> => new Map(leaves(snapshot, ''))

/** The top-level configuration key a path belongs to — `pages[1].name` → `pages`. */
const topLevelOf = (path: string): string => {
  const cut = path.search(/[.[]/)
  return cut === -1 ? path : path.slice(0, cut)
}

/**
 * The unified line rendering of the change between two boots.
 *
 * Every line begins with `@`, `-`, `+` or a space, which is what makes the
 * result a diff rather than a prose report: `@@ <key> @@` opens the hunk for
 * one top-level configuration key, `-` is what the previous boot ran, and `+`
 * is what this one runs.
 *
 * Hunks are grouped by top-level key, in path order, so a change to `pages`
 * reads as one block rather than as one header per leaf.
 */
export const diffSnapshots = (
  previous: Snapshot | undefined,
  current: Snapshot
): readonly string[] => {
  // The baseline row's whole contract, in one line: no predecessor, no diff.
  if (previous === undefined) return []

  const before = leafMap(previous)
  const after = leafMap(current)
  const paths = [...new Set([...before.keys(), ...after.keys()])]
    .toSorted()
    .filter((path) => before.get(path) !== after.get(path))

  // Grouped by top-level key in first-appearance order, so a change to `pages`
  // reads as one block rather than as one header per leaf. Built as a list of
  // pairs rather than by mutating a Map: the paths are already sorted, so the
  // first time a key is seen is its position, and `findIndex` over a handful of
  // top-level keys costs nothing measurable.
  const grouped = paths.reduce<readonly (readonly [string, readonly string[]])[]>(
    (accumulator, path) => {
      const key = topLevelOf(path)
      const at = accumulator.findIndex(([existing]) => existing === key)
      return at === -1
        ? [...accumulator, [key, [path]] as const]
        : accumulator.map((entry, index) =>
            index === at ? ([key, [...entry[1], path]] as const) : entry
          )
    },
    []
  )

  return grouped.flatMap(([key, group]) => [
    `@@ ${key} @@`,
    ...group.flatMap((path) => [
      ...(before.has(path) ? [`-${path}: ${before.get(path) ?? ''}`] : []),
      ...(after.has(path) ? [`+${path}: ${after.get(path) ?? ''}`] : []),
    ]),
  ])
}

/**
 * The generated one-line label a row carries.
 *
 * Derived from the diff, never operator prose — the ledger accepts no message,
 * because a message is something an author writes and this surface has no
 * author. A boot with no predecessor says so plainly rather than claiming a
 * change it cannot have made.
 */
export const summariseDiff = (lines: readonly string[]): string => {
  if (lines.length === 0) return 'First recorded boot'
  const added = lines.filter((line) => line.startsWith('+')).length
  const removed = lines.filter((line) => line.startsWith('-')).length
  const keys = lines
    .filter((line) => line.startsWith('@@ '))
    .map((line) => line.slice(3, -3).trim())
    .filter((key) => key.length > 0)
  const where = keys.length === 0 ? 'the configuration' : keys.join(', ')
  return `${added} added, ${removed} removed in ${where}`
}

/** A named member of a top-level configuration list, keyed the way that list keys itself. */
const identityOf = (entry: unknown, index: number): string => {
  if (typeof entry !== 'object' || entry === null) return `#${index}`
  const source = entry as Readonly<Record<string, unknown>>
  const named = source['name'] ?? source['slug'] ?? source['id']
  return typeof named === 'string' && named.length > 0 ? named : `#${index}`
}

/** The identity set of one top-level list, or an empty set when the key is absent. */
const identities = (snapshot: Snapshot | undefined, key: string): ReadonlySet<string> => {
  const list = snapshot?.[key]
  return Array.isArray(list)
    ? new Set(list.map((entry, index) => identityOf(entry, index)))
    : new Set()
}

/** How many members of `current[key]` were not in `previous[key]`. */
const additionsIn = (previous: Snapshot | undefined, current: Snapshot, key: string): number => {
  const before = identities(previous, key)
  return [...identities(current, key)].filter((name) => !before.has(name)).length
}

/** Every table of a snapshot, indexed by name. */
const tablesByName = (snapshot: Snapshot | undefined): ReadonlyMap<string, Snapshot> => {
  const list = snapshot?.['tables']
  if (!Array.isArray(list)) return new Map()
  return new Map(
    list
      .filter((table): table is Snapshot => typeof table === 'object' && table !== null)
      .map((table, index) => [identityOf(table, index), table] as const)
  )
}

/** The field names one table declares. */
const fieldNames = (table: Snapshot | undefined): ReadonlySet<string> => {
  const list = table?.['fields']
  return Array.isArray(list)
    ? new Set(list.map((field, index) => identityOf(field, index)))
    : new Set()
}

/**
 * Table fields this boot introduced, across every table.
 *
 * A field on a table that is itself new counts: the engine created the column,
 * and an operator reading "one table, six fields" against a row that reported
 * six tables and zero fields would rightly distrust the whole tally.
 */
const fieldAdditions = (previous: Snapshot | undefined, current: Snapshot): number => {
  const before = tablesByName(previous)
  return [...tablesByName(current).entries()].reduce((total, [name, table]) => {
    const priorFields = fieldNames(before.get(name))
    return total + [...fieldNames(table)].filter((field) => !priorFields.has(field)).length
  }, 0)
}

/**
 * The seven counts a row stores, all of them derived from the same pair of
 * snapshots the diff is.
 *
 * Every one is zero on the baseline row. That is not a degenerate case to be
 * tidied away — it is A6's bound applied to a number: a count of what changed
 * needs two boots exactly as a diff line does, and reporting "seven tables
 * added" against a configuration that had no predecessor would be a claim about
 * a boot that never happened.
 */
export const deriveStats = (
  previous: Snapshot | undefined,
  current: Snapshot,
  diff: readonly string[]
): BootLedgerStats =>
  previous === undefined
    ? { added: 0, removed: 0, tables: 0, fields: 0, automations: 0, agents: 0, links: 0 }
    : {
        added: diff.filter((line) => line.startsWith('+')).length,
        removed: diff.filter((line) => line.startsWith('-')).length,
        tables: additionsIn(previous, current, 'tables'),
        fields: fieldAdditions(previous, current),
        automations: additionsIn(previous, current, 'automations'),
        agents: additionsIn(previous, current, 'agents'),
        links: additionsIn(previous, current, 'links'),
      }
