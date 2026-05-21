/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { generateClickAnimationCSS } from '@/infrastructure/css/styles/click-animations'
import type { Theme } from '@/domain/models/app/theme'


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

export function buildButtonPrimaryClasses(): string {
  return 'bg-primary text-primary-fg hover:bg-primary-hover'
}

export function buildBadgeBorderRadius(theme?: Theme): string {
  const hasFullRadius = Boolean(theme?.borderRadius?.full)
  return hasFullRadius ? 'border-radius: var(--radius-full);' : '@apply rounded-full;'
}

export function buildCardClasses(): string {
  return 'rounded-lg border border-border bg-bg-raised text-fg p-6 shadow-sm'
}

export function buildBadgeClasses(): string {
  return 'border border-border bg-bg-subtle text-fg-muted px-2 py-1 text-xs font-medium'
}

export function buildInputClasses(): string {
  return 'border border-border bg-bg text-fg focus:ring-2 focus:ring-focus-ring focus:ring-offset-2'
}

export function buildModalClasses(): {
  readonly overlay: string
  readonly content: string
} {
  return {
    overlay: 'fixed inset-0 bg-scrim/50 backdrop-blur-sm',
    content: 'bg-bg-overlay text-fg border border-border rounded-lg shadow-lg',
  }
}

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

export function buildToastClasses(): string {
  return 'bg-bg-raised text-fg border border-border shadow-lg rounded-lg p-4'
}

export function buildNavClasses(): string {
  return 'bg-bg border-b border-border'
}

export function buildSidebarClasses(): string {
  return 'bg-bg-raised border-r border-border'
}

export function buildDataTableClasses(): {
  readonly header: string
  readonly rowHover: string
} {
  return {
    header: 'bg-bg-subtle text-fg-muted',
    rowHover: 'bg-bg-subtle/50',
  }
}

export function buildButtonVariantClasses(): {
  readonly secondary: string
  readonly destructive: string
  readonly outline: string
  readonly ghost: string
  readonly link: string
} {
  return {
    secondary: 'bg-primary-subtle text-primary-subtle-fg hover:bg-primary-subtle/80',
    destructive: 'bg-error-solid text-error-solid-fg hover:bg-error-solid/90',
    outline: 'border border-border bg-bg hover:bg-bg-subtle hover:text-fg-muted',
    ghost: 'bg-transparent text-fg hover:bg-bg-subtle hover:text-fg-muted',
    link: 'text-primary underline-offset-4 hover:underline',
  }
}

export function buildBadgeVariantClasses(): {
  readonly secondary: string
  readonly destructive: string
  readonly outline: string
} {
  return {
    secondary: 'bg-primary-subtle text-primary-subtle-fg',
    destructive: 'bg-error-solid text-error-solid-fg',
    outline: 'border border-border text-fg bg-transparent',
  }
}

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
      .btn-sm { @apply py-1 px-3 text-sm; }
      .btn-lg { @apply py-3 px-6; }
      .btn-icon { @apply p-0 h-9 w-9; }
      .badge-secondary { @apply ${badgeVariants.secondary}; }
      .badge-destructive { @apply ${badgeVariants.destructive}; }
      .badge-outline { @apply ${badgeVariants.outline}; }`
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
      .data-table tbody tr:hover { @apply ${dataTableClasses.rowHover}; }`
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
