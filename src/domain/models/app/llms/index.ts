/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const LlmsSchema = Schema.Struct({
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Enable the auto-generated /llms.txt routes (default: true when docs exist)',
      })
    )
  ),

  title: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Override the H1 title at the top of /llms.txt' })
    )
  ),

  description: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Override the blockquote description in /llms.txt' })
    )
  ),

  full: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Serve /llms-full.txt with concatenated bodies' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'Llms',
    title: 'LLMs.txt Configuration',
    description:
      'Configuration for the auto-generated /llms.txt and /llms-full.txt routes (llmstxt.org).',
    examples: [
      { enabled: false },
      { title: 'Sovrium Docs', description: 'The official Sovrium documentation' },
    ],
  })
)

export type Llms = Schema.Schema.Type<typeof LlmsSchema>

export type LlmsEncoded = Schema.Schema.Encoded<typeof LlmsSchema>
