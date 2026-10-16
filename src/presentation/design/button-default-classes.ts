/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the `button` component.
 *
 * The `button` component type IS shadcn/ui's base-nova `Button`: every
 * variant and size below is the registry's `buttonVariants` string, so a
 * schema author who writes the bare `{ type: 'button', label: 'Save' }` gets
 * exactly the button the shadcn documentation shows — one focus ring (no
 * offset ring), a primary that hovers at 80 % of itself, and a destructive
 * drawn as a TINT (destructive ink on a faint destructive ground). An app that
 * wants the solid red writes it through `design.components.button`, whose
 * classes `tailwind-merge` lets beat the recipe on every shared property.
 *
 * Colours are the role utilities (`bg-primary`, `ring-ring`), so an app's
 * `design.colors` reach the button through the theme variables they bind.
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

import { cva } from 'class-variance-authority'
import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import type { ButtonVariantSchema } from '@/domain/models/app/pages/components/button-variant'

/**
 * Schema-aligned variant vocabulary, read off `ButtonVariantSchema`
 * (`src/domain/models/app/pages/components/button-variant.ts`) rather than
 * spelled a second time, so a member added to the schema cannot be missing
 * from the recipe's variant tables without a type error where they are called.
 * The import is type-only, so no island bundle gains the schema. The two
 * fixture-vocabulary aliases (`primary` / `base`) are NOT accepted here —
 * the dispatcher in `interactive-components.ts` always passes schema values.
 */
export type ButtonVariant = typeof ButtonVariantSchema.Type

/** Schema-aligned size vocabulary (`ButtonSizeSchema`): four text sizes, four square icon sizes. */
export type ButtonSize = 'xs' | 'sm' | 'default' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'

/** Visual state computed by the dispatcher from `loading` + `props.disabled`. */
export type ButtonState = 'default' | 'disabled' | 'loading'

export interface ButtonDefaultClassesInput {
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  readonly state?: ButtonState
}

// ──────────────────────────────────────────────────────────────────────────────
// base-nova's `buttonVariants`, verbatim (shadcn/ui, registry commit
// 3464245c4513b7998b1d11fa9c67b71cc1534dc7 — the same strings the part
// buttons draw, `button-variant-classes.ts`).
//
// One structural departure, and it changes no class: shadcn's base carries
// `rounded-lg`, `text-sm`, `border-transparent` and the 16px svg size, and
// `tailwind-merge` drops them where a variant or size names its own. Islands
// draw this recipe too and cannot carry that merge, and Tailwind v4 orders
// two same-property utilities by NAME rather than by position — so
// `rounded-lg` would beat the small sizes' `rounded-[min(…)]` and `text-sm`
// their `text-[0.8rem]`. Each of those tokens therefore moves from the base
// into the variants and sizes that keep it: the class lists the merge
// produces, by construction rather than by resolution.
//
// `fab` is Sovrium's own (a floating action button is not in the registry):
// the default variant's paint, circular, and the one button that keeps a
// shadow because it genuinely floats.
// ──────────────────────────────────────────────────────────────────────────────

/** base-nova's `buttonVariants` base, less the tokens a variant or size replaces. */
export const BUTTON_BASE =
  'group/button inline-flex shrink-0 items-center justify-center border bg-clip-padding font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0'

/*
 * The registry's strings repeat a handful of phrases across variants and
 * sizes. They are named once here, which changes no class and keeps the
 * recipe light in the islands that draw it (the sign-in form's among them).
 */
const MUTED_HOVER =
  'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground'
const IN_GROUP = 'in-data-[slot=button-group]:rounded-lg'
const ICON_INSET_2 = 'has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2'
const ICON_INSET_15 = 'has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5'
const RADIUS_10 = 'rounded-[min(var(--radius-md),10px)]'
const RADIUS_12 = 'rounded-[min(var(--radius-md),12px)]'
const SVG_3 = "[&_svg:not([class*='size-'])]:size-3"

/** Every variant but `outline` keeps base-nova's transparent edge. */
const EDGELESS = 'border-transparent'

const VARIANT_CLASS = cva('', {
  variants: {
    variant: {
      default: `${EDGELESS} bg-primary text-primary-foreground hover:bg-primary/80`,
      outline: `border-border bg-background ${MUTED_HOVER} dark:border-input dark:bg-input/30 dark:hover:bg-input/50`,
      secondary: `${EDGELESS} bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground`,
      ghost: `${EDGELESS} ${MUTED_HOVER} dark:hover:bg-muted/50`,
      destructive: `${EDGELESS} bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40`,
      link: `${EDGELESS} text-primary underline-offset-4 hover:underline`,
      fab: `${EDGELESS} bg-primary text-primary-foreground hover:bg-primary/80 shadow-[${v('shadow-md', T.shadowMd)}]`,
    },
  },
})

/** The tokens shadcn's base carries that a size may replace (see the note above). */
const BASE_RADIUS = 'rounded-lg'
const BASE_TEXT = 'text-sm'
const BASE_SVG = "[&_svg:not([class*='size-'])]:size-4"
const BASE_BOX = `${BASE_RADIUS} ${BASE_TEXT} ${BASE_SVG}`

const SIZE_CLASS = cva('', {
  variants: {
    size: {
      default: `${BASE_BOX} h-8 gap-1.5 px-2.5 ${ICON_INSET_2}`,
      xs: `h-6 gap-1 ${RADIUS_10} px-2 text-xs ${IN_GROUP} ${ICON_INSET_15} ${SVG_3}`,
      sm: `h-7 gap-1 ${RADIUS_12} px-2.5 text-[0.8rem] ${IN_GROUP} ${ICON_INSET_15} [&_svg:not([class*='size-'])]:size-3.5`,
      lg: `${BASE_BOX} h-9 gap-1.5 px-2.5 ${ICON_INSET_2}`,
      icon: `${BASE_BOX} size-8`,
      'icon-xs': `${BASE_TEXT} size-6 ${RADIUS_10} ${IN_GROUP} ${SVG_3}`,
      'icon-sm': `${BASE_TEXT} ${BASE_SVG} size-7 ${RADIUS_12} ${IN_GROUP}`,
      'icon-lg': `${BASE_BOX} size-9`,
    },
  },
})

/** `fab` is a 56px circle at every size. */
const FAB_SIZE = `rounded-[${v('radius-full', T.radiusFull)}] ${BASE_TEXT} ${BASE_SVG} size-14`

const STATE_CLASS: Record<ButtonState, string> = {
  default: '',
  disabled: 'opacity-50 cursor-not-allowed',
  loading: 'opacity-75 cursor-progress',
}

/**
 * Compute the full default className for a button.
 *
 * Composition order: base → variant → size → state.
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
  const size = input.size ?? 'default'
  const state = input.state ?? 'default'
  return [
    BUTTON_BASE,
    VARIANT_CLASS({ variant }),
    variant === 'fab' ? FAB_SIZE : SIZE_CLASS({ size }),
    STATE_CLASS[state],
  ]
    .filter(Boolean)
    .join(' ')
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
