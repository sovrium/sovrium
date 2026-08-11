/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for the remaining `interactive` +
 * `content` schema clusters. Companion to
 * `button-default-classes.ts` (already covers `button`), `feedback-default-
 * classes.ts` (`alert`, `badge`), and `typography-default-classes.ts` (the
 * typography-in-chrome cluster). This slice closes the "gap" components from
 * Phase 3 of the prestyled-by-default plan that have no schema-level variants
 * but still need an opinionated default look so a bare
 * `{ type: 'icon', name: 'check' }` (or `{ type: 'image', src: '...' }`,
 * `{ type: 'link', text: '...' }`, …) renders with the Sovrium identity
 * without the author spelling any chrome.
 *
 * Each helper paints color / radius / shadow / motion / tone classes through
 * {@link withVarFallback} so `app.theme.*` overrides still win at the CSS
 * cascade layer (`var(--sv-X)` resolves the override first, falling back to
 * the inline OKLCH literal). Structural layout (flex / gap / padding / icon
 * pixel sizing like `w-4 h-4`) stays raw Tailwind — Tailwind v4 sources
 * spacing through its own cascade that the theme layer overrides separately.
 *
 * Subparts covered:
 *
 *   - BUTTON GROUP (container)  — outer wrapper for a row/column of buttons
 *                                 sharing borders (segmented-control look).
 *                                 Paints the focal-ring slot + radius so the
 *                                 group reads as one shape; the existing
 *                                 `-space-x-px isolate` rhythm stays in
 *                                 the renderer.
 *   - BUTTON GROUP (item)       — class hook for an individual button at
 *                                 `first` / `middle` / `last` / `only`
 *                                 positions. Flattens the inner radius
 *                                 corners so adjacent buttons join visually
 *                                 without a gap. Helper returns the radius
 *                                 hint only; consumers compose it with the
 *                                 normal `computeButtonDefaultClasses`.
 *   - LINK                      — the inline `<a>` mark with three tonal
 *                                 variants (`default` / `subtle` /
 *                                 `destructive`). Underline appears on hover
 *                                 (not by default) so dense link copy reads
 *                                 cleanly; the `--sv-warmth` accent paints
 *                                 the underline so the link feels like the
 *                                 Sovrium identity rather than browser-blue.
 *   - ICON                      — Lucide-rendered `<svg>` wrapper with a
 *                                 size class (`sm` / `md` / `lg` / `xl`)
 *                                 and a tone class (`default` / `muted` /
 *                                 `primary`). Icons inherit color via
 *                                 `currentColor` from their parent — the
 *                                 helper sets the parent's `text-*` so
 *                                 inline icons next to text track the
 *                                 surrounding tone automatically.
 *   - IMAGE                     — block image element with a radius slot
 *                                 (`none` / `sm` / `md` / `lg` / `full`)
 *                                 and an object-fit slot (`cover` /
 *                                 `contain`). The radius defaults to `md`
 *                                 (matches the rest of the surface family);
 *                                 fit defaults to `cover` (the common
 *                                 product-card / hero image use case).
 *   - IFRAME                    — wrapper chrome (`<iframe>` itself) for
 *                                 embedded content. Bordered + sm radius +
 *                                 surface-tinted bg so the embed sits
 *                                 inside the page without floating.
 *   - AUDIO PLAYER              — bordered wrapper around the browser's
 *                                 default `<audio controls>` UI. The native
 *                                 player ships its own widget chrome, so
 *                                 the helper only paints the bounding frame
 *                                 (radius + border + bg-subtle) — keeping
 *                                 the player visually integrated with the
 *                                 surrounding card / list family.
 *   - VIDEO PLAYER              — same bordered-frame idea as audio, but
 *                                 sized for a video aspect ratio. The
 *                                 renderer also auto-converts YouTube /
 *                                 Vimeo URLs to an `<iframe>` embed; the
 *                                 helper applies the same frame chrome in
 *                                 either case so the visual is consistent
 *                                 across direct-video vs embed routes.
 *   - SEARCH INPUT (container)  — the wrapper `<div>` around a generic
 *                                 search input. Matches the input-default
 *                                 surface tone so a `<searchInput>` in a
 *                                 toolbar reads as a peer of the regular
 *                                 form `<input>` controls. The SSR `<input
 *                                 type="search">` inside the wrapper keeps
 *                                 its inline placeholder padding so it
 *                                 renders visibly even when the runtime
 *                                 CSS isn't loaded; the helper paints
 *                                 only the outer chrome.
 *   - PAGE SEARCH (SSR shell)   — same outer-chrome philosophy as the
 *                                 generic search input: paints a frame
 *                                 around the SSR `<input type="search">`
 *                                 emitted by `renderPageSearch` so the
 *                                 component reads as a search control on
 *                                 first paint. Once hydrated, the
 *                                 `page-search-island` runtime swaps the
 *                                 SSR shell for a live results panel that
 *                                 ships its own inline styles (so it
 *                                 renders on third-party hosts that don't
 *                                 load Sovrium's CSS).
 *
 * Intentionally NOT covered:
 *
 *   - BUTTON (the component-type itself) — already covered by
 *     `button-default-classes.ts` from the foundations + UI-kit phase.
 *   - ALERT / BADGE — already covered by `feedback-default-classes.ts`.
 *   - TEXT / TOC / CODE-ELEMENT (typography rendered as text components) —
 *     already covered by `typography-default-classes.ts`. The `code` schema
 *     component-type renders a `<pre><code>` block with a Copy button; the
 *     existing typography helpers paint the inline `<code>` mark and a
 *     stand-alone code-block container the same way, so the code-element
 *     renderer's `font-mono` class stays as-is rather than duplicating a
 *     code-block helper here.
 *   - PAGE SEARCH LIVE-PANEL — the hydrated `page-search-island` paints its
 *     own panel chrome via inline styles (`PanelInlineStyles` in
 *     `page-search-island.tsx`) so it renders correctly on host pages that
 *     don't ship Sovrium's CSS. Restyling that surface here would require
 *     bundling Tailwind into the island and is out of scope.
 *
 * Helper file lives in
 * `src/presentation/ui/sections/renderers/element-renderers/` (alongside
 * the renderers that consume it) because every covered component renders
 * SSR-side — same convention as `button-default-classes.ts`,
 * `input-default-classes.ts`, `feedback-default-classes.ts`,
 * `navigation-default-classes.ts`, `layout-default-classes.ts`,
 * `forms-default-classes.ts`, `data-default-classes.ts`, and
 * `typography-default-classes.ts`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// BUTTON GROUP — container + per-item radius hint
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for a `button-group` container — the outer
 * `<div role="group">` wrapping a row of buttons. Paints the focal-ring
 * surface tone (`sv-bg`) + `sv-radius-md` so the group reads as a single
 * shape; the existing `inline-flex isolate -space-x-px` rhythm (responsible
 * for the segmented-control look) stays in the renderer alongside this
 * className via `${defaults} ${renderer-class}`.
 *
 * Returns ONLY the chrome (rounded surface) because the structural rhythm
 * (`-space-x-px isolate`) is already baked into the renderer's
 * `containerClass` string. Keeping the two separate avoids fighting the
 * cascade — the helper provides the surface identity, the renderer
 * provides the segmented-control layout.
 */
const BUTTON_GROUP_CONTAINER = [
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  `shadow-[${v('sv-shadow-xs', T.shadowXs)}]`,
].join(' ')

export const computeButtonGroupClasses = (): string => BUTTON_GROUP_CONTAINER

/**
 * Per-item position vocabulary inside a button-group. Drives radius
 * flattening so adjacent buttons join into one shape.
 *
 * - `'only'`  — single button (rare; keeps the full radius).
 * - `'first'` — leftmost (LTR) / topmost button: keeps left-side radius,
 *   flattens right-side radius.
 * - `'last'`  — rightmost / bottommost: keeps right-side radius, flattens
 *   left-side radius.
 * - `'middle'` — interior button: flattens both sides.
 */
export type ButtonGroupItemPosition = 'first' | 'middle' | 'last' | 'only'

const BUTTON_GROUP_ITEM: Record<ButtonGroupItemPosition, string> = {
  only: '',
  first: 'rounded-r-none',
  middle: 'rounded-none',
  last: 'rounded-l-none',
}

/**
 * Compute the per-item radius hint for a button inside a button-group.
 * Consumers compose it AFTER `computeButtonDefaultClasses(...)` so the
 * `rounded-r-none` / `rounded-l-none` / `rounded-none` overrides win at
 * the cascade, flattening the inner corners. The helper returns the empty
 * string for `only` (the lone button keeps its full radius).
 */
export const computeButtonGroupItemClasses = ({
  position,
}: {
  readonly position: ButtonGroupItemPosition
}): string => BUTTON_GROUP_ITEM[position]

// ──────────────────────────────────────────────────────────────────────────────
// LINK — inline `<a>` mark with three tonal variants
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Link variant vocabulary aligned with the schema's role-driven palette:
 *
 *   - `'default'`     — the workhorse inline link. Primary tone for the
 *     text + warmth accent on the hover underline (per the
 *     `sovrium-design` SKILL: Source-Serif italics + warmth accent are
 *     the third type-family / chromatic identity that paint as a "grace
 *     note" through the rest of the chrome).
 *   - `'subtle'`      — secondary link tone (`sv-fg-muted`) for links
 *     embedded in chrome copy (footer / navigation) where the underline
 *     should still appear on hover but the resting state stays quiet.
 *   - `'destructive'` — danger-tone link (`sv-error-fg`) for the rare
 *     inline "Delete" / "Revoke" call-to-action that lives in copy.
 */
export type LinkVariant = 'default' | 'subtle' | 'destructive'

const LINK_VARIANT: Record<LinkVariant, string> = {
  default: [
    `text-[${v('sv-primary', T.primary)}]`,
    `hover:decoration-[${v('sv-fg-muted', T.fgMuted)}]`,
  ].join(' '),
  subtle: [
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
    `hover:text-[${v('sv-fg', T.fg)}]`,
    `hover:decoration-[${v('sv-fg-muted', T.fgMuted)}]`,
  ].join(' '),
  destructive: [
    `text-[${v('sv-error-fg', T.errorFg)}]`,
    `hover:decoration-[${v('sv-error-fg', T.errorFg)}]`,
  ].join(' '),
}

const LINK_SHARED = [
  'underline-offset-4 decoration-2',
  'hover:underline',
  'focus-visible:outline-none focus-visible:underline',
  `focus-visible:decoration-[${v('sv-focus-ring', T.focusRing)}]`,
  'transition-colors duration-150',
].join(' ')

/**
 * Compute the default className for an inline `<a>` rendered by the
 * `link` component-type. Paints the tonal variant (default / subtle /
 * destructive) plus the shared underline-offset + hover-underline
 * recipe so links read as legible inline marks without competing with
 * surrounding body copy.
 *
 * The underline appears on HOVER (not at rest) so dense link-rich copy
 * stays readable; the warmth accent on the underline mark identifies the
 * Sovrium identity (per the `sovrium-design` SKILL — warmth is the
 * third-family chromatic grace note across the design system).
 */
export const computeLinkClasses = ({
  variant = 'default',
}: {
  readonly variant?: LinkVariant
} = {}): string => [LINK_VARIANT[variant], LINK_SHARED].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// ICON — Lucide `<svg>` wrapper tone + sizing class
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Icon size vocabulary. Backed by Tailwind sizing utilities (`w-* h-*`) so
 * the helper paints both width and height in one shot — Lucide icons are
 * square by convention.
 *
 *   - `'sm'` — 12px (alongside small body text).
 *   - `'md'` — 16px (alongside default body text).
 *   - `'lg'` — 20px (alongside section titles / list-item rows).
 *   - `'xl'` — 24px (focal icon in empty states / hero blocks).
 */
export type IconSize = 'sm' | 'md' | 'lg' | 'xl'

const ICON_SIZE: Record<IconSize, string> = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  xl: 'w-6 h-6',
}

/**
 * Icon tone vocabulary. Lucide icons inherit color via `currentColor`, so
 * the helper paints `text-*` on the SVG itself — both the stroke and the
 * fill resolve through the inherited color cascade.
 *
 *   - `'default'` — focal tone (`sv-fg`). Default for the bare schema.
 *   - `'muted'`   — chrome tone (`sv-fg-muted`). Status / leading affordances.
 *   - `'primary'` — accent tone (`sv-primary`). Brand-call-out icons.
 */
export type IconTone = 'default' | 'muted' | 'primary'

const ICON_TONE: Record<IconTone, string> = {
  default: `text-[${v('sv-fg', T.fg)}]`,
  muted: `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  primary: `text-[${v('sv-primary', T.primary)}]`,
}

/**
 * Compute the default className for an `icon` component. Paints size +
 * tone so a bare `{ type: 'icon', name: 'check' }` renders the canonical
 * 16px focal-tone Sovrium icon without the author spelling chrome. Specs
 * that override pixel sizes via `props.size` still win because Lucide
 * accepts a numeric `size` prop that paints inline `width` / `height`
 * attributes — those beat the Tailwind `w-* h-*` classes at the cascade.
 */
export const computeIconClasses = ({
  size = 'md',
  tone = 'default',
}: {
  readonly size?: IconSize
  readonly tone?: IconTone
} = {}): string => [ICON_SIZE[size], ICON_TONE[tone]].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// IMAGE — radius + object-fit slot
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Image radius vocabulary. Drives only the corner-rounding slot; width /
 * height come from the schema's `responsiveFields` and parent layout.
 *
 *   - `'none'` — flat corners (full-bleed hero, edge-to-edge gallery).
 *   - `'sm'`   — tight chamfer (inline thumbnails inside dense lists).
 *   - `'md'`   — default (matches the rest of the surface family).
 *   - `'lg'`   — generous round (feature card cover photos).
 *   - `'full'` — circular crop (avatars; aligns with `renderAvatar`).
 */
export type ImageRadius = 'none' | 'sm' | 'md' | 'lg' | 'full'

const IMAGE_RADIUS: Record<ImageRadius, string> = {
  none: '',
  sm: `rounded-[${v('sv-radius-sm', T.radiusSm)}]`,
  md: `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  lg: `rounded-[${v('sv-radius-lg', T.radiusLg)}]`,
  full: `rounded-[${v('sv-radius-full', T.radiusFull)}]`,
}

/**
 * Image object-fit vocabulary. The schema's variants (`avatar` /
 * `thumbnail` / `hero` / `default`) drive renderer dispatch — this helper
 * exposes the standalone object-fit slot for variants that want cover vs
 * contain explicitly.
 */
export type ImageFit = 'cover' | 'contain'

const IMAGE_FIT: Record<ImageFit, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
}

