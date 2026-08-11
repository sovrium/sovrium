/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the forms-cluster surfaces
 *: `form` (the outer card chrome wrapping a form composition) and
 * the file-upload `dropzone` surface (the dashed-border drop target shipped by
 * `renderFileUploadIsland` when `dropZone: true`). Schema authors who write
 * the bare `{ type: 'form' }` or `{ type: 'file-upload', dropZone: true }`
 * get a complete, opinionated chrome — bg + border + radius + shadow +
 * padding for the form card; dashed-border surface + centered icon stack for
 * the dropzone — with zero theme-layer dependency.
 *
 * The recipe mirrors the buttons + inputs + selects + toggles + numeric +
 * date + overlays + disclosure + feedback + navigation + layout slices
 * (commits 02b2f35f3 + 571ae53ce + 5527660bc + 000f835d7 + 386e9dc35 +
 * 3d35fad9a + 0de6ded2a + 1b3f551a7 + e7e4e4421 + dd831e792 + 6b20cb52b).
 * Layout / spacing classes (`flex flex-col`, `gap-2`, `p-4`) and structural
 * classes (`items-center`, `border-2`, `border-dashed`) stay raw — they
 * encode structure, not color — while every color / border-color / radius /
 * shadow class goes through {@link withVarFallback} so `app.theme.*`
 * overrides still win at the CSS cascade layer (`var(--sv-X)` resolves the
 * override first, falling back to the inline OKLCH literal).
 *
 * Subparts covered:
 *
 *   - FORM CARD              — the `<form>` outer card chrome (bg + border +
 *                              radius + shadow + p-5 + flex-col + gap-3)
 *                              wrapping an entire form composition (sign-in,
 *                              create-record, file-upload section). The
 *                              canonical "give me a beautiful form container
 *                              with zero config" surface; consumers reach
 *                              for this whenever they need a self-contained
 *                              boxed form composition on top of the page
 *                              chrome
 *   - DROPZONE SURFACE       — the dashed-border drop-target chrome for
 *                              `file-upload` islands carrying `dropZone:
 *                              true`. `border-2 border-dashed` is the visual
 *                              hint that distinguishes this from a regular
 *                              surface; the muted subtle background pulls
 *                              the eye toward the upload affordance
 *   - DROPZONE ICON          — the large emoji/icon tone for the centered
 *                              dropzone icon (text-3xl, muted-fg). Centered
 *                              affordance icons sit at the top of the
 *                              dropzone stack
 *   - DROPZONE PRIMARY TEXT  — the primary "Drop files here or click to
 *                              browse" copy (text-sm, default fg) sitting
 *                              below the icon; reads as the actionable
 *                              instruction
 *   - DROPZONE HINT TEXT     — the secondary "PNG, JPG, or PDF up to 10 MB"
 *                              constraint hint (text-xs, muted-fg) sitting
 *                              below the primary text; reads as accessory
 *                              chrome
 *
 * Intentionally NOT covered (this slice ships smaller than buttons on
 * purpose — surfaces without a production renderer or with chrome that
 * already lives in an island file are out of scope):
 *
 *   - `field` wrapper        — the form-control schema has a `field` type
 *                              literal but no production renderer; wiring
 *                              defaults here without a renderer to consume
 *                              them would only land dead code. A separate
 *                              slice can land the `field` renderer + recipe
 *                              once the schema-author use case warrants it.
 *   - `crud-form` island — a full island with its own client-side state
 *                              machine; styling it needs an island-side recipe
 *                              (parallel to how `dialog` / `tooltip` islands
 *                              consume Base UI's data-state selectors) rather
 *                              than an SSR-side helper. Tracked separately.
 *                              NOTE: the sibling `auth-form` island is NO LONGER
 *                              in this exclusion list — as of the Phase P
 *                              auth-form fix it consumes the shared form-layout
 *                              contract directly (`computeFormLayoutClasses` /
 *                              `computeFormFieldClasses` /
 *                              `computeFormFieldLabelClasses`) on BOTH its SSR
 *                              skeleton (`auth-form-renderer.tsx`) and its
 *                              hydrated markup (`auth-form-island.tsx` /
 *                              `auth-form-fields.tsx`), with configurable +
 *                              localizable submit/field labels — so embedded
 *                              login forms render native and need no per-app
 *                              CSS injection.
 *   - file-row chrome        — the "existing file row" preview chrome in the
 *                              cluster fixture (file icon + filename + size
 *                              + clear `✕`) is a fixture-only mock; the real
 *                              file-row markup is owned by `FileNameList` in
 *                              the island and changes shape as upload state
 *                              evolves. Not a server-renderable surface
 *   - form-actions row       — the bottom-aligned submit/cancel button row.
 *                              Pure layout (`flex justify-end gap-2`) with
 *                              no color / border / shadow — adding a helper
 *                              would only proxy two flex utilities, so the
 *                              fixture keeps emitting them directly on the
 *                              `container` wrapper
 *
 * Helper file lives in `src/presentation/ui/sections/renderers/element-
 * renderers/` (alongside the renderers that consume it) because both
 * `renderForm` (in `interactive-renderers.tsx`) and `renderFileUploadIsland`
 * (in `form-control-renderers.tsx`) are server-rendered as part of the SSR
 * pass — the `presentation-component → presentation-island` layer boundary
 * does not apply since this is purely a same-layer helper. Mirrors the
 * location chosen for `button-default-classes.ts`,
 * `input-default-classes.ts`, `feedback-default-classes.ts`,
 * `navigation-default-classes.ts`, and `layout-default-classes.ts`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'
import { computeFormLayoutClasses } from '@/presentation/utils/design/form-layout-classes'

// Re-export the shared form-layout design contract (single source of truth in
// `presentation/utils/design/form-layout-classes.ts`) so the element-renderers
// cluster keeps a local import surface. Both form pipelines consume these.
export {
  computeFormLayoutClasses,
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
  computeFormHelpTextClasses,
  computeFormGroupClasses,
  computeFormGroupLabelClasses,
} from '@/presentation/utils/design/form-layout-classes'

// ──────────────────────────────────────────────────────────────────────────────
// FORM CARD — outer `<form>` card chrome
// ──────────────────────────────────────────────────────────────────────────────

const FORM_CARD_PADDING = 'p-5'

const FORM_SURFACE = [
  `bg-[${v('sv-bg', T.bg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  `shadow-[${v('sv-shadow-sm', T.shadowSm)}]`,
].join(' ')

/**
 * Compute the default className for a `<form>` rendered by the bare
 * `{ type: 'form' }` schema. Paints a self-contained boxed surface on
 * `sv-bg` with `sv-shadow-sm` for the "slight lift" elevation tier,
 * `sv-radius-md` rounded corners, and `p-5 flex flex-col gap-3` inner
 * rhythm so the typical "heading + fields + actions" composition lands
 * cleanly without the schema author needing to spell out the chrome.
 *
 * The recipe is intentionally close-but-not-identical to `card`: the form
 * card uses `p-5` (vs card's `p-4`) and `gap-3` (vs card's `gap-2`) to give
 * form-control rows the extra breathing room that long-form interactive
 * inputs benefit from. Author-supplied `props.className` is appended last
 * by `renderForm` so it overrides whatever the default paints (e.g. an
 * inline form that needs `flex-row` instead of `flex-col`).
 *
 * Applied via `renderForm` in `interactive-renderers.tsx`.
 */
export const computeFormClasses = (): string =>
  [FORM_CARD_PADDING, computeFormLayoutClasses(), FORM_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// FILE-UPLOAD DROPZONE — surface + icon + primary text + hint text
// ──────────────────────────────────────────────────────────────────────────────

const DROPZONE_LAYOUT = 'p-6 flex flex-col items-center gap-2'

const DROPZONE_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  'border-2 border-dashed',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
].join(' ')

/**
 * Compute the default className for the dashed-border drop-target wrapper
 * inside `renderFileUploadIsland` when `dropZone: true`. The `border-2
 * border-dashed` is the visual signal that distinguishes this from a regular
 * surface — schema authors who switch on `dropZone` are expecting the
 * "scuffed" drop-target look without spelling it out.
 *
 * The subtle background (`sv-bg-subtle`) pulls focus to the dropzone
 * relative to its enclosing form card (`sv-bg`); the muted border
 * (`sv-border`) keeps the chrome quiet so the iconography + copy carry the
 * affordance. Layout (`p-6 flex flex-col items-center gap-2`) centers the
 * icon + primary text + hint text stack vertically and horizontally.
 */
export const computeFileUploadDropzoneClasses = (): string =>
  [DROPZONE_LAYOUT, DROPZONE_SURFACE].join(' ')

const DROPZONE_ICON_CLASSES = [
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  'text-3xl leading-none',
].join(' ')

/**
 * Compute the default className for the centered icon at the top of the
 * dropzone stack. `text-3xl leading-none` sizes the icon to anchor the
 * dropzone visually; the muted foreground tone keeps it from competing
 * with the primary copy below.
 */
export const computeFileUploadDropzoneIconClasses = (): string => DROPZONE_ICON_CLASSES

const DROPZONE_TEXT_CLASSES = [`text-[${v('sv-fg', T.fg)}]`, 'text-sm'].join(' ')

/**
 * Compute the default className for the primary "Drop files here or click
 * to browse" copy inside a dropzone surface. Default foreground tone +
 * `text-sm` makes the actionable instruction read as the focal copy
 * (stronger than the muted hint below it but lighter than the surrounding
 * form labels).
 */
export const computeFileUploadDropzoneTextClasses = (): string => DROPZONE_TEXT_CLASSES

const DROPZONE_HINT_CLASSES = [`text-[${v('sv-fg-muted', T.fgMuted)}]`, 'text-xs'].join(' ')

/**
 * Compute the default className for the secondary constraint hint
 * ("PNG, JPG, or PDF up to 10 MB") at the bottom of the dropzone stack.
 * Muted foreground + `text-xs` keeps the hint as accessory chrome — it
 * reads as supporting info, not actionable instruction.
 */
export const computeFileUploadDropzoneHintClasses = (): string => DROPZONE_HINT_CLASSES
