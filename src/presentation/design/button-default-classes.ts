/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the `button` component.
 *
 * Every variant × size × state combination produces a Tailwind className string
 * with inline OKLCH var-fallback expressions so a schema author who writes the
 * bare `{ type: 'button', text: 'Save' }` gets a complete, opinionated button —
 * focus ring, accent border, flat inline surface — with zero theme-layer
 * dependency.
 *
 * The recipe mirrors the `uiKitButton` fixture in
 * `[internal ref]`. Keeping the recipe here makes
 * the default design land in the PRODUCTION renderer — the fixture's
 * `uiKitButton` is a thin wrapper around the schema, not the source of styling.
 *
 * Layout / spacing classes (`h-8 px-3 py-1.5`) stay as raw Tailwind utilities;
 * only color / radius / shadow / motion / focus classes go through
 * {@link withVarFallback} so `app.design.*` overrides still win at the CSS
 * cascade layer (var lookups resolve the emitted variable first, fall back to
 * the inline literal).
 *
 * ## Why it lives in `presentation/utils`
 * A submit button is drawn TWICE: once by an SSR renderer (`ui/sections/…` and
 * `rendering/forms/…`) and once by the hydrated island (`islands/…`).
 * `eslint-plugin-boundaries` forbids BOTH directions across that seam — an
 * island may not import from `ui/sections`, and a `ui/sections` component may
 * not import from `islands`. The only layer both may import is
 * `presentation-util` (`src/presentation/utils/**`), where `css-var.ts` already
 * lives, so this is the one home reachable from every side. Same reasoning, and
 * the same directory, as `navbar-default-classes.ts`.
 *
 * Keeping ONE copy rather than forking it per side is what guarantees the SSR
 * skeleton and the hydrated island emit byte-identical class strings, so a form
 * submit button neither reflows nor changes colour on hydration.
 *
 * ## Safelist
 * This file ends in `-default-classes.ts` and its directory
 * (`src/presentation/utils/recipes`) is registered in
 * `src/infrastructure/css/arbitrary-var-safelist.ts` (`RECIPE_DIRS`), so the
 * runtime `v(…)` template literals below are resolved and emitted to the
 * compiler's `@source inline(...)` safelist. A recipe whose arbitrary classes
 * are NOT safelisted emits no CSS rule at all and the element paints nothing —
 * so the directory move and that registration are load-bearing together.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import type { ButtonVariantSchema } from '@/domain/models/app/pages/components/button-variant'

/**
 * Schema-aligned variant vocabulary, read off `ButtonVariantSchema`
 * (`src/domain/models/app/pages/components/button-variant.ts`) rather than
 * spelled a second time, so a member added to the schema cannot be missing
 * from the recipe's `Record<ButtonVariant, …>` tables without a type error.
 * The import is type-only, so no island bundle gains the schema. The two
 * fixture-vocabulary aliases (`primary` / `base`) are NOT accepted here —
 * the dispatcher in `interactive-components.ts` always passes schema values.
 */
export type ButtonVariant = typeof ButtonVariantSchema.Type

/** Schema-aligned size vocabulary (`ComponentSizeSchema`). */
export type ButtonSize = 'sm' | 'md' | 'lg'

/** Visual state computed by the dispatcher from `loading` + `props.disabled`. */
export type ButtonState = 'default' | 'disabled' | 'loading'

