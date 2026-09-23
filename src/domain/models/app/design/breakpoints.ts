/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { guardedKeyRecord } from './token-value-schemas'

/**
 * The LAYOUT foundation: the widths at which the design changes its mind.
 *
 * ## The name was already right
 *
 * Nothing is renamed here — only the position changed. Every foundation is now
 * a sibling at `design.*`, addressable exactly once.
 *
 * Breakpoints are pixel-only. `em`-based breakpoints are a defensible choice
 * and a different one; admitting both would mean two configs that look alike
 * responding differently to a browser zoom, with nothing in the key to say so.
 *
 * The KEY grammar `^[a-z0-9]+$` is asserted at the RECORD level: Effect v4
 * silently DROPS a key-schema failure, so a record keyed `md-wide` decoded to
 * `{}` with no error and no breakpoint. See `guardedKeyRecord`.
 */
export const DesignBreakpointsSchema = guardedKeyRecord(
  Schema.String.pipe(
    Schema.annotate({
      title: 'Breakpoint Value',
      description: 'Breakpoint value in pixels',
      examples: ['640px', '768px', '1024px'],
    }),
    Schema.check(
      Schema.isPattern(/^[0-9]+px$/, {
        message: 'Breakpoint value must be in pixels (e.g., "640px")',
      })
    )
  ),
  {
    path: 'design.breakpoints',
    pattern: /^[a-z0-9]+$/,
    keyHint: 'A breakpoint name is lowercase alphanumeric, with no hyphen.',
    keyTitle: 'Breakpoint Key',
    keyExamples: ['sm', 'md', 'lg', '2xl'],
    description:
      'The screen widths at which the layout changes, in pixels. Each name becomes a responsive prefix such as `md:`.',
  }
).pipe(
  Schema.annotate({
    identifier: 'DesignBreakpoints',
    title: 'Breakpoints',
    description: "The app's responsive breakpoints, in pixels.",
    examples: [{ sm: '640px', md: '768px', lg: '1024px', xl: '1280px' }],
  })
)

/** @public */
export type DesignBreakpoints = Schema.Schema.Type<typeof DesignBreakpointsSchema>
