/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the feedback-cluster components
 *: `badge` (default + status mode), `alert`, `skeleton`, and
 * `progress`. Schema authors who write the bare `{ type: 'badge', content:
 * 'New' }`, `{ type: 'alert', alertVariant: 'success', content: 'Saved' }`,
 * `{ type: 'skeleton' }`, or `{ type: 'progress', progressValue: 75 }` get a
 * complete, opinionated feedback surface — semantic tone (info/success/
 * warning/error), pill-rounded chrome, pulse animation, focal accent — with
 * zero theme-layer dependency.
 *
 * The recipe mirrors the buttons + inputs + selects + toggles + numeric +
 * date + overlays + disclosure slices (commits 02b2f35f3 + 571ae53ce +
 * 5527660bc + 000f835d7 + 386e9dc35 + 3d35fad9a + 0de6ded2a + 1b3f551a7).
 * Layout / spacing classes (`inline-flex`, `px-2 py-0.5`, `gap-2`), animation
 * classes (`animate-pulse`, `transition-all duration-200`), and data-state
 * selectors stay as raw Tailwind utilities — they encode behavior, not color
 * — while every color / border / radius / shadow class goes through
 * {@link withVarFallback} so `app.theme.*` overrides still win at the CSS
 * cascade layer (`var(--sv-X)` resolves the override first, falling back to
 * the inline OKLCH literal).
 *
 * Subparts covered:
 *
 *   - BADGE (default)       — pill-rounded label with variant tones (default
 *                             / secondary / destructive / outline)
 *   - BADGE (status mode)   — wrapper + colored status dot inside the badge
 *                             when `variant: 'status'` is set; pulse opt-in
 *   - ALERT                 — inline notification surface with 5 semantic
 *                             tones (default / info / success / warning /
 *                             destructive)
 *   - ALERT ICON            — the leading icon slot in the alert; same tone
 *                             as the alert's foreground
 *   - SKELETON              — loading placeholder block with three shape
 *                             variants (text / circular / rectangular);
 *                             `animate` toggles the `animate-pulse` shimmer
 *   - PROGRESS TRACK        — linear-variant background bar (`bg-bg-subtle`
 *                             tone, full-pill rounded)
 *   - PROGRESS BAR          — linear-variant filled portion (primary tone)
 *   - PROGRESS CIRCLE TRACK — circle-variant ring under-layer (faint border
 *                             tone) painted via SVG `stroke`
 *   - PROGRESS CIRCLE BAR   — circle-variant ring over-layer (primary tone)
 *                             painted via SVG `stroke`
 *   - PROGRESS LABEL        — strong-foreground tone percentage label
 *
 * Helper file lives in `src/presentation/ui/sections/renderers/element-
 * renderers/` (alongside the renderers that consume it) because all of these
 * surfaces are server-rendered as part of the SSR pass — the
 * `presentation-component → presentation-island` layer boundary does not
 * apply since this is purely a same-layer helper. Mirrors the location chosen
 * for `button-default-classes.ts` and `input-default-classes.ts`.
 *
 * The `spinner` schema (in `domain/.../feedback/spinner.ts`) currently
 * renders a no-op `<div>` via `structural-components.tsx` — no meaningful
 * surface to prestyle yet. Deferred to a future slice that wires up the
 * actual SVG / CSS spinner element.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'
// The badge-default slice (`computeBadgeClasses`, `BadgeVariant`, and the shared
// `BADGE_VARIANT_CLASS` / `BADGE_RADIUS` building blocks the status-badge wrapper
// composes) now lives in the cross-boundary navbar recipe so the navigation-menu
// island can render the SAME pill. Re-exported below so
// existing importers of this feedback module are unaffected.
import {
  computeBadgeClasses,
  BADGE_RADIUS,
  BADGE_VARIANT_CLASS,
  type BadgeVariant,
} from '@/presentation/utils/recipes/navbar-default-classes'

export { computeBadgeClasses, type BadgeVariant }

// ──────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ──────────────────────────────────────────────────────────────────────────────

/** Schema-aligned vocabulary for `AlertVariantSchema`. */
export type AlertVariant = 'default' | 'destructive' | 'warning' | 'info' | 'success'

/** Schema-aligned vocabulary for `SkeletonVariantSchema`. */
export type SkeletonVariant = 'text' | 'circular' | 'rectangular'

/** Status-dot color vocabulary (`StatusDotColorSchema`). */
export type StatusDotColor = 'green' | 'red' | 'amber' | 'yellow' | 'blue' | 'gray'

/**
 * Linear progress size vocabulary (`ComponentSizeSchema`).
 *
 * @public Schema-aligned vocabulary type exported alongside its sibling
 * default-class maps for type-safe consumption at renderer call sites.
 */
export type ProgressSize = 'sm' | 'md' | 'lg'

