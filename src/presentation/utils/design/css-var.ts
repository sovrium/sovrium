/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const withVarFallback = (varName: string, fallback: string): string =>
  `var(--${varName},${fallback.replace(/ /g, '_')})`

export const TOKENS = {
  neutral50: 'oklch(0.985 0.003 75)',
  neutral100: 'oklch(0.965 0.005 75)',
  neutral200: 'oklch(0.92 0.007 72)',
  neutral300: 'oklch(0.87 0.009 70)',
  neutral400: 'oklch(0.71 0.011 65)',
  neutral500: 'oklch(0.56 0.011 60)',
  neutral600: 'oklch(0.445 0.012 55)',
  neutral700: 'oklch(0.375 0.012 50)',
  neutral800: 'oklch(0.272 0.01 45)',
  neutral900: 'oklch(0.205 0.008 40)',
  neutral950: 'oklch(0.14 0.006 38)',

  bg: 'oklch(0.985 0.003 75)',
  bgSubtle: 'oklch(0.965 0.005 75)',
  bgRaised: 'oklch(0.995 0.002 75)',
  bgOverlay: 'oklch(0.995 0.002 75)',
  scrim: 'oklch(0.14 0.006 38)',

  border: 'oklch(0.92 0.007 72)',
  borderStrong: 'oklch(0.87 0.009 70)',
  borderInverse: 'oklch(0.205 0.008 40)',

  fg: 'oklch(0.14 0.006 38)',
  fgMuted: 'oklch(0.445 0.012 55)',
  fgSubtle: 'oklch(0.56 0.011 60)',
  fgDisabled: 'oklch(0.71 0.011 65)',
  fgInverse: 'oklch(0.985 0.003 75)',
  fgHumane: 'oklch(0.3 0.02 45)',

  primary: 'oklch(0.205 0.008 40)',
  primaryHover: 'oklch(0.272 0.01 45)',
  primaryActive: 'oklch(0.14 0.006 38)',
  primaryFg: 'oklch(0.985 0.003 75)',
  primarySubtle: 'oklch(0.965 0.005 75)',
  primarySubtleFg: 'oklch(0.205 0.008 40)',

  focusRing: 'oklch(0.205 0.008 40)',

  warmth50: 'oklch(0.975 0.012 50)',
  warmth100: 'oklch(0.945 0.025 50)',
  warmth300: 'oklch(0.81 0.075 50)',
  warmth500: 'oklch(0.62 0.1 50)',
  warmth700: 'oklch(0.47 0.085 48)',
  warmth900: 'oklch(0.31 0.055 45)',
  warmth950: 'oklch(0.215 0.04 45)',
  warmth: 'oklch(0.62 0.1 50)',
  warmthFg: 'oklch(0.47 0.085 48)',
  warmthSubtle: 'oklch(0.945 0.025 50)',
  warmthBorder: 'oklch(0.81 0.075 50)',

  success50: 'oklch(0.975 0.02 152)',
  success100: 'oklch(0.945 0.045 152)',
  success300: 'oklch(0.81 0.13 150)',
  success500: 'oklch(0.62 0.165 148)',
  success600: 'oklch(0.54 0.15 148)',
  success700: 'oklch(0.45 0.13 148)',
  success950: 'oklch(0.215 0.055 148)',
  successBg: 'oklch(0.945 0.045 152)',
  successBorder: 'oklch(0.81 0.13 150)',
  successFg: 'oklch(0.45 0.13 148)',
  successSolid: 'oklch(0.54 0.15 148)',
  successSolidFg: 'oklch(0.985 0.003 75)',

  warning50: 'oklch(0.985 0.02 80)',
  warning100: 'oklch(0.96 0.045 80)',
  warning300: 'oklch(0.87 0.13 78)',
  warning500: 'oklch(0.76 0.155 72)',
  warning700: 'oklch(0.54 0.135 55)',
  warning950: 'oklch(0.245 0.06 50)',
  warningBg: 'oklch(0.96 0.045 80)',
  warningBorder: 'oklch(0.87 0.13 78)',
  warningFg: 'oklch(0.54 0.135 55)',
  warningSolid: 'oklch(0.76 0.155 72)',
  warningSolidFg: 'oklch(0.245 0.06 50)',

  error50: 'oklch(0.975 0.015 25)',
  error100: 'oklch(0.945 0.04 25)',
  error300: 'oklch(0.81 0.135 25)',
  error500: 'oklch(0.605 0.205 25)',
  error600: 'oklch(0.53 0.195 25)',
  error700: 'oklch(0.455 0.17 25)',
  error950: 'oklch(0.225 0.08 25)',
  errorBg: 'oklch(0.945 0.04 25)',
  errorBorder: 'oklch(0.81 0.135 25)',
  errorFg: 'oklch(0.455 0.17 25)',
  errorSolid: 'oklch(0.53 0.195 25)',
  errorSolidFg: 'oklch(0.985 0.003 75)',

  info50: 'oklch(0.975 0.015 240)',
  info100: 'oklch(0.945 0.035 240)',
  info300: 'oklch(0.81 0.115 240)',
  info500: 'oklch(0.61 0.165 240)',
  info600: 'oklch(0.53 0.18 240)',
  info700: 'oklch(0.455 0.15 240)',
  info950: 'oklch(0.225 0.07 240)',
  infoBg: 'oklch(0.945 0.035 240)',
  infoBorder: 'oklch(0.81 0.115 240)',
  infoFg: 'oklch(0.455 0.15 240)',
  infoSolid: 'oklch(0.53 0.18 240)',
  infoSolidFg: 'oklch(0.985 0.003 75)',

  radiusNone: '0px',
  radiusSm: '2px',
  radiusBase: '4px',
  radiusMd: '6px',
  radiusLg: '8px',
  radiusXl: '12px',
  radiusFull: '9999px',

  shadowNone: 'none',
  shadowXs: '0 1px 0 0 rgb(45 30 15 / 0.04)',
  shadowSm: '0 1px 2px 0 rgb(45 30 15 / 0.05), 0 1px 1px -1px rgb(45 30 15 / 0.04)',
  shadowMd: '0 4px 12px -2px rgb(45 30 15 / 0.07), 0 2px 4px -1px rgb(45 30 15 / 0.04)',
  shadowLg: '0 12px 28px -4px rgb(45 30 15 / 0.09), 0 4px 8px -2px rgb(45 30 15 / 0.04)',
  shadowXl: '0 24px 48px -8px rgb(45 30 15 / 0.13), 0 8px 16px -4px rgb(45 30 15 / 0.06)',

  durationInstant: '0ms',
  durationFast: '120ms',
  durationBase: '180ms',
  durationSlow: '260ms',
  durationDeliberate: '340ms',

  easeDefault: 'cubic-bezier(0.2, 0, 0, 1)',
  easeEnter: 'cubic-bezier(0, 0, 0.2, 1)',
  easeExit: 'cubic-bezier(0.4, 0, 1, 1)',
  easeEmphasized: 'cubic-bezier(0.3, 0, 0.1, 1.1)',

  fontSans:
    "'IBM Plex Sans Variable', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  fontMono:
    "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  fontSerif:
    "'Source Serif 4 Variable', 'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif",

  fontSize2xs: '0.6875rem',
  fontSizeXs: '0.75rem',
  fontSizeSm: '0.8125rem',
  fontSizeBase: '0.875rem',
  fontSizeMd: '1rem',
  fontSizeLg: '1.125rem',
  fontSizeXl: '1.25rem',
  fontSize2xl: '1.5rem',
  fontSize3xl: '1.875rem',
  fontSize4xl: '2.25rem',
  fontSize5xl: '3rem',
  fontSize6xl: '3.75rem',

  fontWeightRegular: '400',
  fontWeightMedium: '500',
  fontWeightSemibold: '600',
  fontWeightBold: '700',

  lineHeightNone: '1',
  lineHeightTight: '1.1',
  lineHeightSnug: '1.25',
  lineHeightNormal: '1.55',
  lineHeightRelaxed: '1.7',

  letterSpacingTighter: '-0.022em',
  letterSpacingTight: '-0.012em',
  letterSpacingNormal: '0',
  letterSpacingWide: '0.02em',
  letterSpacingCaps: '0.04em',
} as const

export type TokenKey = keyof typeof TOKENS