export interface ButtonDefaultClassesInput {
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  readonly state?: ButtonState
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-variant color stack — flat record keeps cyclomatic complexity at 1.
//
// `link` and `fab` get bespoke recipes; the other five variants ("filled" /
// "outlined" / "subtle") share the flat-surface + motion baseline added by
// {@link computeButtonDefaultClasses}.
// ──────────────────────────────────────────────────────────────────────────────

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: [
    `bg-[${v('sv-primary', T.primary)}]`,
    `text-[${v('sv-primary-fg', T.primaryFg)}]`,
    `border-[${v('sv-primary', T.primary)}]`,
    `hover:bg-[${v('sv-primary-hover', T.primaryHover)}]`,
    `active:bg-[${v('sv-primary-active', T.primaryActive)}]`,
  ].join(' '),
  // Hover AND active both land on `error-700`, which is not a copy-paste slip.
  // The ramp's `error-600` is byte-identical to `error-solid` (`#c13520`), so
  // the previous `hover:bg-error-600` painted the button its own resting colour
  // and the variant had no hover feedback at all — measured live, not inferred.
  // `error-700` (`#a12b1a`) is the canvas' `.btn-dan-h`, and the ramp stops
  // there, so `active` has nowhere darker to go and repeats it rather than
  // pretending to a step that does not exist.
  destructive: [
    `bg-[${v('sv-error-solid', T.errorSolid)}]`,
    `text-[${v('sv-error-solid-fg', T.errorSolidFg)}]`,
    `border-[${v('sv-error-solid', T.errorSolid)}]`,
    `hover:bg-[${v('sv-error-700', T.error700)}]`,
    `active:bg-[${v('sv-error-700', T.error700)}]`,
  ].join(' '),
  // `outline` is the one variant with no counterpart on the canvas, which draws
  // a single non-primary filled button (`.btn-sec`). It is kept, and read
  // literally: the border is the whole affordance, so the fill is the page
  // rather than a raised surface — that is what distinguishes it from
  // `secondary` now that `secondary` has moved onto `.btn-sec`. The border does
  // NOT darken on hover: the canvas never moves a border colour on hover, and
  // the fill already carries the state.
  outline: [
    'bg-transparent',
    `text-[${v('sv-fg', T.fg)}]`,
    `border-[${v('sv-border-strong', T.borderStrong)}]`,
    `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  ].join(' '),
  // `.btn-sec` exactly: raised fill, strong border, well on hover, border fixed.
  secondary: [
    `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    `border-[${v('sv-border-strong', T.borderStrong)}]`,
    `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  ].join(' '),
  // `.btn-gho` rests MUTED and resolves to full ink on hover. Resting at full
  // ink made ghost and secondary read as the same emphasis with different
  // chrome; the canvas separates them by weight of text, not by border.
  ghost: [
    'bg-transparent',
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
    'border-transparent',
    `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `hover:text-[${v('sv-fg', T.fg)}]`,
  ].join(' '),
  link: [
    'bg-transparent',
    `text-[${v('sv-primary', T.primary)}]`,
    'border-transparent',
    'underline-offset-4',
    'hover:underline',
  ].join(' '),
  fab: [
    `bg-[${v('sv-primary', T.primary)}]`,
    `text-[${v('sv-primary-fg', T.primaryFg)}]`,
    `border-[${v('sv-primary', T.primary)}]`,
    `hover:bg-[${v('sv-primary-hover', T.primaryHover)}]`,
  ].join(' '),
}

// ──────────────────────────────────────────────────────────────────────────────
// Layout / spacing — pure Tailwind utilities, no var-fallbacks.
// `fab` is fixed-circular; `link` collapses padding for inline-text feel.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Type steps are NAMED RUNGS of the platform ladder, not rem literals.
 *
 * They were literals — `text-[0.8125rem]` — for a real reason: Tailwind's
 * `text-[…]` arbitrary syntax is ambiguous between a COLOR and a FONT-SIZE and
 * infers which from the value, so `text-[var(--sv-font-size-sm,…)]` resolved the
 * font-size candidate as a colour, beat the real `text-[var(--sv-fg,…)]` and
 * painted the element browser-default black.
 * `text-[length:var(…)]` disambiguates but hides the class from the scanner in
 * `infrastructure/css/arbitrary-var-safelist.ts`, so it would go missing from the
 * compiled binary's corpus instead.
 *
 * Neither trap applies to a named rung. The platform ladder emits Tailwind's
 * own `--text-*` namespace, so `text-base` IS 13px and the utility carries size
 * and leading together, and the rung moves when the ladder moves — no test has
 * to pin the three sizes as literals by hand.
 *
 * The mapping is the canvas': `.btn-sm` 12px, `.btn` 13px, `.btn-lg` 14px.
 */
