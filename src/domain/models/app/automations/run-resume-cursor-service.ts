/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a run parked on a long wait paused: its resume cursor.
 *
 * A wait longer than a minute parks the run in the database. The run keeps
 * one frame per level, from the top of its actions down to the wait step: a
 * frame names the step it stands on and its position in its own body, and a
 * frame standing on a `loop` or a `path` adds where the run is inside it — the
 * item (and the item's value, to tell whether the list changed) or the branch
 * (and every branch the path chose, so an `all-matching` path runs the rest).
 *
 * At resume the frames are matched against the CURRENT configuration by step
 * name and container kind ({@link matchResumeFrames}); a frame that no longer
 * matches cancels the run, naming the step that is missing.
 */

import { Schema } from 'effect'

/** The kinds of step a run can pause inside. */
export type ResumeContainerKind = 'loop' | 'path'

/** One level of a resume cursor. */
export interface ResumeFrame {
  readonly step: string
  readonly index: number
  readonly kind?: ResumeContainerKind
  /** A loop frame: the zero-based item the run paused on, and its value. */
  readonly item?: number
  readonly itemValue?: unknown
  /** A path frame: the branch the run paused in, and every branch the path chose. */
  readonly branch?: string
  readonly selected?: readonly string[]
}

/** What a container step adds to the frame its parent writes for it. */
export type ResumeContainerFrame = Omit<ResumeFrame, 'step' | 'index'>

/** The resume cursor a parked run stores. */
export interface ResumeCursor {
  readonly v: 1
  readonly frames: readonly ResumeFrame[]
}

/** A position in a list: a whole number, zero or more. */
const PositionSchema = Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))

const FrameSchema = Schema.Struct({
  step: Schema.String,
  index: PositionSchema,
  kind: Schema.optional(Schema.Literals(['loop', 'path'])),
  item: Schema.optional(PositionSchema),
  itemValue: Schema.optional(Schema.Unknown),
  branch: Schema.optional(Schema.String),
  selected: Schema.optional(Schema.Array(Schema.String)),
})

const CursorSchema = Schema.Struct({
  v: Schema.Literal(1),
  frames: Schema.Array(FrameSchema),
})

const decodeCursor = Schema.decodeUnknownOption(CursorSchema)

/**
 * Whether the frames have the shape a park writes: every frame above the last
 * stands on a container and says where it is inside it (a loop its item, a
 * path its branch and selection); the last, the wait step, on no container.
 */
const isWellFormed = (frames: readonly ResumeFrame[]): boolean =>
  frames.every((frame, at) => {
    if (at === frames.length - 1) return frame.kind === undefined
    if (frame.kind === 'loop') return frame.item !== undefined
    return frame.kind === 'path' && frame.branch !== undefined && frame.selected !== undefined
  })

/**
 * Read a stored cursor back: `undefined` for anything that is not a well-formed
 * version-1 cursor holding at least one frame — which cancels the run rather
 * than resume it anywhere.
 */
export const parseResumeCursor = (raw: unknown): ResumeCursor | undefined => {
  const decoded = decodeCursor(raw)
  if (decoded._tag === 'None' || decoded.value.frames.length === 0) return undefined
  const cursor = decoded.value as ResumeCursor
  return isWellFormed(cursor.frames) ? cursor : undefined
}

/** A step of a configuration as the frame matcher reads it. */
type RawStep = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawStep =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stepsOf = (value: unknown): readonly RawStep[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

const propsOf = (step: RawStep): RawStep => (isRecord(step['props']) ? step['props'] : {})

/** The body a container frame leads into, or `undefined` when the step is not that container. */
const bodyOf = (step: RawStep, frame: ResumeFrame): readonly RawStep[] | undefined => {
  if (frame.kind === 'loop') {
    return step['type'] === 'loop' ? stepsOf(propsOf(step)['actions']) : undefined
  }
  if (step['type'] !== 'path') return undefined
  const branch = stepsOf(propsOf(step)['paths']).find((path) => path['name'] === frame.branch)
  return branch === undefined ? undefined : stepsOf(branch['actions'])
}

/** Where each frame of a cursor stands in the current configuration. */
export type FrameMatch =
  | { readonly ok: true; readonly positions: readonly number[] }
  | { readonly ok: false; readonly missing: string; readonly within?: string }

/**
 * Match `frames` against `actions` level by level, by step name and container
 * kind. Answers each frame's position in its CURRENT body, or the first step
 * (or branch) that is no longer there.
 */
export const matchResumeFrames = (
  actions: readonly RawStep[],
  frames: readonly ResumeFrame[]
): FrameMatch => {
  const [frame, ...rest] = frames
  if (frame === undefined) return { ok: true, positions: [] }
  const position = actions.findIndex((action) => action['name'] === frame.step)
  const step = actions[position]
  if (step === undefined) return { ok: false, missing: frame.step }
  if (rest.length === 0) return { ok: true, positions: [position] }
  const body = bodyOf(step, frame)
  if (body === undefined) {
    return { ok: false, missing: frame.branch ?? frame.step, within: frame.step }
  }
  const inner = matchResumeFrames(body, rest)
  if (!inner.ok) return inner.within === undefined ? { ...inner, within: frame.step } : inner
  return { ok: true, positions: [position, ...inner.positions] }
}

/** Why a parked run is cancelled when its frames no longer match. */
export const changedWhileWaitingError = (match: Extract<FrameMatch, { ok: false }>): string =>
  `The automation changed while the run was waiting: '${match.missing}' ` +
  (match.within === undefined
    ? 'is no longer one of its steps.'
    : `is no longer in '${match.within}'.`)
