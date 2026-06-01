/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface VersionRow {
  readonly versionNumber: number
  readonly restoredFromVersion?: number
}

export interface PruneResolution {
  readonly toKeep: ReadonlySet<number>
  readonly toPrune: ReadonlySet<number>
}

export const DEFAULT_KEEP = 10

const isValidVersionNumber = (n: number): boolean => Number.isInteger(n) && n >= 1

const sortDesc = (numbers: ReadonlyArray<number>): ReadonlyArray<number> =>
  [...numbers].sort((a, b) => b - a)

const restoreChainNumbers = (versions: ReadonlyArray<VersionRow>): ReadonlyArray<number> =>
  versions
    .filter((v) => v.restoredFromVersion !== undefined)
    .flatMap((v) => [v.versionNumber, v.restoredFromVersion as number])

export const resolvePruneSet = (
  versions: ReadonlyArray<VersionRow>,
  keep: number = DEFAULT_KEEP
): PruneResolution => {
  const safeKeep = Math.max(1, Math.floor(Number.isFinite(keep) ? keep : DEFAULT_KEEP))
  const allNumbers = versions.map((v) => v.versionNumber).filter(isValidVersionNumber)
  const sortedDesc = sortDesc(allNumbers)
  const activeVersion = sortedDesc[0]

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
