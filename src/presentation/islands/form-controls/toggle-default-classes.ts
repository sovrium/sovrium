/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui toggle, toggle-group and switch (https://ui.shadcn.com), registry commit 30a58d4498f270af1c1e981a7d78a15cf5740841.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * Prestyled-by-default class computer for the `toggle`, `toggle-group` and
 * `switch` components, drawn on shadcn/ui's anatomy (base-nova).
 *
 * `toggleVariants` is shadcn's own `cva` recipe, the one way a variant or a
 * size maps to classes; the toggle-group item composes it under the group's
 * spacing rules. The switch keeps shadcn's `data-size` contract: the size is an
 * attribute on the root, and the track and thumb read it through their group.
 *
 * Base UI exposes the pressed and checked states as data attributes, so a single
 * class list covers every state the primitive can enter.
 *
 * `lg` is kept on the switch and the toggle group, where the schema accepts it
 * and shadcn has no such step; it follows the `default` step's geometry one rung
 * up.
 */

import { cva } from 'class-variance-authority'

type ToggleVariant = 'default' | 'outline'
type ComponentSize = 'sm' | 'default' | 'lg'

/** shadcn/ui `toggleVariants`, base-nova. */
export const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted data-[state=on]:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border border-input bg-transparent hover:bg-muted',
      },
      size: {
        default:
          'h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        sm: "h-7 min-w-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

/** The `toggle` root: shadcn/ui `Toggle`. */
export const computeToggleClasses = ({
  variant = 'default',
  size = 'default',
}: {
  variant?: ToggleVariant
  size?: ComponentSize
} = {}): string => toggleVariants({ variant, size })

/** shadcn/ui `ToggleGroup` root; the gap reads the `--gap` the island sets from the spacing. */
export const computeToggleGroupClasses = (): string =>
  'group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-lg data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-vertical:flex-col data-vertical:items-stretch'

/** shadcn/ui `ToggleGroupItem`: the group's spacing rules over `toggleVariants`. */
export const computeToggleGroupItemClasses = ({
  variant = 'default',
  size = 'default',
}: {
  variant?: ToggleVariant
  size?: ComponentSize
} = {}): string =>
  [
    'shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-1.5 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-lg group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-lg group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-lg group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-lg group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t',
    toggleVariants({ variant, size }),
  ].join(' ')

/**
 * shadcn/ui `Switch` root; `data-size` on the element picks the geometry. One
 * addition: the unchecked track is outlined in the muted foreground, the edge
 * that holds 3:1 against the page (WCAG 1.4.11) where shadcn draws none.
 */
export const computeSwitchTrackClasses = (): string =>
  'peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none group-has-[:focus-visible]/field-label:border-transparent group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] data-[size=lg]:h-[22.4px] data-[size=lg]:w-[40px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:border-muted-foreground data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50'

/** shadcn/ui `Switch` thumb. */
export const computeSwitchThumbClasses = (): string =>
  'pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=lg]/switch:size-5 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=lg]/switch:data-checked:translate-x-[calc(100%-2px)] dark:data-checked:bg-primary-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 group-data-[size=lg]/switch:data-unchecked:translate-x-0 dark:data-unchecked:bg-foreground'
