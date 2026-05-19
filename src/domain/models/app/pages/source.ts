/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const PageSourceSchema = Schema.Struct({
  file: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'File path for page content (e.g., content/about.md)' })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'PageSource',
    title: 'Page Source',
    description: 'File-based content source for the page',
  })
)

export type PageSource = typeof PageSourceSchema.Type
