/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import skeletonCss from '@fullcalendar/react/skeleton.css' with { type: 'text' }
import classicThemeCss from '@fullcalendar/react/themes/classic/theme.css' with { type: 'text' }

/**
 * FullCalendar 7's own stylesheets, delivered by the calendar island.
 *
 * Version 6 injected its stylesheet from JavaScript the first time a calendar
 * mounted; version 7 leaves delivery to the host. Doing it HERE, rather than in
 * the compiled site stylesheet, keeps the old cost model: the ~21 KB of
 * FullCalendar CSS rides in the lazy calendar chunk, so a page with no calendar
 * downloads none of it.
 *
 * The `<style>` is PREPENDED to `<head>`, ahead of the compiled Sovrium
 * stylesheet — the position version 6 used. The Sovrium theming in
 * `infrastructure/css/theme/calendar-styles.ts` then follows it in source order
 * and is written at a higher specificity besides, so it wins either way. The
 * classic theme's palette file is deliberately NOT loaded: its `--fc-classic-*`
 * variables are bound to the `--sv-*` design tokens by that same stylesheet, so
 * a calendar never paints FullCalendar's factory colours.
 *
 * Idempotent across islands: two calendars on one page share one element.
 */
const MARKER = 'data-sovrium-fullcalendar'

export function ensureCalendarStylesheet(): void {
  if (typeof document === 'undefined' || document.head.querySelector(`style[${MARKER}]`)) return
  const style = document.createElement('style')
  style.setAttribute(MARKER, '')
  style.append(`${skeletonCss}\n${classicThemeCss}`)
  document.head.prepend(style)
}
