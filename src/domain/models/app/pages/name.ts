/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const PageNameSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(63),
  Schema.annotations({
    title: 'Page Name',
    description: 'Human-readable name for the page',
    examples: ['Home', 'About Us', 'Home Page', 'Pricing', 'Contact'],
  })
)

export type PageName = Schema.Schema.Type<typeof PageNameSchema>
