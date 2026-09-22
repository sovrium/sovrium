/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for the SSR forms cluster: the `form`
 * card chrome and the `input-group` seam.
 *
 * Schema authors who write a bare `{ type: 'form' }` or an `input-group` get a
 * complete, opinionated chrome with zero theme-layer dependency. Layout /
 * spacing classes (`flex flex-col`, `gap-3.5`, `p-4`) and structural classes
 * (`items-stretch`, `border-l-0`) stay raw — they encode structure, not colour
 * — while every colour / border-colour / radius class goes through
 * {@link withVarFallback} so `app.design.*` overrides still win at the CSS
 * cascade layer.
 *
 * Subparts covered:
 *
 *   - FORM CARD   — the `<form>` outer card chrome (ground + border + radius +
 *                   padding + the shared layout rhythm) wrapping a whole form
 *                   composition. The canonical "give me a form container with
 *                   zero config" surface.
 *   - INPUT-GROUP — the label, the row, and the squared seam between an addon
 *                   and the field it qualifies.
 *
 * MOVED OUT in wave R-E: the `file-upload` dropzone recipe now lives in
 * `presentation/utils/recipes/file-upload-default-classes.ts`. It had to move,
 * not merely be tidied — this directory is `presentation-component`, which
 * `[internal ref]` forbids an island from importing, so the
 * hydrated `FileUploadIsland` could never consume the recipe and painted a
 * hand-written twin instead. The two disagreed on every value, and the control
 * resized on mount. The same reasoning applies to any future part of this file
 * that an island also needs to draw.
 *
 * Also NOT covered here, and each for its own reason:
 *
 *   - `field` wrapper   — has a real renderer now (`field-renderer.tsx`), but
 *                         it paints from the SHARED contract in
 *                         `presentation/utils/design/form-layout-classes.ts`,
 *                         which the standalone form pipeline and the CRUD field
 *                         shell already use. A second definition here would be
 *                         a third form-field vocabulary.
 *   - `crud-form` island — a full island with its own client-side state
 *                         machine; its chrome is island-side by construction.
 *   - form-actions row  — pure layout (`flex justify-end gap-2`), no colour or
 *                         border, so a helper would only proxy two flex
 *                         utilities.
 *
 * This file stays in `element-renderers/recipes/` because both consumers
 * (`renderForm` and the `input-group` component) are server-rendered in the
 * same layer — the boundary that forced the dropzone out does not apply.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { computeFormLayoutClasses } from '@/presentation/design/form-layout-classes'

// Re-export the shared form-layout design contract (single source of truth in
// `presentation/utils/design/form-layout-classes.ts`) so the element-renderers
// cluster keeps a local import surface. Both form pipelines consume these.
export {
  computeFormLayoutClasses,
  computeFormControlClasses,
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
  computeFormHelpTextClasses,
  computeFormGroupClasses,
  computeFormGroupLabelClasses,
} from '@/presentation/design/form-layout-classes'

// ──────────────────────────────────────────────────────────────────────────────
// FORM CARD — outer `<form>` card chrome
// ──────────────────────────────────────────────────────────────────────────────

const FORM_CARD_PADDING = 'p-4'

