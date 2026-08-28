/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Code-block theme configuration (single Shiki theme selector).
 *
 * Selects the syntax-highlighting theme applied to fenced code blocks in
 * markdown pages. The named theme drives the class/CSS-variable output emitted
 * by the Shiki highlighter — colors are delivered through the CSS system (not
 * inline `style`), so the output survives the canonical HTML sanitizer.
 *
 * Single-token by design: the docs-chrome plan deliberately keeps the
 * branding surface minimal — one themeable code-block token rather than a
 * large palette of code-specific tokens.
 *
 * @example
 * ```typescript
 * // Use a named Shiki theme for all fenced code blocks
 * const theme = {
 *   codeBlock: { theme: 'github-dark' }
 * }
 *
 * // Light theme
 * const theme = {
 *   codeBlock: { theme: 'github-light' }
 * }
 * ```
 */
export const CodeBlockConfigSchema = Schema.Struct({
  /** Named Shiki theme applied to fenced code blocks */
  theme: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        title: 'Code Block Theme',
        description: 'Named Shiki theme for syntax highlighting (e.g., github-dark, github-light)',
        examples: ['github-dark', 'github-light', 'nord', 'dracula'],
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'CodeBlockConfig',
    title: 'Code Block Configuration',
    description: 'Syntax-highlighting theme configuration for markdown fenced code blocks',
  })
)

/**
 * @public Forward-prep: paired with `CodeBlockConfigSchema` to match the
 * sibling theme-module pattern (`ShadowsConfig`, `BorderRadiusConfig`,
 * `BreakpointsConfig`). Awaiting adoption by the Shiki code-block CSS
 * generator — the consumer that will turn the `theme.codeBlock.theme`
 * selector into emitted highlight styles.
 */
export type CodeBlockConfig = Schema.Schema.Type<typeof CodeBlockConfigSchema>
