/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { guardedKeyRecord } from './token-value-schemas'

/**
 * The ELEVATION foundation: how far a surface sits off the page.
 *
 * ## Why `elevation` and not `shadows`
 *
 * `shadows` named the TECHNIQUE; elevation is the decision. A design system
 * chooses how many levels of depth it admits and what each one means — "cards
 * sit at `sm`, popovers at `lg`, nothing goes past `xl`" — and then spends a
 * box-shadow to render it. Naming the key after the box-shadow makes the
 * technique look like the point, which is how a system ends up with eleven
 * shadows and no levels.
 *
 * The value stays a raw `box-shadow` string, so a level can be a ring, an
 * inset, or several layered shadows. Constraining it to a generated shadow
 * would be a different key with a different job.
 *
 * The KEY grammar is kebab-case, asserted at the RECORD level: Effect v4
 * silently DROPS a key-schema failure, so a record keyed `Card` decoded to `{}`
 * with no error and no shadow. See `guardedKeyRecord`.
 */
export const DesignElevationSchema = guardedKeyRecord(
  Schema.String.pipe(
    Schema.annotate({
      title: 'Shadow Value',
      description: 'CSS box-shadow value',
      examples: ['none', '0 1px 2px 0 rgb(0 0 0 / 0.05)'],
    })
  ),
  {
    path: 'design.elevation',
    pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
    keyHint: 'An elevation level name is kebab-case (lowercase letters, digits and hyphens).',
    keyTitle: 'Elevation Level',
    keyExamples: ['none', 'sm', 'lg', '2xl'],
    description:
      "The app's shadow levels, from flat to furthest off the page. Each name becomes the suffix of a shadow utility.",
  }
).pipe(
  Schema.annotate({
    identifier: 'DesignElevation',
    title: 'Elevation Scale',
    description: "The app's elevation levels, keyed by name, each rendered as a `box-shadow`.",
    examples: [
      {
        none: 'none',
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
      },
    ],
  })
)

/** @public */
export type DesignElevation = Schema.Schema.Type<typeof DesignElevationSchema>
