/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type CSSProperties } from 'react'
import { TOKENS } from './css-var'

/**
 * Shared form-layout design contract — the SINGLE source of truth for how every
 * Sovrium form lays out its fields, regardless of which renderer produces it.
 *
 * Three render contexts consume these helpers, so they all paint the same
 * vertical rhythm + label typography by default (the operator's "embedded and
 * standalone forms must share the same design system" requirement):
 *
 *   - EMBEDDED page forms — `{ type: 'form' }` carrying a CRUD/auth/automation
 *     `action`. SSR skeleton via `crud-form-renderer.tsx` + `crud-field-shell.tsx`,
 *     hydrated by the `crud-form` island.
 *   - STANDALONE forms — the `app.forms[]` feature served at `GET /forms/:name`,
 *     rendered by `presentation/rendering/forms/form-renderer.tsx` +
 *     `form-field-elements.tsx`.
 *   - The boxed bare `{ type: 'form' }` card — `computeFormClasses()` in
 *     `forms-default-classes.ts` composes these layout classes under its surface
 *     chrome (bg + border + radius + shadow).
 *
 * This module lives in `presentation/utils` (NOT `element-renderers`) on purpose:
 * `[internal ref]` lets `presentation-component`,
 * `presentation-rendering`, AND `presentation-island` each import
 * `presentation-util` — so a util-layer home is the one location reachable by all
 * three render contexts with zero boundary friction. `forms-default-classes.ts`
 * re-exports these for the element-renderers cluster's existing import sites.
 *
 * RHYTHM CONTRACT (a deliberate 3.5:1 hierarchy), converged on the canvas in
 * wave R-E:
 *   - inter-field gap = `gap-3.5` (14px) — space BETWEEN stacked fields.
 *     `spec-form.mjs:9` draws every form body as `gap:14px`, single-column and
 *     two-column alike.
 *   - intra-field gap = `gap-1` (4px) — space between a field's label and its
 *     control. `variants.mjs:32` `fieldRow` is `gap:4px`. A quarter of the
 *     inter-field gap, so a field reads as one unit at a glance rather than as
 *     three loosely stacked lines.
 *
 * TYPE CONTRACT, also from `variants.mjs:32`: label **12px/500** (`text-sm
 * font-medium`), help **11px** (`text-xs`) muted. Both were one rung too large
 * before R-E — the label at 14px competed with the 13px control it introduces,
 * which inverts the hierarchy the field exists to express.
 *
 * All classes are STRUCTURE/SPACING + theme-token utilities (`text-foreground`,
 * `text-foreground-muted`) — never raw colors — so `app.design.*` overrides still
 * win at the CSS cascade. That also keeps this module out of `RECIPE_DIRS`
 * territory: every class here is a NAMED utility, so it needs no arbitrary-value
 * safelist entry to reach the stylesheet.
 */

/**
 * Layout className for the `<form>` element itself: a vertical flex stack with
 * the inter-field `gap-3` rhythm. Layout ONLY (no bg/border/shadow/padding) so it
 * is safe on embedded forms nested inside author chrome (e.g. a bordered card in
 * `apps/cloud`) AND on standalone full-page forms. Author `className` is appended
 * after this by every consumer, so per-form overrides (e.g. `flex-row`) still win.
 *
 * `w-full` is load-bearing: a centered card (`flex flex-col items-center`) makes
 * the form a flex ITEM that would otherwise shrink-wrap to its widest control's
 * intrinsic width (a bare `<input>` ≈ 179px) instead of filling the card. `w-full`
 * forces the form to span its container so fields and the submit button read as a
 * single full-bleed column — matching the design-system auth-layout scene.
 */
export const computeFormLayoutClasses = (): string => 'flex w-full flex-col gap-3.5'

/**
 * Wrapper className for a single field's label→control stack (`gap-1`). Used by
 * the CRUD field shell and the standalone field elements so both pipelines align
 * the label directly above its input with identical spacing.
 */
export const computeFormFieldClasses = (): string => 'flex w-full flex-col gap-1'

/**
 * The canonical control SURFACE — what an `<input>`, `<select>` or `<textarea>`
 * looks like when a form paints one itself.
 *
 * Four call sites each carried this string as their own `CONTROL_CLASS`, three
 * of them announcing in a comment that it was "the canonical input surface" or
 * that it "mirrors the crud-form CONTROL_CLASS". A comment claiming a mirror is
 * the marker of one nothing enforces: the four copies were byte-identical only
 * because nobody had yet changed one, and the next change to the input surface
 * would have had to find all four for the four to stay one design system.
 *
 * It belongs HERE rather than beside `computeInputDefaultClasses`, which is a
 * different thing wearing a similar name: that one is the prestyled default for
 * the schema `input` COMPONENT and resolves its colours through
 * `withVarFallback` to OKLCH literals, so it needs an arbitrary-value safelist
 * entry. This is the surface a hand-rolled form control paints on, and it is
 * named utilities and theme tokens only — this module's stated contract, and
 * why it stays out of `RECIPE_DIRS` territory.
 *
 * A caller that needs the control to fill its column appends `w-full` itself:
 * that is a layout decision belonging to the field, not to the surface.
 */
export const computeFormControlClasses = (): string =>
  'border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md border px-3 py-2 text-md focus:ring-1 focus:outline-none'

/**
 * Typography className for a field's label text. `text-sm font-medium` (12px/500)
 * on the default foreground tone — the standard form-label weight across
 * Sovrium, one rung BELOW the 13px control it introduces so the label reads as
 * the caption and the value reads as the content.
 */
export const computeFormFieldLabelClasses = (): string => 'text-foreground text-sm font-medium'

