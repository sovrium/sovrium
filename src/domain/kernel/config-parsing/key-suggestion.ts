/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * "Did you mean" — the nearest accepted key to the one an author wrote.
 *
 * Its own module because it is the one piece of `excess-property-report.ts`
 * that knows nothing about schemas, issues or paths: two strings and a
 * tolerance. Splitting it out is what keeps that file under its line cap
 * without weakening either half.
 *
 * A suggestion is offered only within a length-scaled tolerance. Offering the
 * nearest key unconditionally is worse than offering none: an author reading
 * "did you mean `text`?" for a key that is nothing like `text` learns to
 * distrust the whole message, including the times it is right.
 */

/**
 * Levenshtein edit distance. Pure, and written as a fold rather than a loop to
 * satisfy the functional-programming lint rules that govern `src/`.
 */
export const editDistance = (a: string, b: string): number => {
  const firstRow = Array.from({ length: b.length + 1 }, (_, index) => index)
  const lastRow = [...a].reduce<readonly number[]>(
    (previous, aChar, i) =>
      [...b].reduce<readonly number[]>(
        (row, bChar, j) => [
          ...row,
          Math.min(
            (row[j] ?? 0) + 1,
            (previous[j + 1] ?? 0) + 1,
            (previous[j] ?? 0) + (aChar === bChar ? 0 : 1)
          ),
        ],
        [i + 1]
      ),
    firstRow
  )
  return lastRow[b.length] ?? 0
}

/**
 * How far a candidate may sit from what was written and still be offered.
 *
 * Scales with length so a three-character key cannot be "corrected" to an
 * unrelated four-character one: `tag` tolerates a distance of 1 and its nearest
 * accepted neighbour on a `text` component is 3 away, so it correctly gets no
 * suggestion.
 */
const maxDistanceFor = (key: string): number => (key.length <= 4 ? 1 : key.length <= 8 ? 2 : 3)

/** The nearest accepted key within tolerance, or `undefined`. Pure. */
export const suggestKey = (key: string, accepted: readonly string[]): string | undefined => {
  const tolerance = maxDistanceFor(key)
  const best = accepted.reduce<{ readonly name: string; readonly distance: number } | undefined>(
    (winner, name) => {
      const distance = editDistance(key.toLowerCase(), name.toLowerCase())
      return winner === undefined || distance < winner.distance ? { name, distance } : winner
    },
    undefined
  )
  return best !== undefined && best.distance <= tolerance ? best.name : undefined
}
