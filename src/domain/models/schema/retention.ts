/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Schema-version retention resolver ([internal ref] / Phase 4 — API-1).
 *
 * `resolvePruneSet` is the **pure** core of the schema-prune feature: given a
 * list of ledger rows and a `keep` argument, it computes which versions stay
 * (`toKeep`) and which are pruned (`toPrune`). The caller (REST handler or
 * MCP dispatcher) performs the actual `DELETE`.
 *
 * Retention rules (any single rule keeps a row):
 *  1. **v1 is always retained** — the bootstrap row anchors history.
 *  2. **The active version is always retained** — the live app's snapshot.
 *  3. **Restore-chain rows are retained** — both the row that carries a
 *     `restoredFromVersion` value AND the version it points at, so the
 *     audit anchor survives.
 *  4. **The newest `keep` versions are retained** — `keep` is a positive
 *     integer; with `keep === N`, the N highest version numbers stay.
 *
 * Every row not matched by any rule is added to `toPrune`. The resolver is
 * total: given any legal input it returns a deterministic answer with
 * `toKeep ∩ toPrune === ∅` and `toKeep ∪ toPrune === input`.
 *
 * Self-contained checksums ([internal ref], Point B) make the prune safe:
 * removing an interior row never corrupts the integrity of a retained row.
 */

/**
 * One row of the version ledger as the resolver sees it. Only the three
 * columns the retention rules touch are required — the resolver is
 * deliberately oblivious to snapshot, message, checksum, etc.
 */
export interface VersionRow {
  readonly versionNumber: number
  /**
   * `versionNumber` this row was restored from, or `undefined` for a normal
   * publish. When set, BOTH this row AND the row it points at are kept by
   * the restore-chain rule.
   */
  readonly restoredFromVersion?: number
}

export interface PruneResolution {
  readonly toKeep: ReadonlySet<number>
  readonly toPrune: ReadonlySet<number>
}

/**
 * Default for the `keep` argument when callers don't specify one.
 * Conservative: enough to cover a small admin's whole recent edit
 * history, but small enough that the prune is meaningful on a ledger
 * with hundreds of rows.
 */
export const DEFAULT_KEEP = 10

const isValidVersionNumber = (n: number): boolean => Number.isInteger(n) && n >= 1

const sortDesc = (numbers: ReadonlyArray<number>): ReadonlyArray<number> =>
  // eslint-disable-next-line functional/immutable-data, no-restricted-syntax -- single in-place sort on a freshly-spread copy; never mutates input
  [...numbers].sort((a, b) => b - a)

const restoreChainNumbers = (versions: ReadonlyArray<VersionRow>): ReadonlyArray<number> =>
  versions
    .filter((v) => v.restoredFromVersion !== undefined)
    .flatMap((v) => [v.versionNumber, v.restoredFromVersion as number])

/**
 * Resolve the retention set.
 *
 * @param versions - every row currently in the ledger (any order).
 * @param keep - how many of the newest rows to retain on top of v1, the
 *   active version, and the restore chain. Defaults to {@link DEFAULT_KEEP}
 *   when unset; coerced to `Math.max(1, Math.floor(keep))` for any other
 *   input (non-finite falls back to default).
 *
 * @returns `{ toKeep, toPrune }` — two disjoint sets that partition the
 *   input version-numbers.
 */
export const resolvePruneSet = (
  versions: ReadonlyArray<VersionRow>,
  keep: number = DEFAULT_KEEP
): PruneResolution => {
  const safeKeep = Math.max(1, Math.floor(Number.isFinite(keep) ? keep : DEFAULT_KEEP))
  const allNumbers = versions.map((v) => v.versionNumber).filter(isValidVersionNumber)
  const sortedDesc = sortDesc(allNumbers)
  const activeVersion = sortedDesc[0]

  // Compose all keep-candidates as a single immutable spread; the Set
  // constructor takes the iterable and deduplicates.
  const v1Numbers: ReadonlyArray<number> = allNumbers.includes(1) ? [1] : []
  const activeNumbers: ReadonlyArray<number> = activeVersion !== undefined ? [activeVersion] : []
  const newestNumbers = sortedDesc.slice(0, safeKeep)
  const chainNumbers = restoreChainNumbers(versions)

  const toKeep: ReadonlySet<number> = new Set<number>([
    ...v1Numbers,
    ...activeNumbers,
    ...chainNumbers,
    ...newestNumbers,
  ])
  const toPrune: ReadonlySet<number> = new Set<number>(allNumbers.filter((n) => !toKeep.has(n)))
  return { toKeep, toPrune }
}
