/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Module placement and masking.
 *
 * MASKING IS FULLY EVALUATED — all eight patterns, all four penalty rules.
 * A fixed mask is a one-line saving that, for some payloads, leaves large
 * same-colour runs or a false finder-like pattern: a symbol that scans on a
 * phone and fails on a cheap warehouse scanner. That failure is discovered in
 * the field, on printed media nobody can recall. The rules run eight times over
 * a ≤177² grid — sub-millisecond, and the only cost is this file's length.
 */

import { ALIGNMENT_CENTRES, ECC_ORDER, moduleCount, type EccLevel } from './tables'

/**
 * A grid whose ROWS are written in place while the outer array is readonly.
 * That is exactly `ReadonlyShallow`: enough immutability for the lint rule that
 * guards `src/`, while still letting the placement passes below write single
 * modules without rebuilding a ≤177² array once per module.
 */
type Grid = readonly number[][]

/** `undefined` marks a module the data pass may still write. */
const EMPTY = -1

const createGrid = (size: number): Grid =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => EMPTY))

/* eslint-disable functional/no-expression-statements, functional/immutable-data, functional/no-loop-statements, functional/no-let */

/**
 * The finder module at offset (r, c) from a finder's top-left corner.
 *
 * The whole pattern is concentric squares around (3, 3), so Chebyshev distance
 * decides it: 3 is the dark ring, 2 the light ring, 0-1 the dark core, and 4 is
 * the separator that borders the pattern on the two inward sides.
 */
const finderModule = (r: number, c: number): number => {
  const distance = Math.max(Math.abs(r - 3), Math.abs(c - 3))
  return distance === 3 || distance <= 1 ? 1 : 0
}

const placeFinder = (grid: Grid, row: number, col: number): void => {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const y = row + r
      const x = col + c
      const inside = y >= 0 && y < grid.length && x >= 0 && x < grid.length
      if (inside) grid[y]![x] = finderModule(r, c)
    }
  }
}

/** One 5×5 alignment pattern: dark ring, light ring, dark centre. */
const placeAlignmentAt = (grid: Grid, row: number, col: number): void => {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      grid[row + r]![col + c] = Math.max(Math.abs(r), Math.abs(c)) === 1 ? 0 : 1
    }
  }
}

const placeAlignment = (grid: Grid, version: number): void => {
  const centres = ALIGNMENT_CENTRES[version - 1] ?? []
  for (const row of centres) {
    for (const col of centres) {
      // A centre already occupied is one of the three that collide with a
      // finder; the spec omits those patterns entirely.
      if (grid[row]?.[col] === EMPTY) placeAlignmentAt(grid, row, col)
    }
  }
}

const placeTiming = (grid: Grid): void => {
  for (let i = 8; i < grid.length - 8; i++) {
    const value = i % 2 === 0 ? 1 : 0
    if (grid[6]![i] === EMPTY) grid[6]![i] = value
    if (grid[i]![6] === EMPTY) grid[i]![6] = value
  }
}

/** Reserve the format and version information areas so the data pass skips them. */
const reserveInfo = (grid: Grid, version: number): void => {
  const size = grid.length
  for (let i = 0; i < 9; i++) {
    if (grid[8]![i] === EMPTY) grid[8]![i] = 0
    if (grid[i]![8] === EMPTY) grid[i]![8] = 0
  }
  for (let i = 0; i < 8; i++) {
    grid[8]![size - 1 - i] = 0
    grid[size - 1 - i]![8] = 0
  }
  // The dark module, always set, at (4v + 9, 8).
  grid[size - 8]![8] = 1

  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const row = Math.floor(i / 3)
      const col = size - 11 + (i % 3)
      grid[row]![col] = 0
      grid[col]![row] = 0
    }
  }
}

/** The eight mask predicates, indexed by pattern number. */
const MASKS: readonly ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

/** BCH(15,5) format information, with the spec's fixed XOR mask. */
export const formatBits = (ecc: EccLevel, mask: number): number => {
  const eccBits = [0b01, 0b00, 0b11, 0b10][ECC_ORDER.indexOf(ecc)] ?? 0
  const data = (eccBits << 3) | mask
  let value = data << 10
  for (let i = 4; i >= 0; i--) {
    if (value & (1 << (i + 10))) value ^= 0b101_0011_0111 << i
  }
  return ((data << 10) | value) ^ 0b101_0100_0001_0010
}

/** BCH(18,6) version information, for versions 7 and above. */
const versionBits = (version: number): number => {
  let value = version << 12
  for (let i = 5; i >= 0; i--) {
    if (value & (1 << (i + 12))) value ^= 0b1_1111_0010_0101 << i
  }
  return (version << 12) | value
}

/** Rule 1 — runs of five or more identical modules along one line. */
const runScore = (line: readonly number[]): number => {
  let total = 0
  let run = 1
  for (let i = 1; i < line.length; i++) {
    if (line[i] === line[i - 1]) {
      run++
    } else {
      if (run >= 5) total += 3 + (run - 5)
      run = 1
    }
  }
  if (run >= 5) total += 3 + (run - 5)
  return total
}

/**
 * Rule 3 — the finder-like 1:1:3:1:1 sequence with its four-module light
 * margin, which a scanner may mistake for a real finder and mis-locate the
 * symbol from.
 */
const FINDER_LIKE: readonly (readonly number[])[] = [
  [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1],
]

/** Rule 3 — occurrences of either finder-like sequence along one line. */
const finderLikeScore = (line: readonly number[]): number => {
  let total = 0
  for (let i = 0; i + 11 <= line.length; i++) {
    for (const pattern of FINDER_LIKE) {
      if (pattern.every((bit, k) => line[i + k] === bit)) total += 40
    }
  }
  return total
}

