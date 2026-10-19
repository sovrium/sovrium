/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ink an app's declared surface colour is read in, when it declares the
 * surface and not its `-foreground`.
 *
 * `accent` declared as a cream and nothing else once derived `#ffffff` for the
 * Tailwind utility channel (`--color-accent-foreground`) while the shadcn
 * variable (`--accent-foreground`) kept the platform's near-black: white text
 * on cream wherever `text-accent-foreground` painted, and a design-system page
 * reporting the other variable. So the companion is derived ONCE, here, and both
 * channels write it; and it is chosen to be READABLE on the colour, not white by
 * default.
 *
 * The rule: white while white reaches 3:1 against the colour (the WCAG floor for
 * large text and UI parts, where a filled control's label sits), else the
 * platform's near-black. A mid blue keeps its white label; a cream, an amber or a
 * light green gets dark ink. A colour this module cannot read keeps white, as it
 * always did. A declared foreground is never overridden: the author's word wins.
 */

import { measureContrast } from '@/domain/kernel/color/color-contrast'

/** The surface roles that carry a `-foreground` companion. */
export const FOREGROUND_BEARING_ROLES = [
  'primary',
  'secondary',
  'destructive',
  'card',
  'muted',
  'accent',
  'popover',
] as const

/** Light ink: kept while it reaches this ratio against the surface. */
const LIGHT_INK = '#ffffff'

/** Dark ink: the platform's near-black body text. */
const DARK_INK = '#09090b'

/** The minimum ratio light ink must reach to be kept (WCAG large text / UI). */
const LIGHT_INK_FLOOR = 3

/** The ink a surface colour is read in. */
export const readableInkFor = (surface: string): string => {
  const light = measureContrast(LIGHT_INK, surface)
  return light === undefined || light.ratio >= LIGHT_INK_FLOOR ? LIGHT_INK : DARK_INK
}

/**
 * The `-foreground` companions this app does not declare but should paint,
 * keyed by role (`accent-foreground`), for each surface role it does declare.
 */
export const derivedForegrounds = (
  colors: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    FOREGROUND_BEARING_ROLES.flatMap((role) => {
      const surface = colors?.[role]
      const key = `${role}-foreground`
      return typeof surface === 'string' && surface !== '' && colors?.[key] === undefined
        ? [[key, readableInkFor(surface)] as const]
        : []
    })
  )