const SIZE_CLASS_DEFAULT: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 py-1 text-sm',
  md: 'h-8 px-3 py-1.5 text-base',
  lg: 'h-10 px-4 py-2 text-md',
}

const SIZE_CLASS_LINK: Record<ButtonSize, string> = {
  sm: 'h-auto p-0 text-sm',
  md: 'h-auto p-0 text-base',
  lg: 'h-auto p-0 text-md',
}

const sizeClasses = (size: ButtonSize, variant: ButtonVariant): string => {
  if (variant === 'fab') return 'h-14 w-14 p-0'
  if (variant === 'link') return SIZE_CLASS_LINK[size]
  return SIZE_CLASS_DEFAULT[size]
}

const FOCUS_CLASS = [
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  'focus-visible:ring-offset-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  `focus-visible:ring-offset-[${v('sv-bg', T.bg)}]`,
].join(' ')

const STATE_CLASS: Record<ButtonState, string> = {
  default: '',
  disabled: 'opacity-50 cursor-not-allowed',
  loading: 'opacity-75 cursor-progress',
}

const MOTION_DEFAULT = 'transition-[background-color,border-color] duration-150'

/**
 * A flat surface carries NO shadow class at all, and that is deliberate rather
 * than an omission.
 *
 * `shadow-[${v('shadow-none', T.shadowNone)}]` silently removes the keyboard
 * focus ring from every Sovrium button. Three facts compose into it, and the
 * middle one is the trap:
 *
 *  1. `--sv-shadow-none` is emitted NOWHERE — the theme layer declares
 *     `--shadow-none` — so the reference always falls through to its literal
 *     fallback, `none`;
 *  2. Tailwind v4 composes `box-shadow` from five custom properties
 *     (`box-shadow: var(--tw-inset-shadow), …, var(--tw-ring-shadow),
 *     var(--tw-shadow)`), and `none` is a legal box-shadow value only when it
 *     stands ALONE. `--tw-shadow: none` makes the whole declaration invalid, so
 *     the browser drops it — and with it the focus ring, which is painted
 *     through `--tw-ring-shadow` in that same list;
 *  3. `focus-visible:ring-2` is therefore inert. Measured in Chromium against
 *     a live server: every ring custom property resolved correctly
 *     (`--tw-ring-shadow: 0 0 0 calc(2px + 2px) oklch(0.205 0 0)`) while the
 *     computed `box-shadow` read `none`.
 *
 * Tailwind's own `shadow-none` is NOT the replacement: Sovrium overrides it in
 * its utilities layer with `box-shadow: none !important`
 * (`css/styles/component-layer-generators.ts`), which kills the ring harder.
 *
 * Emitting nothing is correct instead. `--tw-shadow` keeps its `@property`
 * initial value of `0 0 #0000`, no shadow utility claims the `box-shadow`
 * property, the element paints flat exactly as before — and the ring, when it
 * comes, is the only thing in the list.
 */
const SHADOW_FLAT = ''
const SHADOW_FLOATING = `shadow-[${v('shadow-md', T.shadowMd)}]`

/**
 * Elevation is reserved for surfaces that genuinely FLOAT above the page.
 * An inline button does not — it sits in the content flow, so it paints flat
 * and reads by fill and border alone ([internal ref] restraint; the approved
 * design-system mockup draws every inline control shadowless). `fab` is the
 * one exception in this family: a floating action button is DEFINED by
 * hovering over the page, and elevation is its only affordance for that.
 */
