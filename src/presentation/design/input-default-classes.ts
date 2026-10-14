/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui input and textarea (https://ui.shadcn.com), registry commit 30a58d4498f270af1c1e981a7d78a15cf5740841.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * Prestyled-by-default class computer for the `input` and `textarea` components,
 * drawn on shadcn/ui's anatomy (base-nova): the `Input` and `Textarea` class
 * recipes, verbatim, rendered with `data-slot="input"` / `data-slot="textarea"`.
 *
 * The recipe lives in `presentation/design` because three render contexts read
 * it: the SSR dispatcher, the auth and CRUD form islands, and the record drawer
 * inputs. An island may not import a server component, so this is the one home
 * all of them reach.
 *
 * shadcn styles every state from the element's own attributes (`disabled`,
 * `aria-invalid`), so the base recipe already covers them. The `state` argument
 * is kept for the callers that draw a state the element does not carry as an
 * attribute (a specimen, a skeleton): it adds the same look the attribute would.
 * `readonly` has no look of its own in shadcn's anatomy and draws as `default`.
 */

/** Visual state, derived by the dispatcher from `disabled`, `aria-invalid` and `readOnly`. */
export type InputState = 'default' | 'error' | 'disabled' | 'readonly'

export interface InputDefaultClassesInput {
  readonly state?: InputState
}

/** shadcn/ui `Input`, base-nova. */
const INPUT_RECIPE =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40'

/** shadcn/ui `Textarea`, base-nova. */
const TEXTAREA_RECIPE =
  'flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40'

/**
 * The look a state's attribute would give, for a caller drawing the state
 * without the attribute. Same utilities as the attribute variants above.
 */
const STATE_LOOK: Record<InputState, string> = {
  default: '',
  error:
    'border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40',
  disabled: 'pointer-events-none cursor-not-allowed bg-input/50 opacity-50 dark:bg-input/80',
  readonly: '',
}

const withState = (recipe: string, state: InputState): string =>
  STATE_LOOK[state] === '' ? recipe : `${recipe} ${STATE_LOOK[state]}`

/**
 * The default className for an input.
 *
 * Author-supplied `props.className` is merged later by the dispatcher through
 * `resolveClasses`, and wins a same-property conflict because tailwind-merge
 * drops the loser.
 */
export const computeInputDefaultClasses = (input: InputDefaultClassesInput = {}): string =>
  withState(INPUT_RECIPE, input.state ?? 'default')

/** The default className for a textarea; same state contract as the input. */
export const computeTextareaDefaultClasses = (input: InputDefaultClassesInput = {}): string =>
  withState(TEXTAREA_RECIPE, input.state ?? 'default')
