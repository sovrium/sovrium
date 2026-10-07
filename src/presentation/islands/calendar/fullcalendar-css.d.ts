/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Ambient declaration for FullCalendar 7's two stylesheets.
 *
 * FullCalendar 7 stopped injecting its own CSS from JavaScript: the structural
 * `skeleton.css` and a theme's `theme.css` are files the host has to deliver.
 * `calendar-stylesheet.ts` imports both `with { type: 'text' }`, so the island
 * bundler inlines them as strings into the calendar chunk — they travel with
 * the lazy calendar code and nowhere else. The shim cannot enforce the
 * attribute (without it Bun would hand back a stylesheet path); the calendar
 * specs fail visibly when the grid renders unstyled.
 */
declare module '@fullcalendar/react/skeleton.css' {
  /** The stylesheet's text. */
  const css: string
  export default css
}

declare module '@fullcalendar/react/themes/classic/theme.css' {
  /** The stylesheet's text. */
  const css: string
  export default css
}