// ──────────────────────────────────────────────────────────────────────────────
// BADGE (status mode) — wrapper + colored dot inside the badge
//
// The default-variant badge slice (`computeBadgeClasses` + `BADGE_VARIANT_CLASS`
// + `BADGE_RADIUS`) moved to `@/presentation/utils/recipes/navbar-default-classes`
// (imported + re-exported at the top of this file) so the navigation-menu island
// can render the same pill. The status-badge wrapper below reuses the imported
// `BADGE_VARIANT_CLASS.secondary` + `BADGE_RADIUS` unchanged.
// ──────────────────────────────────────────────────────────────────────────────

const STATUS_DOT_COLOR_CLASS: Record<StatusDotColor, string> = {
  green: `bg-[${v('sv-success-solid', T.successSolid)}]`,
  red: `bg-[${v('sv-error-solid', T.errorSolid)}]`,
  amber: `bg-[${v('sv-warning-solid', T.warningSolid)}]`,
  yellow: `bg-[${v('sv-warning-solid', T.warningSolid)}]`,
  blue: `bg-[${v('sv-info-solid', T.infoSolid)}]`,
  gray: `bg-[${v('sv-neutral-500', T.neutral500)}]`,
}

/**
 * Compute the default className for the outer wrapper `<span>` of a
 * status-mode badge (`variant: 'status'`). Matches the layout vocabulary the
 * existing `renderStatusBadge` helper uses (`inline-flex items-center gap-1.5`)
 * but ALSO applies the badge's pill-rounded chrome + secondary surface tone so
 * a bare `{ type: 'badge', variant: 'status', status: 'Online' }` renders
 * with the same neutral chip aesthetic as the default badge.
 */
export const computeStatusBadgeWrapperClasses = (): string =>
  [
    'inline-flex items-center gap-1.5',
    'px-2 py-0.5 text-xs font-medium leading-none whitespace-nowrap',
    BADGE_RADIUS,
    BADGE_VARIANT_CLASS.secondary,
  ].join(' ')

/**
 * Compute the default className for the colored dot inside a status-mode
 * badge. The `color` axis maps short tokens (`green` / `red` / `amber` /
 * `yellow` / `blue` / `gray`) onto solid semantic tones via the v1 design-
 * system tokens; the `pulse` axis toggles `animate-pulse` so live statuses
 * draw attention. Dot stays at a fixed 2×2 (`h-2 w-2`) so it reads as a
 * subtle indicator regardless of badge size.
 */
export const computeStatusBadgeDotClasses = ({
  color = 'gray',
  pulse = false,
}: {
  color?: StatusDotColor
  pulse?: boolean
} = {}): string =>
  [
    'inline-block h-2 w-2 rounded-full shrink-0',
    STATUS_DOT_COLOR_CLASS[color],
    pulse ? 'animate-pulse' : '',
  ]
    .filter(Boolean)
    .join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// ALERT — inline notification surface with semantic-tone variants
// ──────────────────────────────────────────────────────────────────────────────

const ALERT_LAYOUT = 'flex items-start gap-3 px-4 py-3 text-sm'

const ALERT_RADIUS = `rounded-[${v('sv-radius-md', T.radiusMd)}]`

const ALERT_VARIANT_CLASS: Record<AlertVariant, string> = {
  default: [
    'border',
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `border-[${v('sv-border', T.border)}]`,
  ].join(' '),
  info: [
    'border',
    `bg-[${v('sv-info-bg', T.infoBg)}]`,
    `text-[${v('sv-info-fg', T.infoFg)}]`,
    `border-[${v('sv-info-border', T.infoBorder)}]`,
  ].join(' '),
  success: [
    'border',
    `bg-[${v('sv-success-bg', T.successBg)}]`,
    `text-[${v('sv-success-fg', T.successFg)}]`,
    `border-[${v('sv-success-border', T.successBorder)}]`,
  ].join(' '),
  warning: [
    'border',
    `bg-[${v('sv-warning-bg', T.warningBg)}]`,
    `text-[${v('sv-warning-fg', T.warningFg)}]`,
    `border-[${v('sv-warning-border', T.warningBorder)}]`,
  ].join(' '),
  destructive: [
    'border',
    `bg-[${v('sv-error-bg', T.errorBg)}]`,
    `text-[${v('sv-error-fg', T.errorFg)}]`,
    `border-[${v('sv-error-border', T.errorBorder)}]`,
  ].join(' '),
}

/**
 * Compute the default className for an `<div role="alert">` element. The
 * `variant` axis paints a tinted-bg / matching-text / matching-border tone
 * triple — `info` (blue), `success` (green), `warning` (amber), `destructive`
 * (red), or the neutral `default` chrome. Layout (`flex items-start gap-3`)
 * keeps the leading icon top-aligned with the message text so long copy wraps
 * cleanly without disturbing the icon's baseline; padding matches the alert's
 * border radius for a balanced inset.
 */
export const computeAlertClasses = ({
  variant = 'default',
}: {
  variant?: AlertVariant
} = {}): string => [ALERT_LAYOUT, ALERT_RADIUS, ALERT_VARIANT_CLASS[variant]].join(' ')

const ALERT_ICON_LAYOUT = 'text-lg leading-none shrink-0'

