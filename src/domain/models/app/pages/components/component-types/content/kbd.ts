/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `kbd` — a key or a chord, drawn as a keycap.
 *
 * ## Why a type rather than a `code` element
 *
 * `code` says "this is source"; a keycap says "press this". They are different
 * claims to a reader and different elements to a screen reader — `<kbd>` is the
 * one HTML has for input, and nothing else in the kit emits it. Documenting a
 * shortcut with `code` also inherits the code frame's copy affordance, which
 * offers to put `⌘` on the clipboard.
 *
 * ## The chord is an array, not a string
 *
 * `keys: ['⌘', 'K']` rather than `keys: '⌘K'`, because each cap is its own
 * element: the box, the border and the 2px bottom edge are per key. A string
 * would need a split rule, and every split rule is wrong for some shortcut —
 * `+` is a separator in `Ctrl+C` and a key in `Ctrl++`.
 *
 * ## `separator` is TEXT between caps, never a cap
 *
 * Declaring `separator: '+'` prints a plain `+` between the boxes. It is not a
 * key, so it is not in `keys` and does not get a box; that is the distinction a
 * reader has to be able to make at a glance, and it is exactly the one the
 * split rule above cannot make.
 *
 * Source: [internal ref]
 * Specs: [internal ref] … 004, plus this type's own REGRESSION rollup
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const KbdTypeLiteral = Schema.Literal('kbd')

export const kbdFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /**
   * The keys, in the order they are pressed.
   *
   * Required and non-empty: a keycap with no key on it is not a smaller keycap,
   * it is a config that forgot the shortcut.
   */
  keys: Schema.Array(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Key',
        description: 'One key, exactly as it is printed on the keyboard',
        examples: ['⌘', 'K', 'Esc', 'Shift'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  )
    .pipe(Schema.check(Schema.isMinLength(1)))
    .annotate({
      title: 'Keys',
      description:
        'The keys of the chord, in press order. Each becomes its own `<kbd>` cap — one per element, because the box and its bottom edge are per key.',
      examples: [['⌘', 'K'], ['Esc']],
    }),
  /**
   * Text printed between the caps.
   *
   * Omitted, the caps sit adjacent with the design's own gap — the convention
   * on Apple keyboards and in most modern documentation. Give it `'+'` or
   * `'then'` when the chord needs to say how the keys combine.
   */
  separator: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Separator',
        description:
          'Plain text printed between the caps — never itself a cap. Omit for adjacent keys.',
        examples: ['+', 'then'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
} as const
