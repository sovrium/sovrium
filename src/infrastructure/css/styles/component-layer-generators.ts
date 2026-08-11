/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { generateClickAnimationCSS } from '@/infrastructure/css/styles/click-animations'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Component-layer class builders.
 *
 * The always-present default token layer (`default-theme-layer.ts`, injected by
 * `compiler.ts`) guarantees every canonical role token (`bg`, `fg`, `primary`,
 * `border`, `error-*`, …) is defined — with light/dark values, and recolored by
 * author `theme.colors` via the alias bridge. So these builders emit canonical
 * token classes UNCONDITIONALLY; the old literal-color fallback branches
 * (`bg-blue-600`, `border-gray-200`, …) are dead and have been removed.
 *
 * The `theme` parameter is retained where it still drives non-color decisions
 * (e.g. badge border-radius), but color tokens no longer gate on it.
 */

/**
 * Build button classes (always uses the canonical primary token).
 *
 * @returns Array of CSS class names for button elements
 */
export function buildButtonClasses(): readonly string[] {
  return [
    'inline-flex',
    'items-center',
    'justify-center',
    'rounded-md',
    'px-4',
    'py-2',
    'font-medium',
    'transition-colors',
    'bg-primary',
    'text-primary-fg',
    'hover:bg-primary-hover',
  ]
}

/**
 * Build button primary utility classes (canonical primary token).
 *
 * @returns CSS class string for primary button variant
 */
export function buildButtonPrimaryClasses(): string {
  return 'bg-primary text-primary-fg hover:bg-primary-hover'
}

/**
 * Build badge border-radius based on theme configuration
 * Uses theme.borderRadius.full if defined, otherwise falls back to rounded-full
 *
 * @param theme - Optional theme configuration
 * @returns CSS rule for badge border-radius
 */
export function buildBadgeBorderRadius(theme?: Theme): string {
  const hasFullRadius = Boolean(theme?.borderRadius?.full)
  return hasFullRadius ? 'border-radius: var(--radius-full);' : '@apply rounded-full;'
}

/**
 * Build card component classes (canonical raised-surface tokens).
 *
 * @returns CSS class string for .card
 */
export function buildCardClasses(): string {
  return 'rounded-lg border border-border bg-background-raised text-foreground p-6 shadow-sm'
}

/**
 * Build badge component classes (canonical subtle-surface tokens).
 *
 * @returns CSS class string for .badge (excluding border-radius)
 */
export function buildBadgeClasses(): string {
  return 'border border-border bg-background-subtle text-foreground-muted px-2 py-1 text-xs font-medium'
}

/**
 * Build input element classes — the Notion / Airtable-grade DEFAULT for every
 * `<input>` / `<select>` / `<textarea>` across every Sovrium business app AND
 * the admin console. Emitted ONCE under `@layer components` (see
 * {@link generateLayoutRules}), so any form gets polished controls with zero
 * per-app config — the dogfood win — while staying 100% overridable (author
 * `className` and `app.theme.*` tokens still win at the cascade).
 *
 * Beyond the bare surface/border/focus tokens, this paints the chrome bare
 * inputs were missing: a calm rounded shape (`rounded-md`), comfortable
 * padding + a consistent control height (`px-3 py-2 text-sm leading-tight`),
 * full-width so controls fill their field column, a quiet muted placeholder, a
 * smooth focus transition, a clear focus ring with a tightened border, and a
 * legible disabled state. Color goes through canonical role tokens only —
 * never raw colors — so theme overrides win.
 *
 * @returns CSS class string for input/select/textarea base styles
 */
export function buildInputClasses(): string {
  return [
    'block',
    'w-full',
    'rounded-md',
    'border',
    'border-border',
    'bg-background',
    'px-3',
    'py-2',
    'text-sm',
    'leading-tight',
    'text-foreground',
    'placeholder:text-foreground-subtle',
    'transition-colors',
    'focus:border-focus-ring',
    'focus:ring-2',
    'focus:ring-focus-ring',
    'focus:ring-offset-2',
    'focus:outline-none',
    'disabled:cursor-not-allowed',
    'disabled:opacity-60',
  ].join(' ')
}

/**
 * Build modal component classes (canonical overlay/surface tokens).
 *
 * @returns Object with overlay and content CSS class strings
 */
