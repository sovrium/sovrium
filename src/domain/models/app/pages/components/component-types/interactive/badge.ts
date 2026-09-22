/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BadgeVariantSchema } from '../../shared-schemas'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { interactionFields } from '../modules/interaction'
import { visibilityFields } from '../modules/visibility'

export const BadgeTypeLiteral = Schema.Literal('badge')

/**
 * Badge mode selector — opts the badge into specialized rendering modes.
 *
 * Distinct from `badgeVariant` (visual style: default/secondary/destructive/outline).
 * `variant: 'status'` enables status-indicator rendering: a colored dot plus a
 * text label, with an optional pulsing animation. This merges the formerly
 * separate `status-indicator` component into badge per the merged user-story.
 */
export const BadgeModeSchema = Schema.Literals(['status', 'contrast']).annotate({
  title: 'Badge Mode',
  description:
    "Specialized rendering mode: 'status' (a status indicator — coloured dot plus label) or 'contrast' (the WCAG ratio between two colours, and the verdict on it)",
})

/** The two WCAG levels a design token is meaningfully held to. */
export const ContrastThresholdSchema = Schema.Literals(['AA', 'AAA']).annotate({
  title: 'Contrast Threshold',
  description:
    "WCAG level to grade against at normal body-text size: 'AA' (4.5:1, the default) or 'AAA' (7:1). The lenient large-text bars are not offered — a token is used at whatever size an author reaches for.",
})

/**
 * Status dot color palette — short token names that map to design-system v1
 * semantic tokens at render time. Limited to a small, theme-friendly set so
 * the renderer can resolve each value to a CSS variable without arbitrary
 * color inputs.
 */
export const StatusDotColorSchema = Schema.Literals([
  'green',
  'red',
  'amber',
  'yellow',
  'blue',
  'gray',
]).annotate({
  title: 'Status Dot Color',
  description: 'Color token for the status-indicator dot',
})

export const badgeFields = {
  ...coreFields,
  ...contentFields,
  ...interactionFields,
  ...visibilityFields,
  ...i18nFields,
  badgeVariant: Schema.optional(BadgeVariantSchema),
  /**
   * Specialized rendering mode. When set to `'status'`, the badge renders
   * the status-indicator UI (colored dot + label, optional pulse).
   */
  variant: Schema.optional(BadgeModeSchema),
  /**
   * The ink being measured. Required in practice under `variant: 'contrast'`;
   * the badge reports `unresolved` rather than guessing when it is absent.
   *
   * Optional in the SCHEMA because the three modes share one open struct and
   * `buildComponentUnion` has no per-branch refinement hook, so "required only
   * under this variant" is not expressible here.
   */
  foreground: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        title: 'Foreground',
        description:
          'The ink being measured under variant: contrast — a token name or a literal colour (hex, `rgb()`, `oklch()`, `white`, `black`)',
        examples: ['--sv-color-foreground', '#6b7f5e'],
      })
    )
  ),
  /** The ground the ink sits on, in the same forms. Read under `variant: 'contrast'`. */
  background: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        title: 'Background',
        description:
          'The ground the ink sits on under variant: contrast, in the same forms as `foreground`',
        examples: ['--sv-color-background', 'white'],
      })
    )
  ),
  /** Which bar to grade against. Defaults to AA. Read under `variant: 'contrast'`. */
  threshold: Schema.optional(ContrastThresholdSchema),
  /**
   * Status label text displayed next to the colored dot.
   * Only applies when `variant === 'status'`.
   */
  status: Schema.optional(
    Schema.String.annotate({
      description: 'Status label text displayed next to the dot (variant: status)',
    })
  ),
  /**
   * Color of the status dot. Maps to a design-system v1 semantic *solid*
   * token at render time (e.g. `green` → `--color-success-solid`, `red` →
   * `--color-error-solid`). Only applies when `variant === 'status'`.
   */
  statusColor: Schema.optional(StatusDotColorSchema),
  /**
   * When `true`, the status dot pulses to draw attention to active/live
   * statuses. Only applies when `variant === 'status'`.
   */
  pulse: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Enable pulsing animation on the status dot (variant: status)',
    })
  ),
} as const
