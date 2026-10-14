/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** The code-block theme every app gets when it names none: light, for the light scheme. */
export const DEFAULT_CODE_BLOCK_THEME = 'github-light'

/** Its counterpart under the dark scheme, paired with the default above. */
export const DEFAULT_CODE_BLOCK_DARK_THEME = 'github-dark'

/** The two Shiki themes a code block is drawn with, the dark one absent when one theme governs both. */
export interface CodeBlockThemes {
  readonly theme: string
  readonly darkTheme: string | undefined
}

/**
 * The themes a code block is actually drawn with, from what `design.codeBlock`
 * declares. Pure.
 *
 * An app that names no `theme` gets the engine's pair, `github-light` under the
 * light scheme and `github-dark` under the dark one, because every app follows
 * the visitor's colour scheme by default and a single dark theme would draw a
 * near-black slab on every light page. An app that names its own `theme` keeps
 * the meaning it always had: without a `darkTheme`, that one theme governs both
 * schemes. A `darkTheme` named on its own pairs with the default light theme.
 *
 * @param theme - `design.codeBlock.theme`, when declared.
 * @param darkTheme - `design.codeBlock.darkTheme`, when declared.
 */
export const resolveCodeBlockThemes = (
  theme: string | undefined,
  darkTheme: string | undefined
): CodeBlockThemes => {
  const declaredDark = darkTheme === undefined || darkTheme === '' ? undefined : darkTheme
  return theme === undefined || theme === ''
    ? { theme: DEFAULT_CODE_BLOCK_THEME, darkTheme: declaredDark ?? DEFAULT_CODE_BLOCK_DARK_THEME }
    : { theme, darkTheme: declaredDark }
}
