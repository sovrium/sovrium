/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cva } from 'class-variance-authority'

/**
 * Adapted from shadcn/ui alert (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `alert` on shadcn/ui's anatomy: base-nova's `alertVariants`, `AlertTitle`,
 * `AlertDescription` and `AlertAction` recipes, server-rendered.
 *
 * One root, `data-slot="alert"`, holding a leading icon, an optional
 * `alert-title`, the message in `alert-description`, and — when the alert can
 * be dismissed — its close button in `alert-action`. The grid in the base
 * string puts the icon in a first column spanning both text rows.
 *
 * `default` and `destructive` are base-nova's. `info`, `success` and `warning`
 * are Sovrium's extensions (shadcn has no status alerts): the same card
 * surface as `default`, told apart by the icon and the icon's tone, so the
 * message itself stays in the card's ink and only `destructive` recolours it.
 *
 * ONE departure from base-nova's base string: `*:[svg]:text-current` moved
 * out of the base into each variant, because the extensions colour the icon
 * and two `*:[svg]:text-*` utilities on one element are arbitrated by the
 * stylesheet's order rather than by the variant.
 */

/** The five tones the schema's `alertVariant` accepts. */
export type AlertVariant = 'default' | 'destructive' | 'warning' | 'info' | 'success'

/** base-nova's `alertVariants` base string, less `*:[svg]:text-current` (see above). */
const ALERT_BASE =
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg:not([class*='size-'])]:size-4"

/** base-nova's two variants, and Sovrium's three status extensions. */
const ALERT_VARIANT = cva('', {
  variants: {
    variant: {
      default: 'bg-card text-card-foreground *:[svg]:text-current',
      destructive:
        'bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current',
      info: 'bg-card text-card-foreground *:[svg]:text-info-solid',
      success: 'bg-card text-card-foreground *:[svg]:text-success-solid',
      warning: 'bg-card text-card-foreground *:[svg]:text-warning-solid',
    },
  },
})

/** Compute the className for an alert root of the given tone. */
export const computeAlertClasses = ({
  variant = 'default',
}: { variant?: AlertVariant } = {}): string =>
  `${ALERT_BASE} ${ALERT_VARIANT({ variant: variant })}`

/** base-nova's `AlertTitle`. */
export const computeAlertTitleClasses = (): string =>
  'font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground'

/** base-nova's `AlertDescription`. */
export const computeAlertDescriptionClasses = (): string =>
  'text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4'

/** base-nova's `AlertAction`: the top-right corner the base string pads for. */
export const computeAlertActionClasses = (): string => 'absolute top-2 right-2'
