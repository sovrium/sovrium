/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a canvas was drawn with, as its stamp file records it: the drawing
 * inputs of a `--pages` export that make its boards draw values the config
 * does not hold. The page import rebuilds its baseline from them, so a board
 * nobody touched draws the same on both sides.
 *
 * Inputs only, never content: the seed folder is named by its path relative
 * to the config, and none of its rows are copied into the canvas.
 */
export interface CanvasDrawnWith {
  /** The seed folder (`--seed`), relative to the config file. */
  readonly seed?: string | undefined
  /** The instant relative times were drawn against (`--now`), as an RFC 3339 instant. */
  readonly now?: string | undefined
  /** How many boards a routed record page got (`--records`). */
  readonly records?: number | undefined
  /** The seeded account every board was drawn as (`--as`), by email. */
  readonly as?: string | undefined
  /** The prototype kind (`--prototype`). */
  readonly prototype?: 'board' | 'app' | undefined
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

const countOf = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined

const prototypeOf = (value: unknown): CanvasDrawnWith['prototype'] =>
  value === 'board' || value === 'app' ? value : undefined

/**
 * The drawing inputs as the stamp file records them; `undefined` when none is
 * recorded (an unseeded export, or a canvas drawn before they were recorded).
 * A malformed value is dropped, never guessed.
 */
export const canvasDrawnWithOf = (stampFile: unknown): CanvasDrawnWith | undefined => {
  const recorded = isRecord(stampFile) ? stampFile['drawnWith'] : undefined
  if (!isRecord(recorded)) return undefined
  const read = {
    seed: textOf(recorded['seed']),
    now: textOf(recorded['now']),
    records: countOf(recorded['records']),
    as: textOf(recorded['as']),
    prototype: prototypeOf(recorded['prototype']),
  }
  const kept = Object.entries(read).filter(([, value]) => value !== undefined)
  return kept.length === 0 ? undefined : (Object.fromEntries(kept) as CanvasDrawnWith)
}