export function buildModalClasses(): {
  readonly overlay: string
  readonly content: string
} {
  return {
    overlay: 'fixed inset-0 bg-scrim/50 backdrop-blur-sm',
    content: 'bg-background-overlay text-foreground border border-border rounded-lg shadow-lg',
  }
}

/**
 * Build alert variant classes (canonical semantic bg/fg/border tokens).
 *
 * @returns Object with CSS class strings per alert variant
 */
export function buildAlertClasses(): {
  readonly info: string
  readonly warning: string
  readonly error: string
  readonly success: string
} {
  return {
    info: 'bg-info-bg text-info-fg border border-info-border',
    warning: 'bg-warning-bg text-warning-fg border border-warning-border',
    error: 'bg-error-bg text-error-fg border border-error-border',
    success: 'bg-success-bg text-success-fg border border-success-border',
  }
}

/**
 * Build toast component classes (canonical raised-surface tokens).
 *
 * @returns CSS class string for .toast
 */
export function buildToastClasses(): string {
  return 'bg-background-raised text-foreground border border-border shadow-lg rounded-lg p-4'
}

/**
 * Build navigation component classes (canonical surface/border tokens).
 *
 * @returns CSS class string for .nav
 */
export function buildNavClasses(): string {
  return 'bg-background border-b border-border'
}

/**
 * Build sidebar component classes (canonical raised-surface/border tokens).
 *
 * @returns CSS class string for .sidebar
 */
export function buildSidebarClasses(): string {
  return 'bg-background-raised border-r border-border'
}

/**
 * Build data table component classes (canonical subtle-surface tokens).
 *
 * @returns Object with header and row hover CSS class strings
 */
export function buildDataTableClasses(): {
  readonly header: string
  readonly rowHover: string
} {
  return {
    header: 'bg-background-subtle text-foreground-muted',
    rowHover: 'bg-background-subtle/50',
  }
}

/**
 * Build button variant classes (canonical tokens).
 *
 * @returns Object with CSS class strings per button variant
 */
export function buildButtonVariantClasses(): {
  readonly secondary: string
  readonly destructive: string
  readonly outline: string
  readonly ghost: string
  readonly link: string
  readonly fab: string
} {
  return {
    secondary: 'bg-primary-subtle text-primary-subtle-fg hover:bg-primary-subtle/80',
    destructive: 'bg-error-solid text-error-solid-fg hover:bg-error-solid/90',
    outline:
      'border border-border bg-background hover:bg-background-subtle hover:text-foreground-muted',
    ghost: 'bg-transparent text-foreground hover:bg-background-subtle hover:text-foreground-muted',
    link: 'text-primary underline-offset-4 hover:underline',
    fab: 'rounded-full h-14 w-14 p-0 shadow-lg',
  }
}

/**
 * Build badge variant classes (canonical tokens).
 *
 * @returns Object with CSS class strings per badge variant
 */
export function buildBadgeVariantClasses(): {
  readonly secondary: string
  readonly destructive: string
  readonly outline: string
} {
  return {
    secondary: 'bg-primary-subtle text-primary-subtle-fg',
    destructive: 'bg-error-solid text-error-solid-fg',
    outline: 'border border-border text-foreground bg-transparent',
  }
}

/**
 * Generate components layer styles using canonical role tokens.
 * Applies canonical tokens to component classes and button elements
 *
 * @param theme - Optional theme configuration (only drives badge radius)
 * @returns CSS @layer components rule as string
 *
 * @example
 * generateComponentsLayer(theme)
 * // => '@layer components { .container-page { ... } .card { ... } ... }'
 */
function generateButtonAndBadgeRules(): string {
  const btnClasses = buildButtonClasses()
  const btnPrimaryClasses = buildButtonPrimaryClasses()
  const btnVariants = buildButtonVariantClasses()
  const badgeVariants = buildBadgeVariantClasses()

  return `
      .btn { @apply ${btnClasses.join(' ')}; }
      .btn-primary { @apply ${btnPrimaryClasses}; }
      .btn-secondary { @apply ${btnVariants.secondary}; }
      .btn-destructive { @apply ${btnVariants.destructive}; }
      .btn-outline { @apply ${btnVariants.outline}; }
      .btn-ghost { @apply ${btnVariants.ghost}; }
      .btn-link { @apply ${btnVariants.link}; }
      .btn-fab { @apply ${btnVariants.fab}; }
      .btn-sm { @apply py-1 px-3 text-sm; }
      .btn-lg { @apply py-3 px-6; }
      .btn-icon { @apply p-0 h-9 w-9; }
      .badge-secondary { @apply ${badgeVariants.secondary}; }
      .badge-destructive { @apply ${badgeVariants.destructive}; }
      .badge-outline { @apply ${badgeVariants.outline}; }`
}

