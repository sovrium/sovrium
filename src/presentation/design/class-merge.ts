/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `cn()` — the per-instance class-override primitive for prebuilt components.
 *
 * Lives in `presentation/utils/` rather than beside the islands that were its
 * first callers because an island is only HALF of what a reader sees: every
 * island also ships an SSR placeholder in
 * `ui/sections/rendering/component-registry/`, and that placeholder has to
 * resolve an author `className` against its own defaults the SAME way, or the
 * page paints one layout and then snaps to another when the island mounts
 * `presentation-component` cannot import
 * `presentation-island`, so a shared merge instance can only live in
 * `presentation-util` — and a SECOND `extendTailwindMerge` instance would be a
 * second source of truth for which classes conflict, which is exactly the bug
 * this primitive exists to prevent.
 *
 * Components render with canonical role-token classes by default (`bg-primary`,
 * `text-foreground`, `border-border`, …). An app author can pass a `className` on a
 * component instance to override those — but a naive string concatenation
 * (`base + ' ' + className`) leaves BOTH classes in the list, and the later one
 * only wins by CSS source order, which is fragile. `cn()` runs the merged class
 * list through `tailwind-merge` so the LAST class in a conflict group wins and
 * the loser is dropped entirely:
 *
 *   cn('bg-primary', 'bg-emerald-600') === 'bg-emerald-600'
 *
 * Sovrium's canonical role tokens (`bg-background`, `bg-destructive`, `text-muted-foreground`,
 * `ring-ring`, …) are not part of tailwind-merge's built-in palette
 * patterns, so they are registered here into the right conflict groups via
 * `extendTailwindMerge`. State-prefixed variants (`data-[*]:bg-*`, `hover:…`)
 * are handled automatically by tailwind-merge's variant parsing.
 */

import { extendTailwindMerge } from 'tailwind-merge'

/** Canonical `bg-*` role utilities (background-color conflict group). */
const CANONICAL_BG = [
  'bg-background',
  'bg-muted',
  'bg-card',
  'bg-popover',
  'bg-foreground',
  'bg-border',
  'bg-border-strong',
  'bg-primary',
  'bg-primary-hover',
  'bg-primary-active',
  'bg-primary-subtle',
  'bg-ring',
  'bg-success-bg',
  'bg-success-solid',
  'bg-warning-bg',
  'bg-warning-solid',
  'bg-error-bg',
  'bg-destructive',
  'bg-info-bg',
  'bg-info-solid',
] as const

/** Canonical `text-*` role utilities (text-color conflict group). */
const CANONICAL_TEXT = [
  'text-background',
  'text-popover',
  'text-foreground',
  'text-muted-foreground',
  'text-foreground-subtle',
  'text-foreground-disabled',
  'text-foreground-inverse',
  'text-foreground-humane',
  'text-primary',
  'text-primary-foreground',
  'text-primary-subtle-fg',
  'text-success-fg',
  'text-success-solid-fg',
  'text-warning-fg',
  'text-warning-solid-fg',
  'text-error-fg',
  'text-error-solid-fg',
  'text-info-fg',
  'text-info-solid-fg',
] as const

/** Canonical `border-*` role utilities (border-color conflict group). */
const CANONICAL_BORDER = [
  'border-border',
  'border-border-strong',
  'border-border-inverse',
  'border-primary',
  'border-ring',
  'border-success-border',
  'border-warning-border',
  'border-error-border',
  'border-info-border',
] as const

/**
 * The `text-<step>` utilities of `design.typeScale.steps` (font-size conflict
 * group). Unregistered, tailwind-merge reads `text-h1` as a text COLOUR, so a
 * `text-foreground` beside it evicted the step. The step names are a closed
 * vocabulary (`TYPE_SCALE_STEPS`); they are matched here rather than imported
 * because this module ships in the island bundle, and the unit test holds the
 * two together. A step the app did not declare emits no CSS, so matching every
 * name changes nothing for it.
 */
const isTypeScaleStep = (value: string): boolean =>
  /^(display|h[1-6]|lead|body(Small)?|caption|overline)$/.test(value)

/** Canonical `ring-*` role utilities (ring-color conflict group). */
const CANONICAL_RING = ['ring-ring'] as const

/**
 * tailwind-merge instance extended with Sovrium's canonical role tokens. Each
 * token is registered into its color conflict group so a later token (or a
 * built-in palette class) in the same group wins.
 */
const twMergeCanonical = extendTailwindMerge({
  extend: {
    classGroups: {
      'bg-color': [...CANONICAL_BG],
      'text-color': [...CANONICAL_TEXT],
      'border-color': [...CANONICAL_BORDER],
      'ring-color': [...CANONICAL_RING],
      'font-size': [{ text: [isTypeScaleStep] }],
    },
  },
})

/**
 * Merge class-name fragments, resolving Tailwind conflicts (including Sovrium's
 * canonical role tokens) so the last class in each conflict group wins.
 *
 * Falsy fragments are ignored, so conditional usage is ergonomic:
 *
 *   cn('bg-primary', isActive && 'bg-success-solid', className)
 *
 * @param classes - Class-name fragments (strings or falsy values).
 * @returns A merged, de-conflicted class string.
 * @public Consumed by prebuilt islands' `className` override path (Phase 1+).
 */
export const cn = (...classes: ReadonlyArray<string | false | null | undefined>): string =>
  twMergeCanonical(classes.filter((c): c is string => typeof c === 'string' && c.length > 0))
