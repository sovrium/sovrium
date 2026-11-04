/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Configuration for the auto-generated `/llms.txt` and `/llms-full.txt` routes.
 *
 * The reader-facing explanation — what the convention is, when the block is
 * needed at all, and what the inherited defaults fall back to — lives in
 * `llms.docs.md` beside this file, and its option table is expanded from the
 * annotations below rather than transcribed. Keep behaviour notes here and
 * prose there, so the two cannot come to disagree.
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
      Schema.annotate({
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
      Schema.annotate({
        description:
          'Override the H1 title at the top of /llms.txt; a $t: key resolves in each route language',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /**
   * Override for the blockquote description under the H1. When omitted, the app
   * description (if any) is used.
   */
  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Override the blockquote description in /llms.txt; a $t: key resolves in each route language',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /**
   * Whether the `/llms-full.txt` route (full markdown-body concatenation) is
   * served. Defaults to `true` when the feature is enabled.
   */
  full: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'true',
        description: 'Serve /llms-full.txt with concatenated bodies',
      })
    )
  ),

  /**
   * Whether `/llms.txt` also lists the app's own config pages, not only its
   * content-directory articles. Off unless set, so no existing index changes.
   *
   * A config page is listed only when a signed-out visitor can open it, its
   * path has no dynamic segment (a `:lang` segment excepted), and it declares a
   * `meta.description`: the description is the author's statement that the page
   * deserves a line. Each is a `- [meta.title](path): meta.description` bullet
   * in a section of its own, scoped to its language like every other entry.
   * `/llms-full.txt` is unchanged: a config page has no markdown body to add.
   */
  includeConfigPages: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'false',
        description:
          'Also list in /llms.txt each public config page with no dynamic segment that declares a meta.description',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'Llms',
    title: 'LLMs.txt Configuration',
    description:
      'Configuration for the auto-generated /llms.txt and /llms-full.txt routes (llmstxt.org).',
    examples: [
      { enabled: false },
      { title: 'Sovrium Docs', description: 'The official Sovrium documentation' },
      { includeConfigPages: true },
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
export type LlmsEncoded = Schema.Codec.Encoded<typeof LlmsSchema>