const elevationClass = (variant: ButtonVariant): string =>
  variant === 'fab' ? SHADOW_FLOATING : SHADOW_FLAT

const radiusClass = (variant: ButtonVariant): string =>
  variant === 'fab'
    ? `rounded-[${v('radius-full', T.radiusFull)}]`
    : `rounded-[${v('radius-base', T.radiusBase)}]`

// ──────────────────────────────────────────────────────────────────────────────
// Variant-specific composers (one per family) — keep the top-level entrypoint's
// cyclomatic complexity at 2 (link branch + default branch).
// ──────────────────────────────────────────────────────────────────────────────

const linkClasses = (size: ButtonSize, state: ButtonState): string =>
  [
    'inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap',
    sizeClasses(size, 'link'),
    VARIANT_CLASS.link,
    FOCUS_CLASS,
    STATE_CLASS[state],
  ]
    .filter(Boolean)
    .join(' ')

const filledClasses = (variant: ButtonVariant, size: ButtonSize, state: ButtonState): string =>
  [
    'inline-flex items-center justify-center gap-1.5 border font-medium whitespace-nowrap',
    radiusClass(variant),
    sizeClasses(size, variant),
    VARIANT_CLASS[variant],
    elevationClass(variant),
    state === 'default' ? MOTION_DEFAULT : '',
    FOCUS_CLASS,
    STATE_CLASS[state],
  ]
    .filter(Boolean)
    .join(' ')

/**
 * Compute the full default className for a button.
 *
 * Composition order: layout → variant → elevation → motion → focus → state.
 * Author-supplied `props.className` is merged in later by the dispatcher via
 * `resolveClasses` (`@/presentation/utils/design/resolve-classes`), which runs
 * the list through tailwind-merge: on a same-property conflict the author's
 * class wins and this recipe's losing class is DROPPED from the output.
 *
 * That merge is what decides the winner — NOT the cascade. Tailwind v4 does not
 * emit utilities in the order a renderer concatenated them but in ITS own
 * order, so `p-4 p-8` on one element resolves to whichever `p-*` rule the
 * stylesheet happens to emit last. Concatenation would leave both classes in
 * the list and make the outcome a property of the stylesheet; dropping the
 * loser makes it a property of this code.
 */
export const computeButtonDefaultClasses = (input: ButtonDefaultClassesInput = {}): string => {
  const variant = input.variant ?? 'default'
  const size = input.size ?? 'md'
  const state = input.state ?? 'default'
  return variant === 'link' ? linkClasses(size, state) : filledClasses(variant, size, state)
}

/**
 * A form submit's class string, in the platform button recipe's own vocabulary.
 *
 * Two channels, because a `button` component of the same variant wears both and
 * the whole point of a submit naming its variant (`endpoint.submitVariant`, an
 * auth action's `submitVariant`) is that a submit and a button asking for the
 * same word cannot look different. The recipe ({@link computeButtonDefaultClasses})
 * paints it; the legacy `.btn-{variant}` modifier is the token an app's own CSS
 * and the component layer address it by, and is emitted for a `button` by
 * `buildButtonModifierClasses` (`render/styling/style-processor.ts`) — which only
 * ever sees a component of `type: 'button'`, so a submit nested inside a `form`
 * never passes through it. `default` emits no modifier there and emits none here,
 * for the same reason: it is the absence of a modifier rather than one of its own.
 *
 * With no variant named this is `computeButtonDefaultClasses()` with no argument,
 * so every form that does not use the key keeps its submit's class string to the
 * byte. Shared by the server-rendered forms and the auth-form island, so the
 * island's live submit matches its server-drawn skeleton.
 */
export const computeSubmitButtonClasses = (variant: ButtonVariant | undefined): string => {
  if (variant === undefined) return computeButtonDefaultClasses()
  const recipe = computeButtonDefaultClasses({ variant })
  return variant === 'default' ? recipe : `${recipe} btn-${variant}`
}
