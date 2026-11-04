/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  RESPONSIVE_BREAKPOINTS,
  type ResponsiveBreakpoint,
} from '@/presentation/design/responsive-classes'

/** The tab open on arrival from each breakpoint up, for the breakpoints that name one. */
export type TabsArrivalOverrides = Partial<Readonly<Record<ResponsiveBreakpoint, string>>>

/** One run of widths over which the same tab is open on arrival. */
export interface TabsArrivalBand {
  readonly id: string
  /** The CSS that hides this band's panel outside its widths; empty for a band covering every width. */
  readonly className: string
}

type WiderBreakpoint = Exclude<ResponsiveBreakpoint, 'mobile'>

/**
 * Hides a panel below the breakpoint its band starts at, and from the one the
 * next band starts at. Spelled out in full: the CSS compiler is scan-free, and
 * only a literal it can read in the source reaches the stylesheet.
 */
const HIDDEN_BELOW: Readonly<Record<WiderBreakpoint, string>> = {
  sm: 'max-sm:hidden',
  md: 'max-md:hidden',
  lg: 'max-lg:hidden',
  xl: 'max-xl:hidden',
  '2xl': 'max-2xl:hidden',
}
const HIDDEN_FROM: Readonly<Record<WiderBreakpoint, string>> = {
  sm: 'sm:hidden',
  md: 'md:hidden',
  lg: 'lg:hidden',
  xl: 'xl:hidden',
  '2xl': '2xl:hidden',
}

/**
 * The per-breakpoint `responsive.<bp>.defaultTab` overrides of a tab set,
 * keeping only those that name one of its panels. `undefined` when none does,
 * so a tab set that declares nothing serialises the props it always had.
 */
export function tabsArrivalOverridesOf(
  responsive: unknown,
  panelIds: readonly string[]
): TabsArrivalOverrides | undefined {
  if (typeof responsive !== 'object' || responsive === null) return undefined
  const byBreakpoint = responsive as Readonly<Record<string, { readonly defaultTab?: unknown }>>
  const entries = RESPONSIVE_BREAKPOINTS.flatMap((breakpoint) => {
    const tab = byBreakpoint[breakpoint]?.defaultTab
    return typeof tab === 'string' && panelIds.includes(tab) ? [[breakpoint, tab] as const] : []
  })
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}

/**
 * The tab open on arrival at each width, mobile first: a breakpoint left out
 * inherits the nearest narrower override, then the base `defaultTab`. Adjacent
 * breakpoints opening the same tab are one band, so a panel is drawn once per
 * run of widths and shown by CSS before any script runs: the page never paints
 * one tab and then swaps to another.
 */
export function tabsArrivalBands(
  base: string,
  overrides: TabsArrivalOverrides
): readonly TabsArrivalBand[] {
  const runs = RESPONSIVE_BREAKPOINTS.reduce<
    readonly { readonly id: string; readonly from: ResponsiveBreakpoint }[]
  >((acc, breakpoint) => {
    const id = overrides[breakpoint] ?? acc.at(-1)?.id ?? base
    return acc.at(-1)?.id === id ? acc : [...acc, { id, from: breakpoint }]
  }, [])
  return runs.map((run, index) => {
    const next = runs[index + 1]?.from as WiderBreakpoint | undefined
    const below = run.from === 'mobile' ? undefined : HIDDEN_BELOW[run.from]
    const from = next === undefined ? undefined : HIDDEN_FROM[next]
    return { id: run.id, className: [below, from].filter(Boolean).join(' ') }
  })
}
