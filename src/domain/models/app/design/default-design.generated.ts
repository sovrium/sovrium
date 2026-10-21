/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Flat, resolved views over the default design — the shapes other modules and gates read.
 *
 * AUTO-GENERATED from `[internal ref]` — DO NOT EDIT.
 *
 * Regenerate: `bun run build:default-design`
 */

/**
 * Every `--sv-*` token and the LITERAL it computes to in light mode, with every
 * `var()` indirection resolved. This is the shape a gate can compare against,
 * which the CSS text never was.
 */
export const DEFAULT_SV_LIGHT_VALUES: Readonly<Record<string, string>> = {
  'bg-inset': 'oklch(0.952 0 0)',
  'border-inverse': 'oklch(0.205 0 0)',
  'border-strong': 'oklch(0.87 0 0)',
  'density-button-h': '28px',
  'density-control-h': '36px',
  'density-gap': '7px',
  'density-row-y': '5px',
  'density-text': '11px',
  'error-100': '#fdf5f3',
  'error-300': '#f0c8bd',
  'error-50': '#fefbfa',
  'error-500': '#dc472e',
  'error-600': '#c13520',
  'error-700': '#a12b1a',
  'error-950': '#3d0e08',
  'error-bg': '#fdf5f3',
  'error-border': '#f0c8bd',
  'error-fg': '#a12b1a',
  'error-solid-fg': 'oklch(0.985 0 0)',
  'fg-disabled': 'oklch(0.71 0 0)',
  'fg-inverse': 'oklch(0.985 0 0)',
  'fg-subtle': 'oklch(0.54 0 0)',
  'info-100': 'oklch(0.932 0.032 255.585)',
  'info-300': 'oklch(0.809 0.105 251.813)',
  'info-50': 'oklch(0.97 0.014 254.604)',
  'info-500': 'oklch(0.623 0.214 259.815)',
  'info-600': '#398ad6',
  'info-700': 'oklch(0.488 0.243 264.376)',
  'info-950': 'oklch(0.282 0.091 267.935)',
  'info-bg': 'oklch(0.932 0.032 255.585)',
  'info-border': 'oklch(0.809 0.105 251.813)',
  'info-fg': 'oklch(0.488 0.243 264.376)',
  'info-solid': '#398ad6',
  'info-solid-fg': 'oklch(0.985 0 0)',
  'neutral-100': 'oklch(0.965 0 0)',
  'neutral-200': 'oklch(0.92 0 0)',
  'neutral-300': 'oklch(0.87 0 0)',
  'neutral-400': 'oklch(0.71 0 0)',
  'neutral-50': 'oklch(0.985 0 0)',
  'neutral-500': 'oklch(0.56 0 0)',
  'neutral-600': 'oklch(0.445 0 0)',
  'neutral-700': 'oklch(0.375 0 0)',
  'neutral-800': 'oklch(0.272 0 0)',
  'neutral-900': 'oklch(0.205 0 0)',
  'neutral-950': 'oklch(0.14 0 0)',
  'primary-active': 'oklch(0.14 0 0)',
  'primary-hover': 'oklch(0.272 0 0)',
  'primary-subtle': 'oklch(0.965 0 0)',
  'primary-subtle-fg': 'oklch(0.205 0 0)',
  'success-100': 'oklch(0.962 0.044 156.743)',
  'success-300': 'oklch(0.871 0.15 154.449)',
  'success-50': 'oklch(0.982 0.018 155.826)',
  'success-500': 'oklch(0.723 0.219 149.579)',
  'success-600': 'oklch(0.627 0.194 149.214)',
  'success-700': 'oklch(0.527 0.154 150.069)',
  'success-950': 'oklch(0.266 0.065 152.934)',
  'success-bg': 'oklch(0.962 0.044 156.743)',
  'success-border': 'oklch(0.871 0.15 154.449)',
  'success-fg': 'oklch(0.527 0.154 150.069)',
  'success-solid': 'oklch(0.627 0.194 149.214)',
  'success-solid-fg': 'oklch(0.985 0 0)',
  'warning-100': 'oklch(0.962 0.059 95.617)',
  'warning-300': 'oklch(0.879 0.169 91.605)',
  'warning-50': 'oklch(0.987 0.022 95.277)',
  'warning-500': 'oklch(0.769 0.188 70.08)',
  'warning-700': 'oklch(0.555 0.163 48.998)',
  'warning-950': 'oklch(0.279 0.077 45.635)',
  'warning-bg': 'oklch(0.962 0.059 95.617)',
  'warning-border': 'oklch(0.879 0.169 91.605)',
  'warning-fg': 'oklch(0.555 0.163 48.998)',
  'warning-solid': 'oklch(0.769 0.188 70.08)',
  'warning-solid-fg': 'oklch(0.279 0.077 45.635)',
}

