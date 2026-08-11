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
 * RHYTHM CONTRACT (a deliberate 2:1 hierarchy):
 *   - inter-field gap = `gap-3` (0.75rem) — space BETWEEN stacked fields.
 *   - intra-field gap = `gap-1.5` (0.375rem) — space between a field's label and
 *     its control. Half the inter-field gap so a field reads as one unit while
 *     adjacent fields stay clearly separated.
 *
 * All classes are STRUCTURE/SPACING + theme-token utilities (`text-foreground`,
 * `text-foreground-muted`) — never raw colors — so `app.theme.*` overrides still
 * win at the CSS cascade.
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
export const computeFormLayoutClasses = (): string => 'flex w-full flex-col gap-3'

/**
 * Wrapper className for a single field's label→control stack (`gap-1.5`). Used by
 * the CRUD field shell and the standalone field elements so both pipelines align
 * the label directly above its input with identical spacing.
 */
export const computeFormFieldClasses = (): string => 'flex w-full flex-col gap-1.5'

/**
 * Typography className for a field's label text. `text-sm font-medium` on the
 * default foreground tone — the standard form-label weight across Sovrium.
 */
export const computeFormFieldLabelClasses = (): string => 'text-foreground text-sm font-medium'

/**
 * Typography className for a field's help/hint text (the `<small>` under a
 * control). Muted foreground + `text-xs` so it reads as accessory chrome, not a
 * primary label.
 */
export const computeFormHelpTextClasses = (): string => 'text-foreground-muted text-xs'

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
 * (`rounded-md` / `px-3` / `py-2` / `text-sm`) so it compiles under the
 * scan-free CSS pipeline — the exact discipline the `p-7` login-card bug
 * violated. Color is deliberately NOT a class: the theme's error/success tones
 * live in the `--sv-error-*` / `--sv-success-*` custom properties (what the
 * canonical alert recipe uses), and the arbitrary utilities that read them are
 * not in the candidate set — so an inline style with those vars (below) is the
 * one way to paint the correct tone without silently no-op'ing.
 */
export const computeAuthFeedbackBannerClasses = (): string => 'rounded-md px-3 py-2 text-sm'

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
export const computeFormGroupClasses = (): string => 'flex flex-col gap-3'

/**
 * Typography className for a `fieldGroups` `<h2>` section label. `text-base
 * font-semibold` out-ranks a field label (`text-sm font-medium`) on both size
 * and weight, so a section header reads as a clear boundary above the fields it
 * introduces — on the default `text-foreground` tone.
 */
export const computeFormGroupLabelClasses = (): string => 'text-foreground text-base font-semibold'