/**
 * Compute the default className for the `image` component's bare `default`
 * variant. Paints the radius slot + object-fit so a bare
 * `{ type: 'image', src: '...' }` renders with the canonical medium
 * radius + cover fit (the most common product-card / hero use case).
 * The renderer's `avatar` / `thumbnail` / `hero` variant branches each
 * apply their own radius (full / md / lg-top) atop the schema, so this
 * helper only owns the BARE `default` variant.
 */
export const computeImageClasses = ({
  radius = 'md',
  fit = 'cover',
}: {
  readonly radius?: ImageRadius
  readonly fit?: ImageFit
} = {}): string => [IMAGE_RADIUS[radius], IMAGE_FIT[fit]].filter(Boolean).join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// IFRAME — bordered embed frame
// ──────────────────────────────────────────────────────────────────────────────

const IFRAME_FRAME = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
].join(' ')

/**
 * Compute the default className for an `iframe` component. Paints a
 * bordered frame around the embed so it sits inside the surrounding
 * layout rather than floating against the page background. The bg
 * (`sv-bg-subtle`) gives the iframe a recognisable surface even before
 * the embed loads (a blank `<iframe>` would otherwise render as a
 * transparent slot with no visual presence).
 */
export const computeIframeClasses = (): string => IFRAME_FRAME

