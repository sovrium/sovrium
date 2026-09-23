/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  DurationValueSchema,
  EasingValueSchema,
  guardedKeyRecord,
  ladderRecord,
} from './token-value-schemas'

/**
 * The MOTION foundation: how long a change takes, how it accelerates, the
 * keyframe blocks it can run, and the animations composed out of all three.
 *
 * ## Why four members and not one record
 *
 * Motion used to be ONE flat record whose keys were `fadeIn`, `slideUp` — and
 * ALSO `duration`, `easing` and `keyframes`, three reserved names sharing the
 * same keyspace and told apart only by the SHAPE of their value. That is two
 * different kinds of thing in one map: a step of a ladder and a composed
 * animation are not the same declaration, and a record that holds both has to
 * be read by a human before anyone can say which is which. It also meant an
 * author could not name an animation `duration`.
 *
 * The four members split that apart, one purpose each:
 *
 * - `durations` — the length ladder. Becomes `duration-{step}`.
 * - `easings` — the curve set. Becomes `ease-{step}`.
 * - `keyframes` — named, reusable keyframe blocks. Becomes `@keyframes {name}`.
 * - `animations` — the compositions that SPEND a duration and a curve.
 *
 * ## Why two key grammars, deliberately
 *
 * `durations` and `easings` key on the ladder grammar (`fast`, `base`, `0-5`)
 * because a step name becomes a utility suffix and digits are the whole point.
 * `keyframes` and `animations` key on camelCase (`fadeIn`) because a name there
 * becomes a CSS identifier in an `@keyframes` at-rule and a class name.
 *
 * Merging the two grammars was considered and refused: the key SETS genuinely
 * differ, so one grammar would either widen the ladder to admit `fadeIn` or
 * narrow the animation names to refuse it. The grammars stay different because
 * they sit on different members, which is exactly what the split buys.
 *
 * ## The per-animation `keyframes` field is a different thing
 *
 * `animations.modalOpen.keyframes` declares keyframes INLINE on one animation.
 * `motion.keyframes.fadeIn` declares a named block several animations may run.
 * Both survive; they are not two spellings of one declaration.
 */

/**
 * A single animation, spelled out.
 *
 * @example
 * ```typescript
 * const config = {
 *   enabled: true,
 *   duration: '300ms',
 *   easing: 'ease-in-out',
 *   delay: '0ms',
 * }
 * ```
 */
export const AnimationConfigObjectSchema = Schema.Struct({
  enabled: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Turns the animation off without deleting it, leaving the end state in place.',
    })
  ),
  // The DESIGN layer's own duration and easing grammars, deliberately, and not
  // the ones a page component's hover block uses.
  //
  // Two reasons, one architectural and one about the reader. A model under
  // `design/` may not reach into `pages/` — the layer check refuses it, and
  // rightly: a token vocabulary that borrows its grammar from one consumer is
  // no longer the vocabulary of the layer that publishes it. And an inline
  // `easing` here sits three lines from the `easings` ladder it duplicates, so
  // the two obeying different rules is exactly the split this key exists to
  // end.
  //
  // The one measured difference: the design grammar admits `step-start` and
  // `step-end`, which the hover one did not, and checks only the FUNCTION NAME
  // of `cubic-bezier(...)` / `steps(...)` where the hover one also counted the
  // arguments. Tightening the design grammar to match would be the better
  // repair, but it changes what `design.motion.easings` accepts and belongs in
  // its own change with its own specs.
  duration: Schema.optional(
    DurationValueSchema.annotate({ description: 'How long one run of the animation takes.' })
  ),
  easing: Schema.optional(
    EasingValueSchema.annotate({
      description: 'How the animation accelerates and decelerates over its duration.',
    })
  ),
  delay: Schema.optional(
    DurationValueSchema.annotate({ description: 'How long to wait before the animation starts.' })
  ),
  keyframes: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description:
        'The steps the animation moves through, written inline instead of naming one of the shared keyframe blocks.',
    })
  ),
}).pipe(
  Schema.annotate({
    title: 'Animation Configuration Object',
    description: 'Detailed animation configuration',
  })
)

/**
 * An animation value — a switch, a CSS shorthand, or the spelled-out object.
 *
 * - Boolean: enable the platform's default treatment for that name.
 * - String: a CSS `animation` shorthand or a class name.
 * - Object: duration, easing, delay and inline keyframes.
 */
export const AnimationValueSchema = Schema.Union([
  Schema.Boolean,
  Schema.String,
  AnimationConfigObjectSchema,
]).pipe(
  Schema.annotate({
    title: 'Animation Value',
    description: 'Animation configuration (boolean, string, or object)',
  })
)

/** The camelCase grammar shared by `keyframes` and `animations`. */
const MOTION_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/

const MOTION_NAME_HINT =
  'A keyframe or animation name starts with a letter and holds only letters and digits (e.g. `fadeIn`) — it becomes a CSS identifier.'

export const DesignMotionSchema = Schema.Struct({
  /** The duration ladder — `fast`, `base`, `deliberate`. Becomes `duration-<name>`. */
  durations: Schema.optional(
    ladderRecord(DurationValueSchema, 'design.motion.durations', 'Duration Step', {
      keyExamples: ['fast', 'base', 'slow'],
      description:
        'The named lengths animations are allowed to take, from the quickest to the slowest.',
    })
  ),

  /** The curve set — `enter`, `exit`, `emphasized`. Becomes `ease-<name>`. */
  easings: Schema.optional(
    ladderRecord(EasingValueSchema, 'design.motion.easings', 'Easing Step', {
      keyExamples: ['default', 'enter', 'exit'],
      description: 'The named acceleration curves animations are allowed to use.',
    })
  ),

  /** Named, reusable keyframe blocks. Each becomes an `@keyframes` rule. */
  keyframes: Schema.optional(
    guardedKeyRecord(Schema.Record(Schema.String, Schema.Unknown), {
      path: 'design.motion.keyframes',
      pattern: MOTION_NAME_PATTERN,
      keyHint: MOTION_NAME_HINT,
      keyTitle: 'Keyframe Name',
      keyExamples: ['fadeIn', 'slideUp'],
      description:
        'Reusable sets of animation steps, each named, that the animations below refer to by name.',
    })
  ),

  /** The compositions — each spends a duration and a curve. */
  animations: Schema.optional(
    guardedKeyRecord(AnimationValueSchema, {
      path: 'design.motion.animations',
      pattern: MOTION_NAME_PATTERN,
      keyHint: MOTION_NAME_HINT,
      keyTitle: 'Animation Name',
      keyExamples: ['fadeIn', 'slideUp', 'modalOpen'],
      description:
        'The animations the app can play, each named and each spending one duration and one easing curve.',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'DesignMotion',
    title: 'Motion',
    description:
      "The app's motion foundation: the duration ladder, the easing set, the named keyframe blocks, and the animations composed out of them.",
    examples: [
      {
        durations: { fast: '120ms', base: '180ms', slow: '320ms' },
        easings: { default: 'cubic-bezier(0.2, 0, 0, 1)', enter: 'ease-out' },
        keyframes: { fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } } },
        animations: { modalOpen: { enabled: true, duration: '180ms', easing: 'ease-out' } },
      },
    ],
  })
)

/** @public */
export type AnimationConfigObject = Schema.Schema.Type<typeof AnimationConfigObjectSchema>
/** @public */
export type AnimationValue = Schema.Schema.Type<typeof AnimationValueSchema>
/** @public */
export type DesignMotion = Schema.Schema.Type<typeof DesignMotionSchema>
