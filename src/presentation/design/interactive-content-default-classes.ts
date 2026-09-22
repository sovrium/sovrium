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
 * {@link withVarFallback} so `app.design.*` overrides still win at the CSS
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
 *                                 `destructive`). A hover is a COLOUR change
 *                                 and nothing else; the only underline the
 *                                 recipe draws is the keyboard-focus mark, in
 *                                 the focus-ring colour. An `aria-disabled`
 *                                 anchor is made inert rather than merely
 *                                 marked. See `LINK_SHARED` for both rulings.
 *   - ICON                      — Lucide-rendered `<svg>` wrapper with a
 *                                 size class (`sm` / `md` / `lg` / `xl`)
 *                                 and a tone class (`default` / `muted` /
 *                                 `primary`). Icons inherit color via
 *                                 `currentColor`, and the `default` tone names
 *                                 no colour at all so an icon reads against
 *                                 whatever fill it lands in — naming one is
 *                                 how a chevron came to stroke black on a
 *                                 black button. See `ICON_TONE`.
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
 *                                 surface tone so a `<search-input>` in a
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

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// BUTTON GROUP — container + per-item radius hint
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for a `button-group` container — the outer
 * `<div role="group">` wrapping a row of buttons. Paints the focal-ring
 * surface tone (`sv-bg`) + `radius-md` so the group reads as a single
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
// Radius only — the member buttons carry their own borders, and an
// elevation under a segmented control would outline the group a second time.
const BUTTON_GROUP_CONTAINER = `rounded-[${v('radius-md', T.radiusMd)}]`

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
 *   - `'default'`     — the workhorse inline link. Primary tone at rest,
 *     deepening to the primary HOVER tone under the pointer.
 *   - `'subtle'`      — secondary link tone (`sv-fg-muted`) for links
 *     embedded in chrome copy (footer / navigation), resolving to full ink
 *     on hover while the resting state stays quiet.
 *   - `'destructive'` — danger-tone link (`sv-error-fg`) for the rare
 *     inline "Delete" / "Revoke" call-to-action that lives in copy.
 *
 * Every variant answers a hover with a COLOUR and nothing else — see the note
 * on {@link LINK_SHARED} for why the rule under the word is gone.
 */
export type LinkVariant = 'default' | 'subtle' | 'destructive'

const LINK_VARIANT: Record<LinkVariant, string> = {
  default: [
    `text-[${v('sv-primary', T.primary)}]`,
    `hover:text-[${v('sv-primary-hover', T.primaryHover)}]`,
  ].join(' '),
  subtle: [`text-[${v('sv-fg-muted', T.fgMuted)}]`, `hover:text-[${v('sv-fg', T.fg)}]`].join(' '),
  destructive: [
    `text-[${v('sv-error-fg', T.errorFg)}]`,
    `hover:text-[${v('sv-error-700', T.error700)}]`,
  ].join(' '),
}

/**
 * A link's keyboard-focus affordance — an underline in the focus-ring colour
 * rather than a ring, because an inline `<a>` sits inside a line of prose and a
 * 2px offset ring would reflow the line it is in.
 *
 * The accessibility FLOOR (`@/presentation/utils/design/component-floor`)
 * re-applies this same affordance after an operator's `design.components`
 * classes. It cannot import this constant — a `presentation-util` may not reach
 * a `presentation-component` — so it composes the identical string from the
 * same `css-var` tokens, and a unit test there asserts that every floor token
 * appears verbatim in this recipe's output. That test is the anti-drift guard;
 * do not change the string here without running it.
 */
const LINK_FOCUS_CLASS = [
  'focus-visible:outline-none focus-visible:underline',
  `focus-visible:decoration-[${v('sv-focus-ring', T.focusRing)}]`,
].join(' ')

/**
 * What every link variant shares: the underline METRICS, the focus mark, the
 * inert treatment of a disabled anchor, and the transition.
 *
 * ─── NO HOVER UNDERLINE, AND NO PROSE MODE EITHER ([internal ref] clause 4) ────────
 *
 * `hover:underline` used to sit here, and the Design System console review of
 * 2026-09-16 retired it: a standalone link answers a pointer with a COLOUR, not
 * with a rule under the word. Each {@link LINK_VARIANT} carries that colour,
 * because the right one depends on the resting tone — removing the underline
 * and replacing it with nothing would leave a worse affordance than the one
 * being retired.
 *
 * The review permits an inline link INSIDE PROSE to keep its underline, which
 * reads like a second mode on {@link computeLinkClasses}. It is not one.
 * Measured live 2026-09-16 on the four pages the founder cited: they carry 8 to
 * 14 links each and ZERO of them sit inside a `<p>`. A `link` COMPONENT is an
 * authored, standalone affordance; a link inside a paragraph comes from the
 * markdown path, which applies none of these recipes at all. The exemption has
 * no subject here, and a mode nothing would ever pass is an API invented to
 * satisfy a sentence.
 *
 * The underline metrics (`underline-offset-4 decoration-2`) STAY: they are what
 * the focus mark below is drawn with.
 *
 * ─── AND A DISABLED ANCHOR HAS TO BE MADE INERT ([internal ref] clause 3) ──────────
 *
 * An `<a>` has no `disabled` attribute, so `aria-disabled` is the only mark a
 * disabled link can carry — and a mark alone changes nothing: the element keeps
 * answering the pointer, which is what the founder watched happen on the
 * console's `link` state strip. `pointer-events-none` is what makes the mark
 * true, and the dimming mirrors what a `<button>` already does from its native
 * attribute (`opacity-50 cursor-not-allowed`, in `button-default-classes.ts`).
 */
