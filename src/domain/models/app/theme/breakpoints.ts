/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Breakpoints configuration (responsive design breakpoints)
 *
 * Map of breakpoint names to pixel values.
 * Standard Tailwind breakpoints:
 * - sm: 640px (mobile)
 * - md: 768px (tablet)
 * - lg: 1024px (laptop)
 * - xl: 1280px (desktop)
 * - 2xl: 1536px (large desktop)
 *
 * @example
 * ```typescript
 * const breakpoints = {
 *   sm: '640px',
 *   md: '768px',
 *   lg: '1024px',
 *   xl: '1280px',
 *   '2xl': '1536px',
 * }
 * ```
 *
 * @see specs/app/theme/breakpoints/breakpoints.schema.json
 */
export const BreakpointsConfigSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-z0-9]+$/, {
      message: () => 'Breakpoint key must be lowercase alphanumeric',
    }),
    Schema.annotations({
      title: 'Breakpoint Key',
      description: 'Breakpoint name (lowercase alphanumeric)',
      examples: ['sm', 'md', 'lg', 'xl', '2xl'],
    })
  ),
  value: Schema.String.pipe(
    Schema.pattern(/^[0-9]+px$/, {
      message: () => 'Breakpoint value must be in pixels (e.g., "640px")',
    }),
    Schema.annotations({
      title: 'Breakpoint Value',
      description: 'Breakpoint value in pixels',
      examples: ['640px', '768px', '1024px', '1280px'],
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Breakpoints',
    description: 'Responsive design breakpoints',
  })
)

export type BreakpointsConfig = Schema.Schema.Type<typeof BreakpointsConfigSchema>
