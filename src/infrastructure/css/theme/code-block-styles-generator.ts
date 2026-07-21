/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Theme } from '@/domain/models/app/theme'

const DEFAULT_SHIKI_THEME = 'github-dark'

const COMMON_TOKEN_COLORS: Readonly<Record<string, string>> = {
  F97583: '#F97583',
  '79B8FF': '#79B8FF',
  '9ECBFF': '#9ECBFF',
  B392F0: '#B392F0',
  '85E89D': '#85E89D',
  E1E4E8: '#E1E4E8',
  '6A737D': '#6A737D',
  '81A1C1': '#81A1C1',
  '88C0D0': '#88C0D0',
  D8DEE9: '#D8DEE9',
  A3BE8C: '#A3BE8C',
  EBCB8B: '#EBCB8B',
  '5E81AC': '#5E81AC',
  B48EAD: '#B48EAD',
  D73A49: '#D73A49',
  '6F42C1': '#6F42C1',
  '24292E': '#24292E',
  '032F62': '#032F62',
  '005CC5': '#005CC5',
  '22863A': '#22863A',
}

interface ChromeColors {
  readonly background: string
  readonly foreground: string
}

const LIGHT_SHIKI_THEMES: ReadonlySet<string> = new Set([
  'github-light',
  'github-light-default',
  'github-light-high-contrast',
  'light-plus',
  'solarized-light',
  'min-light',
  'catppuccin-latte',
  'everforest-light',
  'one-light',
  'vitesse-light',
  'snazzy-light',
  'material-theme-lighter',
  'rose-pine-dawn',
  'slack-ochin',
])

const isLightShikiTheme = (themeName: string): boolean => {
  const name = themeName.toLowerCase()
  if (LIGHT_SHIKI_THEMES.has(name)) return true
  return (
    name.includes('light') ||
    name.includes('dawn') ||
    name.includes('latte') ||
    name.includes('-day')
  )
}

const resolveChromeColors = (themeName: string): ChromeColors =>
  isLightShikiTheme(themeName)
    ? {
        background: 'var(--color-background-subtle, #f6f8fa)',
        foreground: 'var(--color-foreground, #1f2328)',
      }
    : { background: '#0d0d0d', foreground: '#e1e4e8' }

const generateContainerChrome = (chrome: ChromeColors): string =>
  `pre.shiki {
    background-color: ${chrome.background};
    color: ${chrome.foreground};
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 0.875rem;
    line-height: 1.5;
  }
  pre.shiki code {
    background: transparent;
    padding: 0;
    font-family: inherit;
    font-size: inherit;
  }
  pre.shiki .line {
    display: inline-block;
    width: 100%;
  }`

const generateTokenColorRules = (): string =>
  Object.entries(COMMON_TOKEN_COLORS)
    .map(([hex, color]) => `  .tok-${hex} { color: ${color}; }`)
    .join('\n')

const resolveCodeBlockThemeName = (theme?: Theme): string =>
  theme?.codeBlock?.theme ?? DEFAULT_SHIKI_THEME

const generateThemeScopedHook = (themeName: string, chrome: ChromeColors): string =>
  `/* Sovrium code-block theme: ${themeName} */
  pre.shiki.${themeName} {
    /* Same theme-tracked chrome as pre.shiki; declared at higher specificity
       so it never re-lightens a dark theme's chrome, and so the theme name is
       observable in the compiled stylesheet (used by the theme-token regression). */
    background-color: ${chrome.background};
    color: ${chrome.foreground};
  }`

export const generateCodeBlockStyles = (theme?: Theme): string => {
  const themeName = resolveCodeBlockThemeName(theme)
  const chromeColors = resolveChromeColors(themeName)
  const chrome = generateContainerChrome(chromeColors)
  const tokenRules = generateTokenColorRules()
  const themeHook = generateThemeScopedHook(themeName, chromeColors)
  return `${chrome}\n${tokenRules}\n${themeHook}`
}
