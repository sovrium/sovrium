/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

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
