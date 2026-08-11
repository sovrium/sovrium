/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default className builders for the `link` and `icon` schema
 * dispatchers. Lives in a sibling file rather than inlined into
 * `interactive-components.ts` because that file already brushes against the
 * 400-line `max-lines` cap; extracting these builders keeps the dispatcher
 * itself focused on the registry shape (one `case 'link': …` arrow per
 * component-type) and lets the prestyle wiring grow without forcing the
 * dispatcher to host its own `Set<...>` vocabularies + per-component class
 * resolution.
 *
 * The shape mirrors the existing `buildButtonClassName` / `buildBadgeClassName`
 * / `buildAlertClassName` helpers that already live inside
 * `interactive-components.ts` — same `(componentRaw, authorClassName) =>
 * mergedClassName` signature, same "schema vocabulary → typed enum → helper
 * call" flow. Two helpers (link + icon) hit the threshold where extraction
 * pays off; status-badge / breadcrumb / pagination stay inlined where their
 * dispatchers live because they don't have shared vocabulary sets.
 */

import { type ButtonVariant } from '../../renderers/element-renderers/recipes/button-default-classes'
import {
  computeIconClasses,
  computeLinkClasses,
  type IconSize,
  type IconTone,
  type LinkVariant,
} from '../../renderers/element-renderers/recipes/interactive-content-default-classes'

/**
 * Legacy `.btn-{variant}` className tokens → schema `ButtonVariant`. The legacy
 * component-layer rule (`.btn-destructive { background: var(--color-error-solid) }`)
 * lives in `@layer components`, but the prestyled-by-default variant utility
 * (`bg-[var(--sv-…)]`) lands in `@layer utilities`, which wins the cascade in
 * Tailwind v4 (`theme, base, components, utilities`). So an author who styles a
 * button purely via `className: 'btn btn-destructive'` (no `variant` field)
 * would otherwise get the `default` prestyle (`--sv-primary`) painted OVER the
 * legacy destructive rule. Deriving the variant from the className token keeps
 * the prestyled channel and the legacy class in agreement. `btn-primary` maps
 * to `default` (primary IS the default tone in this system).
 */
const BTN_CLASS_TO_VARIANT: Record<string, ButtonVariant> = {
  'btn-primary': 'default',
  'btn-destructive': 'destructive',
  'btn-outline': 'outline',
  'btn-secondary': 'secondary',
  'btn-ghost': 'ghost',
  'btn-link': 'link',
  'btn-fab': 'fab',
}

/**
 * Derive a button variant from a legacy `.btn-{variant}` token in the
 * author-supplied className. Returns `undefined` when no token matches so the
 * caller falls through to the schema `variant` field (or the `default` tone).
 */
export const variantFromButtonClassName = (
  authorClassName: string | undefined
): ButtonVariant | undefined => {
  if (!authorClassName) return undefined
  return authorClassName
    .split(/\s+/)
    .map((token) => BTN_CLASS_TO_VARIANT[token])
    .find((variant) => variant !== undefined)
}

const LINK_VARIANTS = new Set<LinkVariant>(['default', 'subtle', 'destructive'])
const ICON_SIZES = new Set<IconSize>(['sm', 'md', 'lg', 'xl'])
const ICON_TONES = new Set<IconTone>(['default', 'muted', 'primary'])

/**
 * Append the author's `className` LAST so it wins at the Tailwind cascade.
 * Shared across the component-registry renderers (media / display / structural
 * / interactive) — the single canonical prestyle-merge.
 */
export const mergePrestyle = (defaults: string, authorClassName: string | undefined): string =>
  authorClassName ? `${defaults} ${authorClassName}` : defaults

/**
 * Build the merged className for a `link` component. Validates the schema's
 * `variant` field against the prestyled vocabulary; unknown values fall back
 * to `computeLinkClasses`' own `'default'` so a typo doesn't crash.
 */
export const buildLinkClassName = (
  componentRaw: Record<string, unknown>,
  authorClassName: string | undefined
): string => {
  const rawVariant = componentRaw['variant']
  const variant = LINK_VARIANTS.has(rawVariant as LinkVariant)
    ? (rawVariant as LinkVariant)
    : undefined
  return mergePrestyle(computeLinkClasses(variant ? { variant } : {}), authorClassName)
}

/**
 * Build the merged className for an `icon` component. Validates `iconSize`
 * and `tone` against the prestyled vocabularies; unknown values fall back
 * to `computeIconClasses`' own defaults (`md` / `default`).
 *
 * Numeric `props.size` still wins at the cascade — Lucide forwards it as
 * inline `width`/`height` attributes on the SVG, which beat the
 * `w-* h-*` Tailwind classes painted here.
 */
export const buildIconClassName = (
  componentRaw: Record<string, unknown>,
  authorClassName: string | undefined
): string => {
  const rawSize = componentRaw['iconSize']
  const rawTone = componentRaw['tone']
  const size = ICON_SIZES.has(rawSize as IconSize) ? (rawSize as IconSize) : undefined
  const tone = ICON_TONES.has(rawTone as IconTone) ? (rawTone as IconTone) : undefined
  return mergePrestyle(
    computeIconClasses({ ...(size ? { size } : {}), ...(tone ? { tone } : {}) }),
    authorClassName
  )
}