// A panel on the page carries NO shadow: the drawings reserve elevation for
// surfaces that genuinely float — a menu, a popover, a dialog — and bound
// everything else with a border. A form does not float; it is the page.
const FORM_SURFACE = [
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('radius-md', T.radiusMd)}]`,
].join(' ')

/**
 * Compute the default className for a `<form>` rendered by the bare
 * `{ type: 'form' }` schema. Paints a self-contained boxed surface on
 * `sv-bg`, bounded by its border rather than lifted by a shadow — a form is
 * in the page, not above it — with `radius-md` corners and a
 * `p-4 flex flex-col gap-3.5` inner
 * rhythm so the typical "heading + fields + actions" composition lands
 * cleanly without the schema author needing to spell out the chrome.
 *
 * Wave R-E converges it on `spec-form.mjs`: `p-4` (16px) of padding around a
 * `gap-3.5` (14px) stack, on the RAISED ground rather than the page ground.
 * The raised ground is the load-bearing change — a form is a place to type,
 * and the drawings make every such surface a shade lighter than the page it
 * sits on so the eye finds it without a shadow. The card previously drew
 * `p-5` with an argument about "breathing room for long-form inputs"; 16px is
 * the padding every other framed surface in the system uses, and a form that
 * pads differently from a card reads as a different kind of object. Author-supplied `props.className` is merged in via
 * `resolveClasses`
 * by `renderForm` so it overrides whatever the default paints (e.g. an
 * inline form that needs `flex-row` instead of `flex-col`).
 *
 * Applied via `renderForm` in `interactive-renderers.tsx`.
 */
export const computeFormClasses = (): string =>
  [FORM_CARD_PADDING, computeFormLayoutClasses(), FORM_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// INPUT-GROUP — the seam between an addon and the field it qualifies
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Which edges of the inner field have something attached to them.
 *
 * The pair, not the halves: an addon CHANGES the box it sits beside — the field
 * loses the corner radius they share — so the rule is about the two of them
 * together. That is the whole argument for `input-group` being a type rather
 * than a prop on `input`; see the schema's module docstring.
 */
export interface InputGroupSeam {
  /** A `prefix` sits before the field. */
  readonly leading: boolean
  /** A `suffix` or an `action` sits after it. */
  readonly trailing: boolean
}

/** The label above the group, bound to the field and never to an addon. */
export const computeInputGroupLabelClasses = (): string =>
  ['mb-1 block text-sm font-medium', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * The row holding the addons and the field.
 *
 * `items-stretch` with NO gap is what makes the seam a seam: the two boxes'
 * edges touch, which is the fact `[internal ref]`
 * measures. Two elements a pixel apart are not a group, however alike their
 * borders.
 */
export const computeInputGroupRowClasses = (): string => 'flex w-full items-stretch'

/** The outer wrapper — the label's block and the row beneath it. */
export const computeInputGroupRootClasses = (): string => 'flex w-full flex-col'

// Height and type step only — the horizontal padding differs by role and must
// not be shared: `kit.mjs:122` draws the field at 12px (the `.input` inset) and
// the addon at 10px, because an addon is a mark beside a value rather than a
// box you type in.
const GROUP_CONTROL_HEIGHT = 'h-9 text-base'

/**
 * The four corners of a box in a group, squared wherever something is attached.
 *
 * ─── FOUR SIDE-SCOPED UTILITIES, NEVER THE SHORTHAND ───────────────────────
 *
 * `rounded-[…]` plus a `rounded-l-none` override compiles to the same two
 * declarations only if Tailwind emits them in the order one hopes. Four
 * explicit corners have no order to get wrong, and the squared seam is a
 * criterion measured to the pixel rather than a matter of taste.
 *
 * ─── AND EVERY `v(…)` IS WRITTEN OUT AT THE CALL SITE ──────────────────────
 *
 * Hoisting the radius into a `const` and interpolating THAT reads better and
 * silently drops the class from the shipped stylesheet:
 * `arbitrary-var-safelist.ts` recovers these runtime-composed classes by
 * regex-matching `prop-[${v('VAR', T.Y)}]` in the recipe SOURCE, and an
 * indirection through a local is not that shape. Measured: with the const, the
 * compiled CSS carried no `rounded-tl-[var(--radius-base,4px)]` rule at all and
 * an unattached field rendered with square corners.
 */
const corners = ({ leading, trailing }: InputGroupSeam): string =>
  [
    leading
      ? 'rounded-tl-none rounded-bl-none'
      : `rounded-tl-[${v('radius-base', T.radiusBase)}] rounded-bl-[${v('radius-base', T.radiusBase)}]`,
    trailing
      ? 'rounded-tr-none rounded-br-none'
      : `rounded-tr-[${v('radius-base', T.radiusBase)}] rounded-br-[${v('radius-base', T.radiusBase)}]`,
  ].join(' ')

/**
 * The inner `<input>`.
 *
 * Deliberately NOT `computeInputDefaultClasses()` plus an override. That recipe
 * paints the radius with the `rounded-[…]` shorthand, and appending
 * `rounded-l-none` to it leaves the outcome to Tailwind's emission order — for
 * a value a spec measures to the pixel. The surface tokens are the same ones an
 * ordinary `input` paints, so the two still read as one control.
 */
export const computeInputGroupFieldClasses = (seam: InputGroupSeam): string =>
  [
    `block w-full min-w-0 px-3 ${GROUP_CONTROL_HEIGHT}`,
    'border',
    corners(seam),
    `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `border-[${v('sv-border-strong', T.borderStrong)}]`,
    `placeholder:text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
    `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  ].join(' ')

