/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Codeword generation: GF(256) arithmetic, Reed–Solomon, and the byte-mode bit
 * stream.
 *
 * BYTE MODE ONLY, deliberately. A link slug is lowercase by schema, so a real
 * payload selects byte mode every time; shipping alphanumeric mode without
 * optimal multi-segment selection would add unreachable code that Knip flags.
 * `selectMode` exists as the seam where a second mode drops in without touching
 * anything below it.
 */

import {
  dataCodewords,
  EC_BLOCKS,
  EC_CODEWORDS_PER_BLOCK,
  TOTAL_CODEWORDS,
  type EccLevel,
} from './tables'

/** The only mode implemented. See the module note. */
export type Mode = 'byte'

/** Which mode encodes this payload most compactly among those implemented. */
export const selectMode = (_text: string): Mode => 'byte'

// ---------------------------------------------------------------------------
// GF(256), the field QR's Reed–Solomon is defined over (primitive polynomial
// 0x11D). Log/antilog tables make multiplication an addition of exponents.
// ---------------------------------------------------------------------------

const buildTables = (): { readonly exp: readonly number[]; readonly log: readonly number[] } => {
  const exp = Array.from({ length: 512 }, () => 0)
  const log = Array.from({ length: 256 }, () => 0)
  // eslint-disable-next-line functional/no-let
  let x = 1
  // eslint-disable-next-line functional/no-loop-statements
  for (let i = 0; i < 255; i++) {
    // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data
    exp[i] = x
    // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data
    log[x] = i
    // eslint-disable-next-line functional/no-expression-statements
    x <<= 1

    if (x & 0x1_00) {
      // eslint-disable-next-line functional/no-expression-statements
      x ^= 0x1_1d
    }
  }
  // eslint-disable-next-line functional/no-loop-statements
  for (let i = 255; i < 512; i++) {
    // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data
    exp[i] = exp[i - 255] ?? 0
  }
  return { exp, log }
}

const { exp: EXP, log: LOG } = buildTables()

/** GF(256) multiply. Zero annihilates, as in any field. */
export const gfMultiply = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : (EXP[((LOG[a] ?? 0) + (LOG[b] ?? 0)) % 255] ?? 0)

/**
 * The generator polynomial for `degree` EC codewords: ∏(x - α^i).
 *
 * Built by repeated multiplication rather than tabulated, so there is one fewer
 * transcribed table to get wrong.
 */
export const generatorPolynomial = (degree: number): readonly number[] =>
  Array.from({ length: degree }).reduce<readonly number[]>(
    (poly, _unused, i) =>
      // Multiply `poly` by (x - α^i), in coefficient form. Coefficient k of the
      // product is poly[k] (from the x term) plus α^i·poly[k-1] (from the
      // constant term) — the degree grows by one, hence the appended slot.
      [...poly, 0].map(
        (coefficient, index) => coefficient ^ gfMultiply(poly[index - 1] ?? 0, EXP[i] ?? 0)
      ),
    [1]
  )

/** Reed–Solomon EC codewords for one block. */
export const errorCorrection = (data: readonly number[], ecCount: number): readonly number[] => {
  const generator = generatorPolynomial(ecCount)
  const remainder = data.reduce<readonly number[]>(
    (state, byte) => {
      const factor = byte ^ (state[0] ?? 0)
      const shifted = [...state.slice(1), 0]
      return shifted.map((value, index) => value ^ gfMultiply(generator[index + 1] ?? 0, factor))
    },
    Array.from({ length: ecCount }, () => 0)
  )
  return remainder
}

// ---------------------------------------------------------------------------
// Bit stream
// ---------------------------------------------------------------------------

/** How many bits the character-count indicator uses in byte mode. */
const countBits = (version: number): number => (version <= 9 ? 8 : 16)

/** Pad codewords, alternating, as the spec prescribes. */
const PAD_BYTES = [0xec, 0x11] as const

/**
 * The data codewords for a payload at a given version and level: mode
 * indicator, character count, the bytes themselves, a terminator, and padding.
 */
export const dataCodewordStream = (
  bytes: Uint8Array,
  version: number,
  ecc: EccLevel
): readonly number[] => {
  const capacity = dataCodewords(version, ecc)

  const header = [
    { value: 0b0100, width: 4 },
    { value: bytes.length, width: countBits(version) },
  ]
  const bits = [
    ...header.flatMap(({ value, width }) =>
      Array.from({ length: width }, (_unused, i) => (value >> (width - 1 - i)) & 1)
    ),
    ...[...bytes].flatMap((byte) =>
      Array.from({ length: 8 }, (_unused, i) => (byte >> (7 - i)) & 1)
    ),
  ]

  // Terminator: up to four zero bits, then pad to a byte boundary.
  const terminated = [
    ...bits,
    ...Array.from({ length: Math.min(4, capacity * 8 - bits.length) }, () => 0),
  ]
  const aligned = [
    ...terminated,
    ...Array.from({ length: (8 - (terminated.length % 8)) % 8 }, () => 0),
  ]

  const words = Array.from({ length: aligned.length / 8 }, (_unused, i) =>
    aligned.slice(i * 8, i * 8 + 8).reduce((acc, bit) => (acc << 1) | bit, 0)
  )

  return [
    ...words,
    ...Array.from({ length: capacity - words.length }, (_unused, i) => PAD_BYTES[i % 2] ?? 0),
  ]
}

/** The smallest version whose capacity holds this payload at this level. */
export const selectVersion = (byteLength: number, ecc: EccLevel): number | undefined => {
  const version = Array.from({ length: 40 }, (_unused, i) => i + 1).find((candidate) => {
    const headerBits = 4 + countBits(candidate)
    return dataCodewords(candidate, ecc) * 8 >= headerBits + byteLength * 8
  })
  return version
}

/**
 * Interleave data and EC codewords across blocks, as the spec requires.
 *
 * Interleaving is what makes the error correction useful: a burst of damage in
 * one region of the printed symbol is spread across every block rather than
 * destroying one block entirely.
 */
export const interleave = (
  data: readonly number[],
  version: number,
  ecc: EccLevel
): readonly number[] => {
  const index = version - 1
  const blockCount = EC_BLOCKS[ecc][index] ?? 1
  const ecPerBlock = EC_CODEWORDS_PER_BLOCK[ecc][index] ?? 0
  const totalData = data.length

  const shortLength = Math.floor(totalData / blockCount)
  const longCount = totalData % blockCount

  const blocks = Array.from({ length: blockCount }, (_unused, block) => {
    const isLong = block >= blockCount - longCount
    const before = block * shortLength + Math.max(0, block - (blockCount - longCount))
    const length = shortLength + (isLong ? 1 : 0)
    const blockData = data.slice(before, before + length)
    return { data: blockData, ec: errorCorrection(blockData, ecPerBlock) }
  })

  const maxData = Math.max(...blocks.map((block) => block.data.length))
  const dataPass = Array.from({ length: maxData }, (_unused, i) =>
    blocks.map((block) => block.data[i]).filter((value): value is number => value !== undefined)
  ).flat()
  const ecPass = Array.from({ length: ecPerBlock }, (_unused, i) =>
    blocks.map((block) => block.ec[i]).filter((value): value is number => value !== undefined)
  ).flat()

  return [...dataPass, ...ecPass]
}

/** Total codewords a version carries, exposed for the structural assertions. */
export const totalCodewords = (version: number): number => TOTAL_CODEWORDS[version - 1] ?? 0
