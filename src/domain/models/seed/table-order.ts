/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dependency ordering for seeded tables.
 *
 * A row cannot reference a row that does not exist yet, so tables must be
 * written parent-first. Every seeding tool converges on this — Supabase's
 * `seed.sql` guidance, Prisma's "create parent records before child records",
 * Rails' fixture loader — and every one of them makes the *author* responsible
 * for getting it right. Deriving the order from the config instead means a
 * template author reorders their tables freely and the seed still replays.
 *
 * ## Which relationships create an edge
 *
 * | `relationType`  | Where the foreign key lives | Edge? |
 * | --------------- | --------------------------- | ----- |
 * | `many-to-one`   | this table                  | yes   |
 * | `one-to-one`    | this table                  | yes   |
 * | `many-to-many`  | a junction row needs both   | yes   |
 * | `one-to-many`   | **the child table**         | no    |
 *
 * Excluding `one-to-many` is load-bearing, not an optimisation. A `companies`
 * table with `contacts: one-to-many` and a `contacts` table with
 * `company: many-to-one` describes ONE relationship declared from both ends. If
 * both directions produced an edge, that pair would be reported as a cycle and
 * the command would refuse the most ordinary schema in the catalog.
 *
 * ## Cycles fail loudly
 *
 * A genuine cycle has no correct order, so there is no safe default to fall
 * back on. Picking an arbitrary order would insert some rows with a dangling
 * or null link and report success — the seed would "work" and the demo would
 * quietly show broken relationships. {@link resolveSeedTableOrder} names the
 * cycle and the field that closes it instead.
 *
 * ## Self-edges are not cycles
 *
 * A table linking to itself (`contacts.manager -> contacts`) is a self-edge,
 * not a cycle between tables — no ordering of tables can help, because the
 * dependency is between two *rows* of the same table. It is excluded from the
 * graph here and handled (currently: refused) by the resolver that walks rows.
 *
 * ## Determinism
 *
 * Ties are broken alphabetically. A topological sort has many valid answers,
 * and if the command picked a different one per run, a failure that depends on
 * order would be unreproducible — the worst possible property for a step that
 * runs unattended every night.
 */

/** The subset of a field the ordering cares about. `Table['fields'][n]` satisfies this. */
export interface LinkAwareField {
  readonly name: string
  readonly type: string
  readonly relatedTable?: string | undefined
  readonly relationType?: string | undefined
}

/** The subset of a table the ordering cares about. `Table` satisfies this. */
export interface LinkAwareTable {
  readonly name: string
  readonly fields?: readonly LinkAwareField[] | undefined
}

/** `from` must be written after `to`, because `from.viaField` points at `to`. */
export interface SeedTableEdge {
  readonly from: string
  readonly to: string
  readonly viaField: string
}

/** Relationship kinds whose foreign key lives on the declaring table. */
const OWNING_RELATION_TYPES: ReadonlySet<string> = new Set([
  'many-to-one',
  'one-to-one',
  'many-to-many',
])

/**
 * Derive the dependency edges implied by a config's relationship fields.
 *
 * Edges pointing at a table outside `scope` are dropped: seeding a subset via
 * `--table` should not demand an ordering constraint against a table nobody
 * asked to seed.
 */
export const collectSeedTableEdges = (
  tables: readonly LinkAwareTable[],
  scope: ReadonlySet<string>
): readonly SeedTableEdge[] =>
  tables
    .filter((table) => scope.has(table.name))
    .flatMap((table) =>
      (table.fields ?? [])
        .filter(
          (field) =>
            field.type === 'relationship' &&
            typeof field.relatedTable === 'string' &&
            OWNING_RELATION_TYPES.has(field.relationType ?? 'many-to-one')
        )
        .map((field) => ({
          from: table.name,
          to: field.relatedTable as string,
          viaField: field.name,
        }))
        // A self-edge cannot be resolved by table ordering (see module docs),
        // and an edge out of scope is not a constraint on this run.
        .filter((edge) => edge.to !== edge.from && scope.has(edge.to))
    )

/** Either a deterministic write order, or the cycle that makes one impossible. */
export type SeedTableOrder =
  | { readonly ok: true; readonly order: readonly string[] }
  | { readonly ok: false; readonly cycle: readonly string[]; readonly viaField: string }

/**
 * Kahn's algorithm with an alphabetical tiebreak.
 *
 * On failure the remaining (non-emitted) tables are exactly the members of one
 * or more cycles; the reported `cycle` is the shortest walk found from the
 * alphabetically-first survivor back to itself, which reads far better in an
 * error message than "these six tables are involved somehow".
 */
export const resolveSeedTableOrder = (
  tables: readonly string[],
  edges: readonly SeedTableEdge[]
): SeedTableOrder => {
  // eslint-disable-next-line functional/immutable-data, no-restricted-syntax -- single in-place sort on a freshly-spread copy; never mutates input
  const names = [...new Set(tables)].sort()
  const dependencies = new Map<string, ReadonlySet<string>>(
    names.map((name) => [
      name,
      new Set(edges.filter((edge) => edge.from === name).map((edge) => edge.to)),
    ])
  )

  const emit = (emitted: readonly string[]): readonly string[] => {
    const done = new Set(emitted)
    const ready = names.filter(
      (name) => !done.has(name) && [...(dependencies.get(name) ?? [])].every((dep) => done.has(dep))
    )
    const next = ready[0]
    return next === undefined ? emitted : emit([...emitted, next])
  }

  const order = emit([])
  if (order.length === names.length) return { ok: true, order }

  const done = new Set(order)
  const survivors = names.filter((name) => !done.has(name))
  return findCycle(survivors, edges)
}

/**
 * Walk the surviving sub-graph from its alphabetically-first member until a
 * table repeats. Every survivor of Kahn's algorithm sits on or downstream of a
 * cycle, so this walk always terminates in one.
 */
const findCycle = (
  survivors: readonly string[],
  edges: readonly SeedTableEdge[]
): { readonly ok: false; readonly cycle: readonly string[]; readonly viaField: string } => {
  const survivorSet = new Set(survivors)
  const start = survivors[0] ?? ''

  const walk = (
    path: readonly string[],
    current: string
  ): { readonly cycle: readonly string[]; readonly viaField: string } => {
    const candidates = edges.filter((edge) => edge.from === current && survivorSet.has(edge.to))
    // eslint-disable-next-line functional/immutable-data, no-restricted-syntax -- single in-place sort on a freshly-spread copy; never mutates input
    const outgoing = [...candidates].sort((a, b) => a.to.localeCompare(b.to))
    const step = outgoing[0]
    if (step === undefined) return { cycle: [...path, current], viaField: '' }

    const seenAt = path.indexOf(step.to)
    if (seenAt !== -1) {
      return { cycle: [...path.slice(seenAt), current, step.to], viaField: step.viaField }
    }
    return walk([...path, current], step.to)
  }

  const { cycle, viaField } = walk([], start)
  return { ok: false, cycle, viaField }
}