/**
 * Compute the default className for the leading icon `<span>` inside an
 * alert. Inherits the alert's foreground tone via `text-current` (no separate
 * tone needed — the alert's `text-*` class cascades to the icon's `color`),
 * with `text-lg` to read a hair larger than the body copy. `shrink-0` keeps
 * the icon at its intrinsic width when the message wraps.
 */
export const computeAlertIconClasses = (): string => ALERT_ICON_LAYOUT

// ──────────────────────────────────────────────────────────────────────────────
// SKELETON — loading placeholder block with shape variants
// ──────────────────────────────────────────────────────────────────────────────

const SKELETON_VARIANT_RADIUS: Record<SkeletonVariant, string> = {
  text: `rounded-[${v('sv-radius-base', T.radiusBase)}]`,
  circular: `rounded-[${v('sv-radius-full', T.radiusFull)}]`,
  rectangular: `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
}

const SKELETON_SURFACE = `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`

/**
 * Compute the default className for a `<div>`-rendered `skeleton`. The
 * `variant` axis flips the border radius between three shapes:
 *   - `text` (default) — slightly-rounded bar (text-line placeholder)
 *   - `circular`       — full circle (avatar placeholder)
 *   - `rectangular`    — square-cornered block (card / image placeholder)
 * `animate` (default `true`) applies `animate-pulse` so the placeholder
 * visibly shimmers; setting it `false` renders a static block. The fill
 * tone is `bg-subtle` so the placeholder reads as a neutral chrome stub,
 * not as focal content.
 */
export const computeSkeletonClasses = ({
  variant = 'text',
  animate = true,
}: {
  variant?: SkeletonVariant
  animate?: boolean
} = {}): string =>
  [SKELETON_SURFACE, SKELETON_VARIANT_RADIUS[variant], animate ? 'animate-pulse' : '']
    .filter(Boolean)
    .join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// PROGRESS — linear bar + circular ring + percentage label
// ──────────────────────────────────────────────────────────────────────────────

const PROGRESS_TRACK_LAYOUT = 'w-full overflow-hidden'

const PROGRESS_TRACK_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `rounded-[${v('sv-radius-full', T.radiusFull)}]`,
].join(' ')

/**
 * Compute the default className for the linear-variant progress track —
 * the rounded background bar that holds the fill. Uses `bg-subtle` tone so
 * the empty portion reads as a faint trough; `rounded-full` makes the bar's
 * end caps semicircular regardless of size. The element's `style={{ height }}`
 * still controls the pixel height per size token — the helper does NOT bake
 * a height class so the renderer keeps that responsibility.
 */
export const computeProgressTrackClasses = (): string =>
  [PROGRESS_TRACK_LAYOUT, PROGRESS_TRACK_SURFACE].join(' ')

const PROGRESS_BAR_LAYOUT = 'h-full'

const PROGRESS_BAR_SURFACE = [
  `bg-[${v('sv-primary', T.primary)}]`,
  `rounded-[${v('sv-radius-full', T.radiusFull)}]`,
].join(' ')

/**
 * Compute the default className for the linear-variant progress fill — the
 * primary-tone bar that sits inside the track. `rounded-full` matches the
 * track's end caps so a 0%-filled bar's leading edge stays visible as a
 * rounded dot rather than a sharp corner. The renderer applies the
 * percentage via `style={{ width: '<n>%' }}`.
 */
export const computeProgressBarClasses = (): string =>
  [PROGRESS_BAR_LAYOUT, PROGRESS_BAR_SURFACE].join(' ')

/**
 * Compute the default SVG `stroke` value for the circle-variant under-ring —
 * the faint track that sits behind the filled arc. Resolves to the standard
 * `sv-border` tone so the ring chrome matches the rest of the design system's
 * separator lines.
 *
 * Unlike className helpers, this returns a `var(...)` expression suitable for
 * the `<circle stroke={…}>` SVG attribute (SVG presentation attributes accept
 * CSS variable references in modern browsers).
 */
export const computeProgressCircleTrackStroke = (): string => v('sv-border', T.border)

/**
 * Compute the default SVG `stroke` value for the circle-variant filled arc —
 * the primary-tone over-ring whose `stroke-dashoffset` encodes the percentage.
 * Resolves to the standard `sv-primary` so the focal portion of the ring
 * reads as a clear accent against the muted under-ring.
 */
export const computeProgressCircleBarStroke = (): string => v('sv-primary', T.primary)

const PROGRESS_LABEL_LAYOUT = 'shrink-0 text-sm font-medium'

const PROGRESS_LABEL_SURFACE = `text-[${v('sv-fg', T.fg)}]`

/**
 * Compute the default className for the percentage label that sits beside
 * (linear) or inside (circle) the progress indicator. Strong foreground tone
 * + medium weight so the percentage reads as the focal callout next to the
 * chrome track.
 */
export const computeProgressLabelClasses = (): string =>
  [PROGRESS_LABEL_LAYOUT, PROGRESS_LABEL_SURFACE].join(' ')
