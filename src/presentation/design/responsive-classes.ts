/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** The breakpoints of a `responsiveValue` struct, smallest first. */
export const RESPONSIVE_BREAKPOINTS = ['mobile', 'sm', 'md', 'lg', 'xl', '2xl'] as const

/** One breakpoint of a `responsiveValue` struct. */
export type ResponsiveBreakpoint = (typeof RESPONSIVE_BREAKPOINTS)[number]

/** A `responsiveValue` struct: one optional value per breakpoint. */
export type ResponsiveValues<T> = Partial<Readonly<Record<ResponsiveBreakpoint, T>>>

/**
 * The classes of a per-breakpoint value, smallest breakpoint first.
 *
 * `classes` maps each value to its classes AT EACH BREAKPOINT, spelled out in
 * full (`md:text-2xl`, never `${bp}:text-2xl`): the CSS compiler is scan-free,
 * and only a literal it can read in the source reaches the stylesheet.
 *
 * @param values - The declared `{ mobile, sm, md, … }` struct, if any.
 * @param classes - Value → breakpoint → the literal class list.
 */
export const responsiveClasses = <T extends string>(
  values: ResponsiveValues<T> | undefined,
  classes: Readonly<Record<T, Readonly<Record<ResponsiveBreakpoint, string>>>>
): string =>
  values === undefined
    ? ''
    : RESPONSIVE_BREAKPOINTS.flatMap((breakpoint) => {
        const value = values[breakpoint]
        // A value outside the table (a probe, or a config decoded by an older
        // schema) contributes no class rather than throwing in the renderer.
        const entry = value === undefined ? undefined : classes[value]?.[breakpoint]
        return entry === undefined ? [] : [entry]
      }).join(' ')
