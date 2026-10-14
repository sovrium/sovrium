/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Code-block theme configuration — one Shiki theme per colour scheme.
 *
 * Selects the syntax-highlighting theme applied to fenced code blocks in
 * markdown pages. The named theme drives the class/CSS-variable output emitted
 * by the Shiki highlighter — colors are delivered through the CSS system (not
 * inline `style`), so the output survives the canonical HTML sanitizer.
 *
 * The surface stays deliberately small — two named themes rather than a palette
 * of code-specific tokens — but it is TWO names rather than one, because one
 * cannot answer an app that renders in both schemes.
 *
 * ─── WHY `darkTheme` EXISTS ────────────────────────────────────────────────
 *
 * A single `theme` is a single set of token colours, and a page that honours
 * `prefers-color-scheme` repaints everything around the block without repainting
 * the block. Measured on the operator console's `/schema` page with
 * `colorScheme: 'system'` and `theme: 'github-light'`: the `pre.shiki` chrome
 * correctly darkened to `oklch(0.272 0 0)` while the tokens stayed on the light
 * theme's ink — body text `#24292E` at **1.27:1**, string literals `#032F62` at
 * **1.40:1**, 6020 low-contrast nodes on one page. The configuration a reader
 * came to read was, in that scheme, invisible.
 *
 * Flipping the one name to `github-dark` only moves the defect: the chrome then
 * pins to a near-black slab in the LIGHT scheme, which is correct in dark and
 * the loudest thing on the page in light. With one name there is no third state,
 * which is what makes this a schema gap rather than a configuration mistake.
 *
 * ─── WHY A SIBLING KEY AND NOT `theme: { light, dark }` ────────────────────
 *
 * `theme` already ships, is named in the published documentation in both
 * locales, and is declared by every app config that styles code. Widening it to
 * an object is a breaking rename paid by every existing config, to buy one added
 * capability; an OPTIONAL sibling is additive, and an app that never renders in
 * a second scheme never learns the name exists.
 *
 * ─── WHY IT IS NOT DERIVED ─────────────────────────────────────────────────
 *
 * `github-light` ↔ `github-dark` is a naming coincidence, not a rule: `nord`,
 * `dracula` and `vitesse-black` have no light sibling to compute, and
 * `catppuccin-latte`'s counterpart is spelled `catppuccin-mocha`. A derivation
 * would be right for one family and silently wrong for the rest, so the pair is
 * declared.
 *
 * ─── WHAT OMITTING IT MEANS ────────────────────────────────────────────────
 *
 * With a `theme` named, `theme` governs both schemes and no dark-scoped rule is
 * emitted at all. The absence is not a defaulted `darkTheme` — an app that
 * deliberately wants one theme everywhere (a docs site pinned to light, a
 * terminal-styled surface pinned to dark) keeps it by naming that one theme.
 *
 * With NEITHER named, the engine's pair applies — `github-light` in the light
 * scheme, `github-dark` in the dark one — because every app follows the
 * visitor's colour scheme by default (see `resolveCodeBlockThemes`). A
 * `darkTheme` named alone pairs with the default `github-light`.
 *
 * @example
 * ```typescript
 * // One theme everywhere, in both schemes
 * const design = {
 *   codeBlock: { theme: 'github-dark' }
 * }
 *
 * // A pair: quiet in light, legible in dark
 * const design = {
 *   colorScheme: 'system',
 *   codeBlock: { theme: 'github-light', darkTheme: 'github-dark' }
 * }
 * ```
 */
export const CodeBlockConfigSchema = Schema.Struct({
  /** Named Shiki theme applied to fenced code blocks */
  theme: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Code Block Theme',
        description:
          'Named Shiki theme for syntax highlighting (e.g., github-dark, github-light). Named without a `darkTheme`, it applies in both colour schemes. When neither is named, code blocks use `github-light` in the light scheme and `github-dark` in the dark one.',
        examples: ['github-dark', 'github-light', 'nord', 'dracula'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Named Shiki theme applied to fenced code blocks under the DARK colour
   * scheme. Omitted beside a named `theme`, that theme governs both schemes and
   * nothing dark-scoped is emitted; omitted with no `theme` either, the engine's
   * `github-dark` applies — see the module comment.
   */
  darkTheme: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Code Block Dark Theme',
        description:
          'Named Shiki theme applied under the dark colour scheme. When omitted, a named `theme` applies in both schemes; with no `theme` either, the dark scheme uses `github-dark`. Named alone, it pairs with the default `github-light`.',
        examples: ['github-dark', 'nord', 'dracula', 'catppuccin-mocha'],
      }),
      Schema.check(Schema.isMinLength(1))
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
 * sibling design-module pattern (`DesignElevation`, `DesignRadius`,
 * `BreakpointsConfig`). Awaiting adoption by the Shiki code-block CSS
 * generator — the consumer that will turn the `design.codeBlock.theme`
 * selector into emitted highlight styles.
 */
export type CodeBlockConfig = Schema.Schema.Type<typeof CodeBlockConfigSchema>