/**
 * Every shadcn/ui variable the snapshot declares and its LIGHT literal, chart
 * hues as `#rrggbb`. The value layer the engine speaks ([internal ref] D12).
 */
export const DEFAULT_SHADCN_LIGHT_VALUES: Readonly<Record<string, string>> = {
  background: 'oklch(1 0 0)',
  foreground: 'oklch(0.145 0 0)',
  card: 'oklch(1 0 0)',
  'card-foreground': 'oklch(0.145 0 0)',
  popover: 'oklch(1 0 0)',
  'popover-foreground': 'oklch(0.145 0 0)',
  primary: 'oklch(0.205 0 0)',
  'primary-foreground': 'oklch(0.985 0 0)',
  secondary: 'oklch(0.97 0 0)',
  'secondary-foreground': 'oklch(0.205 0 0)',
  muted: 'oklch(0.97 0 0)',
  'muted-foreground': 'oklch(0.52 0 0)',
  accent: 'oklch(0.97 0 0)',
  'accent-foreground': 'oklch(0.205 0 0)',
  destructive: 'oklch(0.5 0.245 27.325)',
  border: 'oklch(0.922 0 0)',
  input: 'oklch(0.65 0 0)',
  ring: 'oklch(0.708 0 0)',
  'chart-1': '#d4d4d4',
  'chart-2': '#737373',
  'chart-3': '#525252',
  'chart-4': '#404040',
  'chart-5': '#262626',
  radius: '0.625rem',
  sidebar: 'oklch(0.985 0 0)',
  'sidebar-foreground': 'oklch(0.145 0 0)',
  'sidebar-primary': 'oklch(0.205 0 0)',
  'sidebar-primary-foreground': 'oklch(0.985 0 0)',
  'sidebar-accent': 'oklch(0.97 0 0)',
  'sidebar-accent-foreground': 'oklch(0.205 0 0)',
  'sidebar-border': 'oklch(0.922 0 0)',
  'sidebar-ring': 'oklch(0.708 0 0)',
}

/** The same variables in the DARK scheme. */
export const DEFAULT_SHADCN_DARK_VALUES: Readonly<Record<string, string>> = {
  background: 'oklch(0.145 0 0)',
  foreground: 'oklch(0.985 0 0)',
  card: 'oklch(0.205 0 0)',
  'card-foreground': 'oklch(0.985 0 0)',
  popover: 'oklch(0.205 0 0)',
  'popover-foreground': 'oklch(0.985 0 0)',
  primary: 'oklch(0.922 0 0)',
  'primary-foreground': 'oklch(0.205 0 0)',
  secondary: 'oklch(0.269 0 0)',
  'secondary-foreground': 'oklch(0.985 0 0)',
  muted: 'oklch(0.269 0 0)',
  'muted-foreground': 'oklch(0.708 0 0)',
  accent: 'oklch(0.269 0 0)',
  'accent-foreground': 'oklch(0.985 0 0)',
  destructive: 'oklch(0.704 0.191 22.216)',
  border: 'oklch(1 0 0 / 10%)',
  input: 'oklch(1 0 0 / 40%)',
  ring: 'oklch(0.556 0 0)',
  'chart-1': '#d4d4d4',
  'chart-2': '#737373',
  'chart-3': '#525252',
  'chart-4': '#404040',
  'chart-5': '#262626',
  radius: '0.625rem',
  sidebar: 'oklch(0.205 0 0)',
  'sidebar-foreground': 'oklch(0.985 0 0)',
  'sidebar-primary': 'oklch(0.488 0.243 264.376)',
  'sidebar-primary-foreground': 'oklch(0.985 0 0)',
  'sidebar-accent': 'oklch(0.269 0 0)',
  'sidebar-accent-foreground': 'oklch(0.985 0 0)',
  'sidebar-border': 'oklch(1 0 0 / 10%)',
  'sidebar-ring': 'oklch(0.556 0 0)',
}

/**
 * The chart series palette, slot by slot — the snapshot's `--chart-1` …
 * `--chart-5` as six-digit hex, the spelling `deriveOptionChipColors` parses
 * and `Chart Palette Drift` compares.
 */
