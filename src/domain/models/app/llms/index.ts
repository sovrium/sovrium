/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * LlmsSchema configures the auto-generated `/llms.txt` and `/llms-full.txt`
 * routes (the llmstxt.org convention for surfacing site content to LLMs).
 *
 * The routes are auto-derived whenever an app declares content-directory pages,
 * so this whole block is optional — operators only need it to disable the
 * feature or to override the generated heading/description.
 *
 * @example
 * ```typescript
 * // Disable the feature
 * llms: { enabled: false }
 *
 * // Override the heading + blockquote
 * llms: { title: 'Sovrium Docs', description: 'The official documentation' }
 * ```
 */
export const LlmsSchema = Schema.Struct({
  /**
   * Whether the `/llms.txt` + `/llms-full.txt` routes are served.
   *
   * Defaults to `true` (auto-derived) when content-directory pages exist.
   * Set to `false` to disable the routes entirely (they return 404).
   */
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Enable the auto-generated /llms.txt routes (default: true when docs exist)',
      })
    )
  ),

  /**
   * Override for the H1 site title at the top of `/llms.txt`. When omitted, the
   * app name is used.
   */
  title: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Override the H1 title at the top of /llms.txt' })
    )
  ),

  /**
   * Override for the blockquote description under the H1. When omitted, the app
   * description (if any) is used.
   */
  description: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Override the blockquote description in /llms.txt' })
    )
  ),

  /**
   * Whether the `/llms-full.txt` route (full markdown-body concatenation) is
   * served. Defaults to `true` when the feature is enabled.
   */
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

/**
 * TypeScript type inferred from LlmsSchema.
 * @public
 */
export type Llms = Schema.Schema.Type<typeof LlmsSchema>

/**
 * Encoded type of LlmsSchema (what goes in).
 * @public
 */
export type LlmsEncoded = Schema.Schema.Encoded<typeof LlmsSchema>