const LINK_SHARED = [
  'underline-offset-4 decoration-2',
  LINK_FOCUS_CLASS,
  'aria-disabled:pointer-events-none aria-disabled:opacity-50',
  'transition-colors duration-150',
].join(' ')

/**
 * Compute the default className for an inline `<a>` rendered by the
 * `link` component-type. Paints the tonal variant (default / subtle /
 * destructive) plus the shared focus + inert recipe, so links read as legible
 * inline marks without competing with surrounding body copy.
 *
 * A hover is a colour change and nothing else; keyboard focus draws an
 * underline in the focus-ring colour. See {@link LINK_SHARED}.
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
 *   - `'default'` — INHERITED. Takes `currentColor` from whatever it sits in.
 *   - `'muted'`   — chrome tone (`sv-fg-muted`). Status / leading affordances.
 *   - `'primary'` — accent tone (`sv-primary`). Brand-call-out icons.
 *
 * ─── WHY THE DEFAULT NAMES NO COLOUR AT ALL (X10, 2026-09-16) ──────────────
 *
 * It used to be `sv-fg`, which is the right colour on a page and the WRONG one
 * inside a filled control: it OVERRIDES the fill's own foreground instead of
 * inheriting it. Measured live on the Design System console, 2026-09-16, on the
 * attached split button: the chevron stroked oklch(0.14 0 0) on a button filled
 * oklch(0.205 0 0) — 1.11:1, black on black — while the same button's own
 * `color` was already oklch(0.985 0 0), white. The button had it right and the
 * icon painted over it.
 *
 * Inheriting costs nothing on an ordinary page, where `currentColor` resolves
 * to the body foreground — which is `sv-fg`. An author naming `muted` or
 * `primary` is choosing a colour on purpose and still gets it; X10 is about the
 * case where nobody chose one.
 */
export type IconTone = 'default' | 'muted' | 'primary'