const penalty = (grid: readonly (readonly number[])[]): number => {
  const size = grid.length
  let score = 0

  for (let i = 0; i < size; i++) {
    score += runScore(grid[i]!)
    score += runScore(grid.map((row) => row[i]!))
  }

  // Rule 2 — 2×2 blocks of one colour.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = grid[r]![c]
      if (v === grid[r]![c + 1] && v === grid[r + 1]![c] && v === grid[r + 1]![c + 1]) score += 3
    }
  }

  for (let i = 0; i < size; i++) {
    score += finderLikeScore(grid[i]!)
    score += finderLikeScore(grid.map((row) => row[i]!))
  }

  // Rule 4 — deviation from an even dark/light balance.
  const dark = grid.flat().filter((v) => v === 1).length
  const percent = (dark * 100) / (size * size)
  score += Math.floor(Math.abs(percent - 50) / 5) * 10

  return score
}

/**
 * Copy 1 of the format information: `[row, col]` for bit i, i = 0..14
 * (ISO/IEC 18004 figure 25). It climbs column 8 (rows 0-5, then 7), turns at
 * the corner (8,8), then runs left along row 8 (col 7, then 5 down to 0) —
 * row 6 and column 6 are timing and are stepped over, which is the only reason
 * this is a table rather than arithmetic.
 */
const FORMAT_COPY_1: readonly (readonly [number, number])[] = [
  [0, 8],
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  [7, 8],
  [8, 8],
  [8, 7],
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
]

/** Write both copies of the 15-bit format information, plus the dark module. */
const writeFormatInfo = (grid: Grid, ecc: EccLevel, mask: number): void => {
  const size = grid.length
  const format = formatBits(ecc, mask)
  for (let i = 0; i < 15; i++) {
    const bit = (format >> i) & 1
    const [row, col] = FORMAT_COPY_1[i]!
    grid[row]![col] = bit
    // Copy 2: bits 0-7 run leftwards along row 8 from the right edge, bits 8-14
    // run downwards along column 8 from the bottom edge.
    if (i < 8) grid[8]![size - 1 - i] = bit
    else grid[size - 15 + i]![8] = bit
  }
  grid[size - 8]![8] = 1
}

/** Write both copies of the 18-bit version information (versions 7 and above). */
const writeVersionInfo = (grid: Grid, version: number): void => {
  const size = grid.length
  const info = versionBits(version)
  for (let i = 0; i < 18; i++) {
    const bit = (info >> i) & 1
    const row = Math.floor(i / 3)
    const col = size - 11 + (i % 3)
    grid[row]![col] = bit
    grid[col]![row] = bit
  }
}

/**
 * Data pass: an upward-then-downward zig-zag through two-column strips, right
 * to left, writing one bit per non-function module.
 */
const placeData = (
  grid: Grid,
  isFunction: readonly (readonly boolean[])[],
  codewords: readonly number[]
): void => {
  const size = grid.length
  const bits = codewords.flatMap((byte) =>
    Array.from({ length: 8 }, (_unused, i) => (byte >> (7 - i)) & 1)
  )
  // Column 6 is the vertical timing pattern and belongs to no strip, so it is
  // removed BEFORE pairing. Shifting a strip off column 6 and still stepping
  // `-= 2` instead would re-walk one strip and never reach column 0 — which is
  // exactly the defect `matrix.test.ts` now pins.
  const columns = Array.from({ length: size }, (_unused, i) => size - 1 - i).filter((c) => c !== 6)
  let cursor = 0
  let upward = true
  for (let pair = 0; pair * 2 < columns.length; pair++) {
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step
      for (const offset of [0, 1]) {
        const x = columns[pair * 2 + offset]!
        if (isFunction[row]![x]) continue
        grid[row]![x] = bits[cursor] ?? 0
        cursor++
      }
    }
    upward = !upward
  }
}

/**
 * Build the finished module matrix for a payload.
 *
 * Returns a frozen boolean grid: `true` is a dark module.
 */
export const buildMatrix = (
  codewords: readonly number[],
  version: number,
  ecc: EccLevel
): readonly (readonly boolean[])[] => {
  const size = moduleCount(version)
  const base = createGrid(size)

  placeFinder(base, 0, 0)
  placeFinder(base, 0, size - 7)
  placeFinder(base, size - 7, 0)
  placeAlignment(base, version)
  placeTiming(base)

  const reserved = base.map((row) => [...row])
  reserveInfo(reserved, version)
  const isFunction = reserved.map((row) => row.map((cell) => cell !== EMPTY))

  const grid = reserved.map((row) => [...row])
  placeData(grid, isFunction, codewords)

  // Evaluate all eight masks and keep the lowest-penalty symbol.
  const candidates = MASKS.map((predicate, mask) => {
    const masked = grid.map((row, r) =>
      row.map((cell, c) => (isFunction[r]![c] ? cell : cell ^ (predicate(r, c) ? 1 : 0)))
    )
    writeFormatInfo(masked, ecc, mask)
    if (version >= 7) writeVersionInfo(masked, version)
    return { masked, score: penalty(masked) }
  })

  const best = candidates.reduce((a, b) => (b.score < a.score ? b : a))
  return Object.freeze(best.masked.map((row) => Object.freeze(row.map((cell) => cell === 1))))
}

/* eslint-enable functional/no-expression-statements, functional/immutable-data, functional/no-loop-statements, functional/no-let */
