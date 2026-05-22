/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { extendTailwindMerge } from 'tailwind-merge'

const CANONICAL_BG = [
  'bg-background',
  'bg-background-subtle',
  'bg-background-raised',
  'bg-background-overlay',
  'bg-foreground',
  'bg-border',
  'bg-border-strong',
  'bg-scrim',
  'bg-primary',
  'bg-primary-hover',
  'bg-primary-active',
  'bg-primary-subtle',
  'bg-focus-ring',
  'bg-warmth',
  'bg-warmth-subtle',
  'bg-success-bg',
  'bg-success-solid',
  'bg-warning-bg',
  'bg-warning-solid',
  'bg-error-bg',
  'bg-error-solid',
  'bg-info-bg',
  'bg-info-solid',
] as const

const CANONICAL_TEXT = [
  'text-background',
  'text-background-overlay',
  'text-foreground',
  'text-foreground-muted',
  'text-foreground-subtle',
  'text-foreground-disabled',
  'text-foreground-inverse',
  'text-foreground-humane',
  'text-primary',
  'text-primary-fg',
  'text-primary-subtle-fg',
  'text-warmth',
  'text-warmth-fg',
  'text-success-fg',
  'text-success-solid-fg',
  'text-warning-fg',
  'text-warning-solid-fg',
  'text-error-fg',
  'text-error-solid-fg',
  'text-info-fg',
  'text-info-solid-fg',
] as const

const CANONICAL_BORDER = [
  'border-border',
  'border-border-strong',
  'border-border-inverse',
  'border-primary',
  'border-focus-ring',
  'border-warmth-border',
  'border-success-border',
  'border-warning-border',
  'border-error-border',
  'border-info-border',
] as const

const CANONICAL_RING = ['ring-focus-ring'] as const

const twMergeCanonical = extendTailwindMerge({
  extend: {
    classGroups: {
      'bg-color': [...CANONICAL_BG],
      'text-color': [...CANONICAL_TEXT],
      'border-color': [...CANONICAL_BORDER],
      'ring-color': [...CANONICAL_RING],
    },
  },
})

export const cn = (...classes: ReadonlyArray<string | false | null | undefined>): string =>
  twMergeCanonical(classes.filter((c): c is string => typeof c === 'string' && c.length > 0))