/**
 * Is this addon a MARK rather than a word?
 *
 * A word is read; a mark is recognised. `kg`, `https://`, `.sovrium.com` are
 * sentences the reader finishes — they belong one rung below the value, where
 * they qualify without competing with it. `⌕` is a picture: nothing about it is
 * read, and at the rung below the value there is not enough of it left to
 * recognise. Founder, on the search glyph leading a field: _"il est tout petit,
 * on ne le voit pas trop — il faut quelque chose de plus visible et de plus
 * assumé"_.
 *
 * The test is one code point in Unicode's `So` — "symbol, other", which is the
 * pictographic repertoire and nothing else. Deliberately NOT `\p{S}` at large:
 * that would sweep in `Sc` (`€`, `$`) and `Sm` (`+`), and a currency sign or a
 * leading plus IS read with the value beside it — they are the exact examples
 * the rung-below rule was written for. A mark is what the system draws as an
 * icon, so it takes the size the system draws icons at.
 */
const isMark = (content: string | undefined): boolean =>
  content !== undefined && /^\p{So}$/u.test(content)

/**
 * A leading or trailing addon.
 *
 * `border-r-0` / `border-l-0` on the joined edge rather than a negative margin:
 * the two boxes must touch to the pixel, and a pull-back would put the seam a
 * pixel out on whichever side rounds first. Inert by construction — an addon is
 * a label, never a control — which is what lets it be a plain string.
 *
 * `content` is the addon's own text, and it is read for ONE decision: whether
 * this is a mark or a word (see {@link isMark}). Passing it is what lets the
 * glyph grow without moving every unit and scheme in every app with it — the
 * field it qualifies keeps the step an ordinary `input` uses either way, which
 * is the thing a blanket bump would have broken.
 */
export const computeInputGroupAddonClasses = ({
  side,
  content,
}: {
  readonly side: 'leading' | 'trailing'
  readonly content?: string
}): string =>
  [
    `inline-flex shrink-0 items-center whitespace-nowrap px-2.5 ${GROUP_CONTROL_HEIGHT}`,
    'border',
    side === 'leading' ? 'border-r-0' : 'border-l-0',
    corners(
      side === 'leading' ? { leading: false, trailing: true } : { leading: true, trailing: false }
    ),
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
    `border-[${v('sv-border-strong', T.borderStrong)}]`,
    // A WORD addon is a unit, a currency mark, a scheme — a qualifier, not a
    // value. `spec-fields`/`kit.mjs:122` draw it one rung below the field it
    // labels so the value stays the thing you read. Both override the 13px in
    // GROUP_CONTROL_HEIGHT, which the field keeps.
    //
    // A MARK takes `text-lg` — 16px, the box every specimen on the console's
    // `icon` page draws — because it is not on the type ladder at all. It is a
    // glyph, and glyphs in this system are 16px.
    isMark(content) ? 'text-lg' : 'text-sm',
  ].join(' ')

/** The control attached to the trailing edge — a link, with somewhere to go. */
export const computeInputGroupActionClasses = (): string =>
  [
    `inline-flex shrink-0 items-center whitespace-nowrap px-3 ${GROUP_CONTROL_HEIGHT}`,
    'border border-l-0',
    corners({ leading: true, trailing: false }),
    // The secondary BUTTON surface, not the addon's well: `variants.mjs:149`
    // draws the trailing action as a `btn-sec` because it is the one part of a
    // group you can press. Painting it like the inert addon beside it made the
    // two indistinguishable, so nothing said which half was clickable.
    `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
    `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `border-[${v('sv-border-strong', T.borderStrong)}]`,
    'text-base font-medium no-underline',
  ].join(' ')
