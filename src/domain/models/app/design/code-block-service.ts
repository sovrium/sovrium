/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { CodeTokenRole, DesignCode } from './code'

/**
 * The two Shiki themes every code block is drawn with: shadcn/ui's default
 * pair. A `code` component, a markdown fence, an ai-chat answer and the
 * stylesheet all read these same two names, so the markup and the CSS agree.
 *
 * No config key chooses them.
 */

/** The code-block theme of the light colour scheme. */
export const DEFAULT_CODE_BLOCK_THEME = 'github-light'

/** Its counterpart under the dark colour scheme. */
export const DEFAULT_CODE_BLOCK_DARK_THEME = 'github-dark'

/**
 * The syntax role of a token, keyed by the colour the light theme paints it
 * (upper-case hex, no `#`, the form the highlighter writes into `tok-XXXXXX`).
 * One entry per role of `design.code.tokens`: the role of a span is decided by
 * the colour the highlighter already resolved, so it holds in every grammar.
 * The theme's other colours (plain text, invalid code, a removed diff line,
 * bracket highlights) are not roles.
 */
export const CODE_TOKEN_ROLE_BY_LIGHT_HEX: Readonly<Record<string, CodeTokenRole>> = {
  '6A737D': 'comment',
  D73A49: 'keyword',
  '032F62': 'string',
  '005CC5': 'constant',
  '6F42C1': 'function',
  '22863A': 'tag',
  E36209: 'variable',
}

/**
 * Whether code is drawn with a role class on each token (`tok-comment`,
 * `tok-keyword`, …): exactly when the design declares `code`. Every path that
 * highlights code (a `code` component, a markdown fence, an ai-chat answer, a
 * stored conversation) reads this one answer, so they never disagree; without
 * the key the markup is byte-identical to what every app drew before it.
 */
export const hasCodeRoleClasses = (
  design: { readonly code?: DesignCode | undefined } | undefined
): boolean => design?.code !== undefined
