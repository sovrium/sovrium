/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui kbd (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
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
 * Each helper paints colour through the shadcn role utilities (`text-primary`,
 * `text-muted-foreground`), which read the variables `app.design.*` rewrites,
 * and radius / the roles shadcn does not declare through {@link withVarFallback}
 * (the variable first, the inline literal as its fallback). Structural layout (flex / gap / padding / icon
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
 *   - ICON                      — Lucide-rendered `<svg>` with a `shrink-0`
 *                                 size class (`sm` / `md` / `lg` / `xl`)
 *                                 and a tone class (`default` / `muted` /
 *                                 `primary`). Icons inherit color via
 *                                 `currentColor`, and the `default` tone names
 *                                 no colour at all so an icon reads against
 *                                 whatever fill it lands in — naming one is
 *                                 how a chevron came to stroke black on a
 *                                 black button. See `ICON_TONE`.
 *   - IMAGE                     — `rounded-lg object-cover` for the bare
 *                                 variant; no border on any variant.
 *   - IFRAME                    — `rounded-lg border` on the page
 *                                 background.
 *   - AUDIO PLAYER              — spans its column, no box: the browser
 *                                 draws its own transport.
 *   - VIDEO PLAYER              — spans its column, `rounded-lg` on the
 *                                 muted ground.
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

import { cva } from 'class-variance-authority'
import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// BUTTON GROUP — container + per-item radius hint
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for a `button-group` container — the outer
 * `<div role="group">` wrapping a row of buttons. Paints the focal-ring
 * surface tone (`background`) + `radius-md` so the group reads as a single
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
 * The joining rhythm of a button-group, by orientation: a row whose adjacent
 * borders overlap by one pixel, or shadcn/ui's vertical Button Group — one
 * column, each control's inner corners squared so the stack reads as one shape.
 */
export const computeButtonGroupOrientationClasses = (
  orientation: 'horizontal' | 'vertical'
): string =>
  orientation === 'vertical'
    ? 'inline-flex flex-col isolate -space-y-px [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none'
    : 'inline-flex isolate -space-x-px'

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
 *   - `'subtle'`      — secondary link tone (`muted-foreground`) for links
 *     embedded in chrome copy (footer / navigation), resolving to full ink
 *     on hover while the resting state stays quiet.
 *   - `'destructive'` — danger-tone link (`sv-error-fg`) for the rare
 *     inline "Delete" / "Revoke" call-to-action that lives in copy.
 *
 * Every variant answers a hover with a COLOUR and nothing else — see the note
 * on {@link LINK_SHARED} for why the rule under the word is gone.
 */
export type LinkVariant = 'default' | 'subtle' | 'destructive'

const LINK_VARIANT = cva('', {
  variants: {
    variant: {
      default: ['text-primary', `hover:text-[${v('sv-primary-hover', T.primaryHover)}]`].join(' '),
      subtle: ['text-muted-foreground', 'hover:text-foreground'].join(' '),
      destructive: [
        `text-[${v('sv-error-fg', T.errorFg)}]`,
        `hover:text-[${v('sv-error-700', T.error700)}]`,
      ].join(' '),
    },
  },
})

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
  'focus-visible:decoration-ring',
].join(' ')

/**
 * What every link variant shares: the underline METRICS, the focus mark, the
 * inert treatment of a disabled anchor, and the transition.
 *
 * ─── NO HOVER UNDERLINE, AND NO PROSE MODE EITHER (THE STANDALONE-LINK RECIPE RULE clause 4) ────────
 *
 * There is no `hover:underline` here: a standalone link answers a pointer with a
 * COLOUR, not with a rule under the word. Each {@link LINK_VARIANT} carries that
 * colour, because the right one depends on the resting tone — no underline and
 * nothing in its place would be a worse affordance still.
 *
 * The rule permits an inline link INSIDE PROSE to keep its underline, which
 * reads like a second mode on {@link computeLinkClasses}. It is not one.
 * Measured live on the design-system console pages: they carry 8 to 14 links
 * each and ZERO of them sit inside a `<p>`. A `link` COMPONENT is an
 * authored, standalone affordance; a link inside a paragraph comes from the
 * markdown path, which applies none of these recipes at all. The exemption has
 * no subject here, and a mode nothing would ever pass is an API invented to
 * satisfy a sentence.
 *
 * The underline metrics (`underline-offset-4 decoration-2`) STAY: they are what
 * the focus mark below is drawn with.
 *
 * ─── AND A DISABLED ANCHOR HAS TO BE MADE INERT (the standalone-link recipe rule clause 3) ──────────
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
} = {}): string => [LINK_VARIANT({ variant: variant }), LINK_SHARED].join(' ')

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

const SIZES = { sm: 'size-3', md: 'size-4', lg: 'size-5', xl: 'size-6' }
const ICON_SIZE = cva('', { variants: { size: SIZES } })

/**
 * Icon tone vocabulary. Lucide icons inherit color via `currentColor`, so
 * the helper paints `text-*` on the SVG itself — both the stroke and the
 * fill resolve through the inherited color cascade.
 *
 *   - `'default'` — INHERITED. Takes `currentColor` from whatever it sits in.
 *   - `'muted'`   — chrome tone (`muted-foreground`). Status / leading affordances.
 *   - `'primary'` — accent tone (`primary`). Brand-call-out icons.
 *
 * ─── WHY THE DEFAULT NAMES NO COLOUR AT ALL ────────────────────────────────
 *
 * Not `foreground`, which is the right colour on a page and the WRONG one inside a
 * filled control: it OVERRIDES the fill's own foreground instead of inheriting
 * it. Measured live on the Design System console, on the attached split
 * button: with `foreground` the chevron stroked oklch(0.14 0 0) on a button filled
 * oklch(0.205 0 0) — 1.11:1, black on black — while the same button's own
 * `color` was already oklch(0.985 0 0), white. The button had it right and the
 * icon painted over it.
 *
 * Inheriting costs nothing on an ordinary page, where `currentColor` resolves
 * to the body foreground — which is `foreground`. An author naming `muted` or
 * `primary` is choosing a colour on purpose and still gets it; this default is
 * about the case where nobody chose one.
 */
export type IconTone = 'default' | 'muted' | 'primary'

const TONES = { default: 'text-current', muted: 'text-muted-foreground', primary: 'text-primary' }
const ICON_TONE = cva('', { variants: { tone: TONES } })

/**
 * Compute the default className for an `icon` component: shadcn/ui draws an
 * icon at `size-4` and never lets a flex row squeeze it (`shrink-0`), so a
 * bare `{ type: 'icon', name: 'check' }` renders a 16px glyph that keeps its
 * size beside a long label.
 *
 * `sized: false` drops the size class. A class beats the SVG's own
 * `width`/`height` attributes at the cascade, so an author who passes a pixel
 * `props.size` (and no `iconSize`) must get no size class, or their size
 * would be drawn at 16px whatever they wrote.
 */
export const computeIconClasses = ({
  size = 'md',
  tone = 'default',
  sized = true,
}: {
  readonly size?: IconSize
  readonly tone?: IconTone
  readonly sized?: boolean
} = {}): string =>
  [sized ? ICON_SIZE({ size: size }) : '', 'shrink-0', ICON_TONE({ tone: tone })]
    .filter(Boolean)
    .join(' ')

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
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
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
 * variant: `rounded-lg object-cover`, as shadcn/ui's blocks draw a picture.
 * The renderer's `avatar` / `thumbnail` / `hero` variant branches each
 * apply their own radius (full / md / xl), so this helper only owns the
 * BARE `default` variant. No variant draws a border.
 */
export const computeImageClasses = ({
  radius = 'lg',
  fit = 'cover',
}: {
  readonly radius?: ImageRadius
  readonly fit?: ImageFit
} = {}): string => [IMAGE_RADIUS[radius], IMAGE_FIT[fit]].filter(Boolean).join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// IFRAME — bordered embed frame
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for an `iframe` component: the frame spans
 * its column with rounded-lg corners and a border, on the page background,
 * so a blank frame still has an edge before the embed loads.
 */
export const computeIframeClasses = (): string => 'w-full rounded-lg border bg-background'

// ──────────────────────────────────────────────────────────────────────────────
// AUDIO + VIDEO — media players
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for an `audio` component. The browser draws
 * its own transport controls; the player only spans its column (`<audio>` is
 * inline by browser convention, which collapses awkwardly in a flex layout)
 * and Sovrium draws no box of its own around it.
 */
export const computeAudioPlayerClasses = (): string => 'block w-full'

/**
 * Compute the default className for a `video` component: it spans its column
 * with rounded-lg corners on the muted ground, which shows while the poster
 * or first frame loads.
 */
export const computeVideoPlayerClasses = (): string => 'block w-full rounded-lg bg-muted'

/**
 * Compute the default className for a `qr-code` host: it takes only the room
 * its symbol needs, on a white quiet zone with rounded corners and a faint
 * ring. The quiet zone stays white in the dark scheme, because a scanner
 * needs dark modules on a light ground.
 *
 * `w-fit` keeps it to its symbol in any parent: an `inline-flex` box is still
 * stretched to the full width of a `flex-col` column without it.
 *
 * A symbol with no `size` carries only a `viewBox`, so it has no width of its
 * own to hug: the host then takes a default width (`w-44`, a 160px symbol
 * inside the padding) and the symbol fills it, which leaves an author's own
 * width class on the host free to size it.
 */
export const computeQrCodeClasses = ({ sized = true }: { readonly sized?: boolean } = {}): string =>
  [
    'inline-flex rounded-lg bg-white p-2 ring-1 ring-foreground/10',
    sized ? 'w-fit' : 'w-44 [&>svg]:w-full',
  ]
    .filter(Boolean)
    .join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// KBD — base-nova's `KbdGroup` (the chord) and `Kbd` (one key)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The chord (`data-slot="kbd-group"`). `align-middle` is Sovrium's: it keeps a
 * chord inside a sentence on the sentence's baseline.
 */
const KBD_CHORD = 'inline-flex items-center gap-1 align-middle'

/**
 * One key (`data-slot="kbd"`), base-nova's string unchanged: a muted chip,
 * borderless, in the sans face. Inside a tooltip it inverts onto the tooltip's
 * ground, which is what the `in-data-[slot=tooltip-content]` variants say.
 */
const KBD_CAP =
  "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background dark:in-data-[slot=tooltip-content]:bg-background/10 [&_svg:not([class*='size-'])]:size-3"

/** The text printed between two keys — never itself a key. */
const KBD_SEPARATOR = 'text-xs text-muted-foreground select-none'

/** Compute the className for a `kbd` chord's wrapper. */
export const computeKbdChordClasses = (): string => KBD_CHORD

/** Compute the className for one `<kbd>` key. */
export const computeKbdCapClasses = (): string => KBD_CAP

/** Compute the className for the plain text between two keys. */
export const computeKbdSeparatorClasses = (): string => KBD_SEPARATOR