export const DEFAULT_CHART_COLORS: Readonly<Record<string, string>> = {
  'chart-1': '#d4d4d4',
  'chart-2': '#737373',
  'chart-3': '#525252',
  'chart-4': '#404040',
  'chart-5': '#262626',
}

/**
 * `design.colors` key → the shadcn/ui variable it repaints. Each shadcn
 * colour name maps to itself; a Sovrium author key with a shadcn twin maps to
 * the twin (`background-raised` → `card`).
 */
export const DESIGN_COLOR_VARS: Readonly<Record<string, string>> = {
  primary: 'primary',
  'primary-foreground': 'primary-foreground',
  background: 'background',
  'background-subtle': 'muted',
  'background-raised': 'card',
  'background-overlay': 'popover',
  foreground: 'foreground',
  'foreground-muted': 'muted-foreground',
  muted: 'muted',
  'muted-foreground': 'muted-foreground',
  card: 'card',
  popover: 'popover',
  border: 'border',
  ring: 'ring',
  error: 'destructive',
  destructive: 'destructive',
  'chart-1': 'chart-1',
  'chart-2': 'chart-2',
  'chart-3': 'chart-3',
  'chart-4': 'chart-4',
  'chart-5': 'chart-5',
  'card-foreground': 'card-foreground',
  'popover-foreground': 'popover-foreground',
  secondary: 'secondary',
  'secondary-foreground': 'secondary-foreground',
  accent: 'accent',
  'accent-foreground': 'accent-foreground',
  input: 'input',
  sidebar: 'sidebar',
  'sidebar-foreground': 'sidebar-foreground',
  'sidebar-primary': 'sidebar-primary',
  'sidebar-primary-foreground': 'sidebar-primary-foreground',
  'sidebar-accent': 'sidebar-accent',
  'sidebar-accent-foreground': 'sidebar-accent-foreground',
  'sidebar-border': 'sidebar-border',
  'sidebar-ring': 'sidebar-ring',
}

/**
 * The tokens whose ISLAND fallback literal deliberately differs from what the
 * layer's own `var()` chain resolves to — each one an explicit
 * `islandFallback` in the design source.
 *
 * This is the frozen set, on the `eslint-suppressions.json` precedent: it is
 * what lets `Design Token Drift` tolerate the nineteen measured divergences
 * while failing on the twentieth. Without it a value mismatch and a declared
 * exception are indistinguishable, and the gate reports both and passes both.
 */
export const DEFAULT_ISLAND_FALLBACKS: Readonly<Record<string, string>> = {
  'error-solid-fg': 'oklch(0.985 0.003 75)',
  'info-bg': 'oklch(0.925 0 0)',
  'info-fg': 'oklch(0.45 0 0)',
  'success-bg': 'oklch(0.925 0 0)',
  'success-fg': 'oklch(0.45 0 0)',
  'success-solid': 'oklch(0.45 0 0)',
  'warning-fg': 'oklch(0.45 0 0)',
  'warning-solid': 'oklch(0.72 0 0)',
  'warning-solid-fg': 'oklch(0.27 0 0)',
}

/**
 * Every non-colour scale token and its literal, under the `--<name>` spelling
 * the `@theme` block registers. The companion to
 * {@link DEFAULT_SV_LIGHT_VALUES}: together they cover every value the island
 * catalogue mirrors, which is what lets `Design Token Drift` compare the WHOLE
 * catalogue instead of just its colour half.
 */
