/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two Shiki themes every code block is drawn with: shadcn/ui's default
 * pair. A `code` component, a markdown fence, an ai-chat answer and the
 * stylesheet all read these same two names, so the markup and the CSS agree.
 *
 * `design.codeBlock` is deprecated and ignored: nothing an app declares
 * reaches them.
 */

/** The code-block theme of the light colour scheme. */
export const DEFAULT_CODE_BLOCK_THEME = 'github-light'

/** Its counterpart under the dark colour scheme. */
export const DEFAULT_CODE_BLOCK_DARK_THEME = 'github-dark'
