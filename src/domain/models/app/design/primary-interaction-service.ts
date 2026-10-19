/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The hover and pressed shades of an app's declared `primary`.
 *
 * `primary-hover` and `primary-active` are Sovrium extension roles: shadcn has
 * no token for them. Their platform defaults are two greys set either side of
 * the platform's near-black primary (`oklch(0.272 0 0)` and `oklch(0.14 0 0)`).
 * An app that declares a brown primary and nothing else kept those greys, so a
 * link hovered from brown to near-black and the Foundations page listed two
 * colours that belong to no palette the author chose.
 *
 * So when `primary` is declared and a shade is not, the shade is DERIVED from
 * the primary: same hue and chroma, lightness moved by the step the platform
 * defaults themselves sit at. Hover moves toward the middle of the lightness
 * range, so a dark primary lightens and a light one darkens. Pressed moves the
 * other way. A declared shade is never overridden: the author's word wins.
 */

import { oklchOf } from '@/domain/kernel/color/color-contrast'

/** How far the platform's hover sits from its primary, in Oklch lightness. */
const HOVER_STEP = 0.067

/** How far the platform's pressed shade sits from its primary. */
const ACTIVE_STEP = 0.065

/** Above this lightness a primary counts as light, and hover darkens it. */
const LIGHT_PRIMARY = 0.6

const clampLightness = (value: number): number => Math.min(1, Math.max(0, value))

const round = (value: number): number => Math.round(value * 1000) / 1000

const oklchString = (l: number, c: number, h: number): string =>
  `oklch(${round(clampLightness(l))} ${round(c)} ${round(h)})`

/** The derived shade names, in the order a palette lists them. */
export const PRIMARY_INTERACTION_ROLES = ['primary-hover', 'primary-active'] as const

/**
 * The shades this app does not declare but should paint, derived from its
 * declared primary.
 *
 * @param colors - the app's `design.colors`, as authored.
 * @returns the derived `primary-hover` / `primary-active`, each present only
 *   when `primary` is declared and readable and that shade is not declared.
 */
export const derivedPrimaryInteraction = (
  colors: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, string>> => {
  const primary = colors?.['primary']
  if (typeof primary !== 'string') return {}
  const base = oklchOf(primary)
  if (base === undefined) return {}

  const direction = base.l > LIGHT_PRIMARY ? -1 : 1
  const shades: Readonly<Record<(typeof PRIMARY_INTERACTION_ROLES)[number], string>> = {
    'primary-hover': oklchString(base.l + direction * HOVER_STEP, base.c, base.h),
    'primary-active': oklchString(base.l - direction * ACTIVE_STEP, base.c, base.h),
  }
  return Object.fromEntries(
    PRIMARY_INTERACTION_ROLES.filter((role) => colors?.[role] === undefined).map(
      (role) => [role, shades[role]] as const
    )
  )
}
