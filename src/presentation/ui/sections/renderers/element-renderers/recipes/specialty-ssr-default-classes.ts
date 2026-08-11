/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the SSR-rendered specialty cluster
 *: `time-picker`, `language-switcher`, and `reorderable-list`. Schema
 * authors who write the bare `{ type: 'time-picker' }`,
 * `{ type: 'language-switcher' }`, or `{ type: 'reorderable-list', children: […] }`
 * get a complete, opinionated specialty surface — bordered input chrome with
 * focus ring (time-picker), dropdown-flavored language trigger, drag-handle-
 * prefixed reorderable rows — with zero theme-layer dependency.
 *
 * The recipe mirrors the buttons + inputs + selects + toggles + numeric + date
 * + overlays + disclosure + feedback + interactive-content slices (commits
 * 02b2f35f3 + 571ae53ce + 5527660bc + 000f835d7 + 386e9dc35 + 3d35fad9a +
 * 0de6ded2a + 1b3f551a7 + c3b0241c7). Layout / spacing classes (`inline-flex`,
 * `px-3 py-2`, `gap-2`) and animation classes (`transition-colors`,
 * `focus-within:ring-2`) stay as raw Tailwind utilities — they encode behavior,
 * not color — while every color / border / radius class goes through
 * {@link withVarFallback} so `app.theme.*` overrides still win at the CSS
 * cascade layer (`var(--sv-X)` resolves the override first, falling back to
 * the inline OKLCH literal).
 *
 * Subparts covered:
 *
 *   - TIME PICKER WRAPPER       — bordered `<span>` chrome with focus-within
 *                                 ring + radius-md corners; matches the
 *                                 number-input wrapper aesthetic so an HH:mm
 *                                 input reads as the same family of control
 *   - TIME PICKER FIELD         — borderless `<input type="time">` so the
 *                                 wrapper surface shows through; baseline-
 *                                 aligned with the AM/PM indicator
 *   - TIME PICKER AM/PM         — muted leading-foreground hint shown only
 *                                 when `timeFormat === '12h'`; reads as a
 *                                 subtle visual cue, not a focal element
 *   - LANGUAGE SWITCHER TRIGGER — pill-rounded button trigger with primary-
 *                                 subtle hover surface + flag/code line-up
 *   - LANGUAGE SWITCHER DROPDOWN — anchored popover surface with elevated
 *                                  shadow, border, and rounded corners
 *   - REORDERABLE LIST CONTAINER — flex-column `<ul>` with vertical gap so
 *                                  the drag-handle + label reads as a
 *                                  card-like row separated from siblings
 *   - REORDERABLE LIST HANDLE   — grab-cursor `<span>` with muted tone so
 *                                  the handle reads as a chrome affordance
 *                                  rather than focal content
 *
 * The `status-indicator` schema (in `domain/.../specialty/status-indicator.ts`)
 * is already prestyled via `computeStatusBadgeWrapperClasses` +
 * `computeStatusBadgeDotClasses` in `feedback-default-classes.ts` — it's the
 * `variant: 'status'` mode of the badge renderer.
 *
 * The `wizard` schema (in `domain/.../specialty/wizard/`) is consumed
 * indirectly by the CRUD-form island as `wizardSteps` (multi-step create form
 * progress indicator), not as a stand-alone renderer. Prestyle defaults for
 * the step-indicator chrome remain TODO and ship with the forms slice next.
 *
 * The `file-upload` schema (in `domain/.../specialty/file-upload.ts`) already
 * carries dropzone chrome via the forms slice; no new subpart needed here.
 *
 * Helper file lives in `src/presentation/ui/sections/renderers/element-
 * renderers/` (alongside the renderers that consume it) because all of these
 * surfaces are server-rendered as part of the SSR pass — the
 * `presentation-component → presentation-island` layer boundary does not
 * apply since this is purely a same-layer helper. Mirrors the location chosen
 * for `feedback-default-classes.ts` + `forms-default-classes.ts` +
 * `interactive-content-default-classes.ts`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// TIME PICKER — bordered input wrapper + borderless time field + AM/PM hint
// ──────────────────────────────────────────────────────────────────────────────

const TIME_PICKER_WRAPPER_LAYOUT = 'inline-flex items-center gap-2 px-3 py-1.5'