const ICON_TONE: Record<IconTone, string> = {
  default: 'text-current',
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
  sm: `rounded-[${v('radius-sm', T.radiusSm)}]`,
  md: `rounded-[${v('radius-md', T.radiusMd)}]`,
  lg: `rounded-[${v('radius-lg', T.radiusLg)}]`,
  full: `rounded-[${v('radius-full', T.radiusFull)}]`,
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
  `rounded-[${v('radius-md', T.radiusMd)}]`,
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
  `rounded-[${v('radius-md', T.radiusMd)}]`,
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
  `rounded-[${v('radius-md', T.radiusMd)}]`,
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
 * The OUTER wrapper of a `search-input` shell, in either scope.
 *
 * `relative` is load-bearing twice over: it anchors the absolutely-positioned
 * results panel the page-search island mounts, and — since R-E — it anchors
 * the leading magnifier, which sits over the field rather than beside it so
 * the control stays a single `<input>` that `#<id> input` still resolves.
 *
 * The wrapper carries no ground and no border; the field ships its own chrome.
 * Splitting the two is what keeps the page-search hydration story working: the
 * island replaces the SSR input with its own panel, and a panel should not
 * inherit a border from the shell it replaced.
 */
export const computeSearchInputContainerClasses = (): string => SEARCH_CONTAINER

/**
 * The magnifier at the leading edge.
 *
 * Absolutely positioned and `pointer-events-none`, so the whole width of the
 * control is still a click target for the field underneath it. On the disabled
 * foreground — a search glyph is a label for the box, not a control, and
 * painting it at full strength made it compete with the value typed beside it.
 *
 * `variants.mjs:142` draws it at 16px in both scopes but insets it differently,
 * because the two fields are padded differently: the data field carries the
 * `.input` inset of 12px, the page trigger the tighter 10px. The glyph sits at
 * its field's own inset, so the icon and the placeholder beside it start from
 * the same edge in both.
 */
export const computeSearchInputIconClasses = ({
  scope,
}: { readonly scope?: 'data' | 'page' } = {}): string =>
  [
    'pointer-events-none absolute top-1/2 -translate-y-1/2',
    scope === 'page' ? 'left-2.5' : 'left-3',
    `text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
  ].join(' ')

const SEARCH_FIELD = [
  'w-full h-9 py-2 pr-3 pl-9 text-base',
  'border',
  `border-[${v('sv-border-strong', T.borderStrong)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `placeholder:text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
  `rounded-[${v('radius-base', T.radiusBase)}]`,
  `hover:border-[${v('sv-fg-disabled', T.fgDisabled)}]`,
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  `focus-visible:ring-offset-[${v('sv-bg', T.bg)}]`,
  'transition-[box-shadow,border-color] duration-150',
].join(' ')

/**
 * The `<input type="search">` inside a DATA-scoped shell — one that filters a
 * table, a list, a set of records.
 *
 * This is the ordinary field: 36px tall, 13px, `radius-base`, on the strong
 * border and the raised ground, exactly like every other `input` in the system
 * (`variants.mjs:142`, the `data` variant). It shipped one rung out on every
 * one of those — 33px tall at 12px on `radius-md` and the light border — which
 * made a search box read as a slightly different species from the fields
 * beside it in the same toolbar.
 *
 * `pl-9` is the inset for the magnifier the container positions; `pr-3` keeps
 * the trailing edge on the normal 12px.
 */
export const computeSearchInputFieldClasses = (): string => SEARCH_FIELD

const PAGE_SEARCH_FIELD = [
  'w-full py-[7px] pr-9 pl-[34px] text-sm',
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `placeholder:text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
  `rounded-[${v('radius-md', T.radiusMd)}]`,
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  `focus-visible:ring-offset-[${v('sv-bg', T.bg)}]`,
  'transition-[box-shadow,border-color] duration-150',
].join(' ')

/**
 * The `<input type="search">` inside a PAGE-scoped shell.
 *
 * Deliberately NOT the data-scope field. A page search is a TRIGGER — press
 * `/`, get a panel — where a data search is a filter you type into and watch.
 * `variants.mjs:142` draws them apart on purpose: the trigger is smaller
 * (12px), softer-cornered (`radius-md`), on the light border rather than the
 * strong one, and it carries a key hint the filter has no use for. Treating
 * the two as one control, which is what shipped, made the page search look
 * like an empty filter for a table that was not there.
 *
 * `pl-[34px]` clears the 10px inset, the 16px glyph and the 8px gap after it;
 * `pr-9` reserves the trailing edge for the key hint.
 */
export const computePageSearchFieldClasses = (): string => PAGE_SEARCH_FIELD

/**
 * The `/` key hint at the trailing edge of a page search.
 *
 * Monospace, because it names a key. On the disabled foreground and
 * `pointer-events-none` for the same reason as the magnifier: it is a label on
 * the box, and it must not eat a click meant for the field.
 */
export const computePageSearchKeyHintClasses = (): string =>
  [
    'pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-sm',
    `text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// KBD — the chord, one keycap per key, and the plain text between them
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The chord's own wrapper.
 *
 * `gap-1` is the resting distance between two adjacent caps — the convention on
 * Apple keyboards and in most modern documentation, and what an author gets
 * when they declare no `separator`. `align-middle` keeps a chord sitting inside
 * a sentence on the sentence's baseline rather than riding above it.
 */
const KBD_CHORD = 'inline-flex items-center gap-1 align-middle'

/**
 * One keycap.
 *
 * ─── THE BOTTOM EDGE IS THE COMPONENT ──────────────────────────────────────
 *
 * 1px on three sides and 2px underneath. That single asymmetry is the whole
 * difference between something a reader sees as a KEY and something they see as
 * a badge, and it is the value `[internal ref]` measures —
 * in both colour schemes, because a keycap is a SHAPE and only its colours
 * belong to the scheme.
 *
 * The three widths are spelled per side (`border-x` / `border-t` / `border-b-2`)
 * rather than as `border` plus an override. Both compile; only the explicit
 * form is independent of the order Tailwind happens to emit the shorthand and
 * the side utility in, and a keycap whose bottom edge silently equalised would
 * still pass every assertion about its text.
 *
 * 22px square-ish (`h-[22px] min-w-[22px]`) with 6px of side padding and none
 * vertically: a single letter sits in a square, and `Shift` grows sideways only.
 */
const KBD_CAP = [
  'inline-flex h-[22px] min-w-[22px] items-center justify-center px-1.5 py-0',
  'border-x border-t border-b-2',
  `rounded-[${v('radius-base', T.radiusBase)}]`,
  'font-mono text-xs leading-none font-medium',
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `border-[${v('sv-border-strong', T.borderStrong)}]`,
].join(' ')

/** The text printed between two caps — never itself a cap. */
const KBD_SEPARATOR = ['text-xs select-none', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

/** Compute the className for a `kbd` chord's wrapper. */
export const computeKbdChordClasses = (): string => KBD_CHORD

/** Compute the className for one `<kbd>` keycap. */
export const computeKbdCapClasses = (): string => KBD_CAP

/** Compute the className for the plain text between two caps. */
export const computeKbdSeparatorClasses = (): string => KBD_SEPARATOR