/**
 * Typography className for a field's help/hint text (the `<small>` under a
 * control). Muted foreground + `text-xs` (11px) so it reads as accessory chrome,
 * not a primary label.
 */
export const computeFormHelpTextClasses = (): string => 'text-foreground-muted text-xs'

/**
 * Typography className for a field's validation message — the same 11px rung as
 * the help text it replaces, on the error foreground (`#a12b1a`) rather than the
 * muted one. `variants.mjs:32` swaps exactly this one property when a field is
 * drawn Invalid: the message does not grow, move or gain an icon, it changes
 * colour. Keeping the metrics identical is what stops the field reflowing as it
 * goes from valid to invalid.
 */
export const computeFormFieldErrorClasses = (): string => 'text-error-fg text-xs'

/**
 * Typography className for the required marker appended to a label.
 *
 * `text-error-solid` (`#c13520`), not the softer `error-fg` the message uses:
 * `spec-form.mjs:21` draws the asterisk on the solid tone because it is a mark
 * rather than a sentence — a single glyph needs the stronger value to register
 * at 12px, while a whole line of text at that value would shout.
 */
export const computeFormRequiredMarkClasses = (): string => 'text-error-solid'

// ──────────────────────────────────────────────────────────────────────────────
// AUTH FEEDBACK BANNER — the form-level result region (`<div data-error>`)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * LAYOUT className for the auth form's result banner (error OR success). Pure
 * chrome — rounded, padded, small text — so a wrong-password / reset-link
 * message reads as a real operator-grade banner instead of the near-invisible
 * default-foreground text it was before. The tone (bg + text color) is applied
 * separately via {@link AUTH_ERROR_BANNER_STYLE} / {@link AUTH_SUCCESS_BANNER_STYLE}.
 *
 * Every token here is a NAMED utility present in `BUILTIN_CSS_CANDIDATES`
 * (`rounded-md` / `px-3` / `py-2` / `text-md`) so it compiles under the
 * scan-free CSS pipeline — the exact discipline the `p-7` login-card bug
 * violated. Color is deliberately NOT a class: the theme's error/success tones
 * live in the `--sv-error-*` / `--sv-success-*` custom properties (what the
 * canonical alert recipe uses), and the arbitrary utilities that read them are
 * not in the candidate set — so an inline style with those vars (below) is the
 * one way to paint the correct tone without silently no-op'ing.
 */
export const computeAuthFeedbackBannerClasses = (): string => 'rounded-md px-3 py-2 text-md'

/**
 * Inline tone for the ERROR banner. Reads the theme's error tokens
 * (`--sv-error-bg` / `--sv-error-fg`) with the design-system default fallbacks
 * pulled from the canonical {@link TOKENS} catalog (`errorBg` / `errorFg`) — so
 * a theme override still wins while a theme that leaves them unset still paints a
 * correct red-tinted banner, and the fallback can never silently drift from the
 * design system. Inline (not a class) so it can never fall victim to the
 * scan-free candidate set; a raw `var()` string (not {@link withVarFallback})
 * because that helper rewrites spaces to `_` for Tailwind arbitrary-value
 * classes, which would be invalid inside an inline `style`. Module constant for
 * referential stability (react-perf: no per-render object allocation).
 */
export const AUTH_ERROR_BANNER_STYLE: CSSProperties = {
  backgroundColor: `var(--sv-error-bg, ${TOKENS.errorBg})`,
  color: `var(--sv-error-fg, ${TOKENS.errorFg})`,
}

/**
 * Inline tone for the SUCCESS banner (e.g. a password-reset link sent). Reads
 * the theme's success tokens (`--sv-success-bg` / `--sv-success-fg`) with the
 * alert recipe's `success`-variant fallbacks, sourced from the {@link TOKENS}
 * catalog (`successBg` / `successFg`). Consumer sets `role="status"` for polite
 * announcement.
 */
export const AUTH_SUCCESS_BANNER_STYLE: CSSProperties = {
  backgroundColor: `var(--sv-success-bg, ${TOKENS.successBg})`,
  color: `var(--sv-success-fg, ${TOKENS.successFg})`,
}

// ──────────────────────────────────────────────────────────────────────────────
// GROUPED-SECTION SPACING
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Wrapper className for a `fieldGroups` `<section>`: the same `flex flex-col
 * gap-3` inter-field rhythm as an ungrouped form. Reusing the identical rhythm
 * (rather than tightening inside groups) keeps grouped and ungrouped forms
 * visually consistent — the section label, not a denser gap, is what signals
 * cohesion. The `<form>`'s own `gap-3` then separates one section from the next.
 */
export const computeFormGroupClasses = (): string => 'flex flex-col gap-3.5'

/**
 * Typography className for a `fieldGroups` `<h2>` section label — an uppercase
 * eyebrow, not a heading.
 *
 * `spec-form.mjs:19` draws `groupLabel` as 11px/500 uppercase on `0.04em`
 * tracking in the muted tone. That is a deliberate inversion of what shipped
 * (`text-lg font-semibold`, larger and heavier than everything it introduces):
 * a group label is a divider with a name on it, so it should separate without
 * out-ranking the fields. The old rule made a two-group form read as two
 * documents. The same eyebrow shape already carries the sidebar's group
 * headings (`sidebar-default-classes.ts:89`) and the design console's section
 * labels, so a form section now looks like every other section in Sovrium.
 *
 * `pt-1` reproduces the drawing's `padding-top:4px`, which buys the eyebrow a
 * little air above it without needing a second gap value in the stack.
 */
export const computeFormGroupLabelClasses = (): string =>
  'text-foreground-muted pt-1 text-xs font-medium tracking-[0.04em] uppercase'