// ──────────────────────────────────────────────────────────────────────────────
// AUDIO + VIDEO — bordered media-player frames
// ──────────────────────────────────────────────────────────────────────────────

const AUDIO_FRAME = [
  'block w-full',
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
].join(' ')

/**
 * Compute the default className for an `audio` component (typically
 * rendered as `<audio controls>`). Paints a bordered frame around the
 * native player widget — the browser still owns the widget chrome, the
 * helper only sets the bounding shape so the player visually integrates
 * with the surrounding card / list family.
 *
 * `block w-full` makes the player fill its column (the default `<audio>`
 * element is inline by browser convention, which collapses awkwardly inside
 * a flex layout).
 */
export const computeAudioPlayerClasses = (): string => AUDIO_FRAME

const VIDEO_FRAME = [
  'block w-full',
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  'overflow-hidden',
].join(' ')

/**
 * Compute the default className for a `video` component. Identical to the
 * audio frame plus `overflow-hidden` — the renderer auto-converts YouTube
 * / Vimeo URLs to an `<iframe>` embed, and `overflow-hidden` clips the
 * embed's square corners to match the surrounding md radius so the embed
 * reads as a video player rather than a floating iframe.
 */
export const computeVideoPlayerClasses = (): string => VIDEO_FRAME

// ──────────────────────────────────────────────────────────────────────────────
// SEARCH INPUT + PAGE SEARCH — SSR shell chrome
// ──────────────────────────────────────────────────────────────────────────────

