/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A calendar's `dayMinHeight`: the least height of a month view's day cell, per
 * breakpoint.
 *
 * The values are the author's own lengths, so no utility class can carry them
 * (the compiler only mints classes it can read in advance). The calendar host
 * writes them as one custom property per breakpoint — each already filled in
 * from the breakpoint below it — and these rules pick the one the screen is at.
 * Breakpoints are Tailwind's: sm 40rem, md 48rem, lg 64rem, xl 80rem, 2xl 96rem.
 *
 * `!important` because FullCalendar's own skeleton stylesheet zeroes a day
 * cell's minimum OUTSIDE any cascade layer, and an unlayered rule beats every
 * layered one whatever its specificity. A breakpoint below the first declared
 * one falls back to that same zero, so the floor changes nothing it was not
 * asked to.
 */
const BREAKPOINTS = [
  ['sm', '40rem'],
  ['md', '48rem'],
  ['lg', '64rem'],
  ['xl', '80rem'],
  ['2xl', '96rem'],
] as const

const rule = (breakpoint: string): string =>
  `[data-day-min-height] .fc-daygrid-day { min-height: var(--sv-day-min-height-${breakpoint}, 0px) !important; }`

/** The day-floor rules, served with the calendar's own theming. */
export const CALENDAR_DAY_FLOOR_RULES = [
  rule('mobile'),
  ...BREAKPOINTS.map(([name, width]) => `@media (width >= ${width}) { ${rule(name)} }`),
].join('\n    ')