/**
 * Build the default chrome for STANDALONE form pages (`form-renderer.tsx`):
 * the `.form-page` shell, the `.form-title` / `.form-description` header, and
 * the submit button. These class names were previously decorative (no backing
 * rule), so a standalone form rendered as edge-to-edge bare controls. Emitting
 * real rules here gives every `app.forms[]` form an Airtable/Notion-grade
 * default — a centered card with comfortable padding, a clear title hierarchy,
 * and a real primary submit button — with zero per-form config, while staying
 * fully overridable (author `display.theme` tokens + role tokens win).
 *
 * @returns the `@layer components` rule fragment for the form shell
 */
function buildFormShellRules(): string {
  return `
      .form-page {
        @apply mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 md:py-16;
      }
      .form-page > form {
        @apply rounded-lg border border-border bg-background-raised p-6 shadow-sm sm:p-8;
      }
      .form-title {
        @apply text-foreground text-3xl font-semibold tracking-tight;
      }
      .form-description {
        @apply text-foreground-muted max-w-prose text-base leading-relaxed;
      }
      /* The negative top margin tightens the title→description pair against the
         standalone shell's \`gap-6\` flex rhythm. It is scoped to \`.form-page\`
         so it applies ONLY on the standalone form page — an embedded/dialog form
         body (rendered WITHOUT the \`.form-page\` shell) keeps normal, non-cramped
         title→description spacing instead of pulling the description up under the
         title. */
      .form-page .form-description {
        @apply -mt-3;
      }
      .form-group-label {
        @apply text-foreground border-border border-b pb-2 text-base font-semibold;
      }`
}

function generateLayoutRules(): string {
  const modalClasses = buildModalClasses()
  const alertClasses = buildAlertClasses()
  const dataTableClasses = buildDataTableClasses()

  return `
      input, select, textarea { @apply ${buildInputClasses()}; }
      .modal-overlay { @apply ${modalClasses.overlay}; }
      .modal-content { @apply ${modalClasses.content}; }
      .toast { @apply ${buildToastClasses()}; }
      .nav { @apply ${buildNavClasses()}; }
      .sidebar { @apply ${buildSidebarClasses()}; }
      .alert-info { @apply ${alertClasses.info}; }
      .alert-warning { @apply ${alertClasses.warning}; }
      .alert-error { @apply ${alertClasses.error}; }
      .alert-success { @apply ${alertClasses.success}; }
      .data-table th { @apply ${dataTableClasses.header}; }
      .data-table tbody tr:hover { @apply ${dataTableClasses.rowHover}; }
${buildFormShellRules()}`
}

export function generateComponentsLayer(theme?: Theme): string {
  return `@layer components {
      .container-page { @apply mx-auto max-w-4xl px-4 py-8; }
      .card { @apply ${buildCardClasses()}; }
      .badge { @apply ${buildBadgeClasses()}; ${buildBadgeBorderRadius(theme)} }
${generateButtonAndBadgeRules()}
${generateLayoutRules()}
    }`
}

/**
 * Generate utilities layer styles
 * Combines static utilities with click interaction animations
 *
 * @returns CSS @layer utilities rule as string
 *
 * @example
 * generateUtilitiesLayer()
 * // => '@layer utilities { .text-balance { ... } ... }'
 */
export function generateUtilitiesLayer(): string {
  const clickAnimations = generateClickAnimationCSS()

  return `@layer utilities {
      .text-balance {
        text-wrap: balance;
      }

      /* Safelist: Ensure critical utility classes are always included */
      .text-center {
        text-align: center;
      }

      /* Override Tailwind v4's multi-layer shadow system for shadow-none */
      .shadow-none {
        box-shadow: none !important;
      }

      ${clickAnimations}
    }`
}