export const DEFAULT_SCALE_VALUES: Readonly<Record<string, string>> = {
  'duration-base': '180ms',
  'duration-fast': '120ms',
  'duration-slow': '260ms',
  'ease-default': 'cubic-bezier(0.2, 0, 0, 1)',
  'ease-enter': 'cubic-bezier(0, 0, 0.2, 1)',
  'ease-exit': 'cubic-bezier(0.4, 0, 1, 1)',
  'font-display': 'var(--font-sans)',
  'font-mono': "'Geist Mono Variable', monospace",
  'font-sans': "'Geist Variable', sans-serif",
  'font-weight-bold': '700',
  'font-weight-medium': '500',
  'font-weight-regular': '400',
  'font-weight-semibold': '600',
  'letter-spacing-caps': '0.04em',
  'letter-spacing-normal': '0',
  'letter-spacing-tight': '-0.012em',
  'letter-spacing-tighter': '-0.022em',
  'letter-spacing-wide': '0.02em',
  'line-height-none': '1',
  'line-height-normal': '1.55',
  'line-height-relaxed': '1.7',
  'line-height-snug': '1.25',
  'line-height-tight': '1.1',
  'radius-2xl': '1.125rem',
  'radius-3xl': '1.375rem',
  'radius-4xl': '1.625rem',
  'radius-base': '4px',
  'radius-full': '9999px',
  'radius-lg': '0.625rem',
  'radius-md': '0.5rem',
  'radius-none': '0px',
  'radius-sm': '0.375rem',
  'radius-xl': '0.875rem',
  'shadow-lg': '0 8px 24px rgb(0 0 0 / 0.12)',
  'shadow-md': '0 4px 12px rgb(0 0 0 / 0.06)',
  'shadow-none': 'none',
  'shadow-sm': '0 1px 2px rgb(0 0 0 / 0.08)',
  'spacing-0': '0px',
  'spacing-0-5': '0.125rem',
  'spacing-1': '0.25rem',
  'spacing-1-5': '0.375rem',
  'spacing-10': '2.5rem',
  'spacing-12': '3rem',
  'spacing-16': '4rem',
  'spacing-2': '0.5rem',
  'spacing-2-5': '0.625rem',
  'spacing-20': '5rem',
  'spacing-24': '6rem',
  'spacing-3': '0.75rem',
  'spacing-32': '8rem',
  'spacing-4': '1rem',
  'spacing-5': '1.25rem',
  'spacing-6': '1.5rem',
  'spacing-8': '2rem',
  'spacing-px': '1px',
  'text-2xl': '1.25rem',
  'text-2xl--line-height': 'calc(1.75 / 1.25)',
  'text-2xs': '0.625rem',
  'text-2xs--line-height': 'calc(0.875 / 0.625)',
  'text-3xl': '1.5rem',
  'text-3xl--line-height': 'calc(2 / 1.5)',
  'text-4xl': '1.875rem',
  'text-4xl--line-height': 'calc(2.25 / 1.875)',
  'text-5xl': '2.5rem',
  'text-5xl--line-height': '1',
  'text-6xl': '3rem',
  'text-6xl--line-height': '1',
  'text-base': '0.8125rem',
  'text-base--line-height': 'calc(1.25 / 0.8125)',
  'text-lg': '1rem',
  'text-lg--line-height': 'calc(1.5 / 1)',
  'text-md': '0.875rem',
  'text-md--line-height': 'calc(1.375 / 0.875)',
  'text-sm': '0.75rem',
  'text-sm--line-height': 'calc(1.125 / 0.75)',
  'text-xl': '1.125rem',
  'text-xl--line-height': 'calc(1.75 / 1.125)',
  'text-xs': '0.6875rem',
  'text-xs--line-height': 'calc(1 / 0.6875)',
}

/**
 * The author-key -> Sovrium EXTENSION-token map: a `design.colors` key with
 * no shadcn twin and the `--sv-*` role it repaints (`primary-hover`,
 * `success`, `destructive-foreground` …). It is no longer an alias bridge:
 * a key with a shadcn twin repaints the shadcn variable through
 * {@link DESIGN_COLOR_VARS}, and the `--sv-*` alias layer left in P10
 * (plan §6.5). Keep it a plain inline object literal, which is what the gates
 * that read it parse.
 */
export const COLOR_TO_SV_TOKEN: Readonly<Record<string, string>> = {
  'primary-hover': 'primary-hover',
  'primary-active': 'primary-active',
  'primary-subtle': 'primary-subtle',
  'primary-subtle-foreground': 'primary-subtle-fg',
  'background-inset': 'bg-inset',
  'foreground-subtle': 'fg-subtle',
  'foreground-disabled': 'fg-disabled',
  'foreground-inverse': 'fg-inverse',
  success: 'success-solid',
  warning: 'warning-solid',
  'destructive-foreground': 'error-solid-fg',
  info: 'info-solid',
}

/** The colour roles the console publishes, in order. */
export const DEFAULT_COLOR_ROLE_NAMES: readonly string[] = [
  'background',
  'background-subtle',
  'background-raised',
  'background-overlay',
  'background-inset',
  'foreground',
  'foreground-muted',
  'foreground-subtle',
  'foreground-disabled',
  'foreground-inverse',
  'border',
  'ring',
  'primary',
  'primary-hover',
  'primary-active',
  'primary-foreground',
  'primary-subtle',
  'primary-subtle-foreground',
  'success',
  'warning',
  'error',
  'info',
]