const SEARCH_CONTAINER = ['relative w-full', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * Compute the default className for the OUTER wrapper of a `searchInput`
 * or `pageSearch` SSR shell. Paints `relative w-full` so an absolutely-
 * positioned hydrated panel (page-search) anchors to the input on mount,
 * and a focal `sv-fg` tone so the input's placeholder + typed value
 * tracks the active foreground color.
 *
 * The wrapper does NOT carry a background / border — the inner `<input
 * type="search">` ships its own chrome (see {@link computeSearchInputFieldClasses}).
 * Splitting wrapper vs field keeps the page-search hydration story
 * working: the island runtime replaces the SSR input with a styled panel
 * whose own inline `<input>` doesn't need to inherit chrome from the
 * SSR shell.
 */
export const computeSearchInputContainerClasses = (): string => SEARCH_CONTAINER

const SEARCH_FIELD = [
  'w-full',
  'px-3 py-2',
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg', T.bg)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  `shadow-[${v('sv-shadow-xs', T.shadowXs)}]`,
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  'transition-[box-shadow,border-color] duration-150',
].join(' ')

/**
 * Compute the default className for the INNER `<input type="search">`
 * inside a `searchInput` or `pageSearch` SSR shell. Mirrors the
 * `computeInputDefaultClasses(default)` recipe (border + bg + radius +
 * focus ring) so a `<searchInput>` in a toolbar reads as a peer of the
 * regular form `<input>` controls — without the search-shell renderer
 * needing to import the input helper directly (avoids cross-helper
 * coupling).
 *
 * Field-level recipe (rather than wrapper-level) so the page-search
 * hydration story preserves the input's chrome until the island replaces
 * it: the SSR `<input>` keeps its border + focus ring during the lazy
 * chunk load.
 */
export const computeSearchInputFieldClasses = (): string => SEARCH_FIELD