const TIME_PICKER_WRAPPER_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  'focus-within:ring-2',
  `focus-within:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  `transition-[border-color,box-shadow] duration-[${v('sv-duration-fast', T.durationFast)}] ease-[${v('sv-ease-default', T.easeDefault)}]`,
].join(' ')

/**
 * Compute the default className for the outer `<span>` wrapper of a
 * `time-picker` field. Reuses the number-input wrapper vocabulary
 * (bordered surface, focus-within ring, radius-md corners) so the HH:mm
 * input reads as the same control family as the number stepper and the
 * date-picker trigger. The wrapper itself is non-interactive — focus
 * styling is forwarded to the field's `focus-within:` siblings.
 */
export const computeTimePickerWrapperClasses = (): string =>
  [TIME_PICKER_WRAPPER_LAYOUT, TIME_PICKER_WRAPPER_SURFACE].join(' ')

const TIME_PICKER_FIELD_LAYOUT = 'border-0 bg-transparent px-0 py-0'

const TIME_PICKER_FIELD_SURFACE = [
  `text-[${v('sv-fg', T.fg)}]`,
  `font-[${v('sv-font-sans', T.fontSans)}]`,
  `text-[${v('sv-font-size-base', T.fontSizeBase)}]`,
  'focus:outline-none',
]
  .filter(Boolean)
  .join(' ')

/**
 * Compute the default className for the `<input type="time">` field that
 * sits inside the time-picker wrapper. Borderless + bg-transparent so the
 * wrapper's surface shows through; the focus ring lives on the wrapper via
 * `focus-within:`. The native browser-painted HH/MM/AM/PM sub-controls
 * inherit `text-[sv-fg]` via `currentColor`.
 */
export const computeTimePickerFieldClasses = (): string =>
  [TIME_PICKER_FIELD_LAYOUT, TIME_PICKER_FIELD_SURFACE].join(' ')

const TIME_PICKER_AMPM_LAYOUT = 'text-xs select-none shrink-0'

const TIME_PICKER_AMPM_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

/**
 * Compute the default className for the AM/PM indicator that renders next
 * to the time field when `timeFormat === '12h'`. Muted tone + small text
 * so the cue reads as a subtle visual hint, not as a focal element. The
 * indicator is purely informational — the native HH:mm input always uses
 * the browser's locale-driven formatting.
 */
export const computeTimePickerAmPmClasses = (): string =>
  [TIME_PICKER_AMPM_LAYOUT, TIME_PICKER_AMPM_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// LANGUAGE SWITCHER — pill-rounded trigger + anchored dropdown popover
// ──────────────────────────────────────────────────────────────────────────────

const LANGUAGE_SWITCHER_TRIGGER_LAYOUT =
  'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium leading-none'

const LANGUAGE_SWITCHER_TRIGGER_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  `hover:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  'focus-visible:outline-none focus-visible:ring-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  `transition-[background-color,border-color,box-shadow] duration-[${v('sv-duration-fast', T.durationFast)}] ease-[${v('sv-ease-default', T.easeDefault)}]`,
].join(' ')

/**
 * Compute the default className for the `<button>` trigger of the
 * `language-switcher`. Pill-flavored chrome (bordered + bg-raised) with a
 * subtle hover swap to `primary-subtle` so the trigger reads as a one-of-
 * one chip in the page header. Focus ring follows the standard Sovrium
 * focusable-control recipe (`focus-visible:ring-2 + sv-focus-ring`).
 */
export const computeLanguageSwitcherTriggerClasses = (): string =>
  [LANGUAGE_SWITCHER_TRIGGER_LAYOUT, LANGUAGE_SWITCHER_TRIGGER_SURFACE].join(' ')

const LANGUAGE_SWITCHER_DROPDOWN_LAYOUT = 'absolute top-full left-0 z-10 mt-1 min-w-[10rem] py-1'

const LANGUAGE_SWITCHER_DROPDOWN_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-overlay', T.bgOverlay)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
  `shadow-[${v('sv-shadow-md', T.shadowMd)}]`,
].join(' ')

/**
 * Compute the default className for the anchored dropdown popup `<div>`
 * that renders the supported-language list once the user opens the
 * switcher. Floating chrome (bordered + bg-overlay + radius-md +
 * shadow-md) keeps the popover legible against any page background;
 * `top-full left-0 z-10 mt-1` positions it under the trigger with a tiny
 * gap so the chrome doesn't merge with the trigger's border.
 */
export const computeLanguageSwitcherDropdownClasses = (): string =>
  [LANGUAGE_SWITCHER_DROPDOWN_LAYOUT, LANGUAGE_SWITCHER_DROPDOWN_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// REORDERABLE LIST — flex-column list of card-like rows with drag handles
// ──────────────────────────────────────────────────────────────────────────────

const REORDERABLE_LIST_LAYOUT = 'flex flex-col gap-2 list-none p-0 m-0'

/**
 * Compute the default className for the outer `<ul>` of a `reorderable-list`.
 * Vertical flex with a `gap-2` interval so each row reads as a separated
 * card; `list-none p-0 m-0` strips the browser default `list-style:disc`
 * + padding so the schema-author's drag-handle + content is the only thing
 * visible. The renderer wires the inline keyboard-reorder script
 * separately (see `reorderable-list-component.tsx`).
 */
export const computeReorderableListClasses = (): string => REORDERABLE_LIST_LAYOUT

const REORDERABLE_HANDLE_LAYOUT =
  'inline-flex items-center justify-center w-6 h-6 mr-2 select-none cursor-grab'

const REORDERABLE_HANDLE_SURFACE = [
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `rounded-[${v('sv-radius-sm', T.radiusSm)}]`,
  `hover:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `hover:text-[${v('sv-fg', T.fg)}]`,
  'focus-visible:outline-none focus-visible:ring-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  'active:cursor-grabbing',
  `aria-[pressed=true]:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `aria-[pressed=true]:text-[${v('sv-fg', T.fg)}]`,
].join(' ')

/**
 * Compute the default className for the `<span>` drag handle prepended
 * to each `reorderable-list` row. Muted-foreground tone so the handle
 * reads as a chrome affordance not focal content; `cursor-grab` (with
 * `active:cursor-grabbing` swap) advertises the drag intent. The handle
 * uses the project's standard focusable-control recipe + an
 * `aria-pressed=true` swap that mirrors the "picked up" state the inline
 * keyboard-reorder script toggles when the user presses Space.
 */
export const computeReorderableHandleClasses = (): string =>
  [REORDERABLE_HANDLE_LAYOUT, REORDERABLE_HANDLE_SURFACE].join(' ')
