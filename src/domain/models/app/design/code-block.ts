/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Code-block theme configuration — DEPRECATED, and ignored.
 *
 * Code blocks draw shadcn/ui's default colours, the ones its own Code Block
 * uses: `github-light` in the light colour scheme and `github-dark` in the dark
 * one, following the visitor's scheme. That holds for a `code` component, a
 * markdown fence and a code block in an ai-chat answer alike.
 *
 * The key names a Shiki theme (`theme`) and a dark counterpart
 * (`darkTheme`). It is deprecated since 0.40 and INERT from that release on:
 * still accepted, so a config naming it keeps validating and starting, with a
 * deprecation warning from `validate`, `start` and `build`; ignored everywhere;
 * and refused from 0.41, when it leaves this schema for `removed-keys.ts`.
 *
 * Why inert rather than honoured for its last release: a per-app theme was the
 * one place an app could put a palette on the page the engine does not floor
 * for contrast, and one surface (the ai-chat answer) never read it, so a named
 * dark theme put light-theme ink on a dark ground there. Honouring it for one
 * more release would keep both defects alive for that release.
 */
export const CodeBlockConfigSchema = Schema.Struct({
  /** Deprecated and ignored: was the Shiki theme for code blocks. */
  theme: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Code Block Theme (deprecated)',
        description:
          "Deprecated since 0.40 and ignored; refused from 0.41. Code blocks use shadcn/ui's default colours: `github-light` in the light colour scheme and `github-dark` in the dark one. Remove the key.",
        examples: ['github-light'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Deprecated and ignored: was the Shiki theme for the dark colour scheme. */
  darkTheme: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Code Block Dark Theme (deprecated)',
        description:
          "Deprecated since 0.40 and ignored; refused from 0.41. Code blocks use shadcn/ui's default colours: `github-dark` in the dark colour scheme. Remove the key.",
        examples: ['github-dark'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'CodeBlockConfig',
    title: 'Code Block Configuration (deprecated)',
    description:
      "Deprecated since 0.40 and ignored; refused from 0.41. Code blocks use shadcn/ui's default colours, `github-light` in the light colour scheme and `github-dark` in the dark one, whatever this names. Remove `design.codeBlock`.",
  })
)

/**
 * @public The decoded shape of the deprecated key, kept while the schema still
 * accepts it (one release, until 0.41 refuses it).
 */
export type CodeBlockConfig = Schema.Schema.Type<typeof CodeBlockConfigSchema>
