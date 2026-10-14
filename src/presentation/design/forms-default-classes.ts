/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui switch (https://ui.shadcn.com), registry commit 30a58d4498f270af1c1e981a7d78a15cf5740841.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * Prestyled-by-default class computers for the SSR forms cluster: the `form`
 * card chrome and an endpoint form's switch. The `input-group` moved onto
 * shadcn/ui's anatomy in `input-group-default-classes.ts`.
 *
 * Schema authors who write a bare `{ type: 'form' }` get a
 * complete, opinionated chrome with zero theme-layer dependency. Layout /
 * spacing classes (`flex flex-col`, `gap-3.5`, `p-4`) and structural classes
 * (`items-stretch`, `border-l-0`) stay raw — they encode structure, not colour
 * — while every colour / border-colour / radius class goes through
 * {@link withVarFallback} so `app.design.*` overrides still win at the CSS
 * cascade layer.
 *
 * Subparts covered:
 *
 *   - FORM CARD   — the `<form>` outer card chrome (ground + border + radius +
 *                   padding + the shared layout rhythm) wrapping a whole form
 *                   composition. The canonical "give me a form container with
 *                   zero config" surface.
 *
 * MOVED OUT in wave R-E: the `file-upload` dropzone recipe now lives in
 * `presentation/utils/recipes/file-upload-default-classes.ts`. It had to move,
 * not merely be tidied — this directory is `presentation-component`, which
 * `[internal ref]` forbids an island from importing, so the
 * hydrated `FileUploadIsland` could never consume the recipe and painted a
 * hand-written twin instead. The two disagreed on every value, and the control
 * resized on mount. The same reasoning applies to any future part of this file
 * that an island also needs to draw.
 *
 * Also NOT covered here, and each for its own reason:
 *
 *   - `field` wrapper   — has a real renderer now (`field-renderer.tsx`), but
 *                         it paints from the SHARED contract in
 *                         `presentation/utils/design/form-layout-classes.ts`,
 *                         which the standalone form pipeline and the CRUD field
 *                         shell already use. A second definition here would be
 *                         a third form-field vocabulary.
 *   - `crud-form` island — a full island with its own client-side state
 *                         machine; its chrome is island-side by construction.
 *   - form-actions row  — pure layout (`flex justify-end gap-2`), no colour or
 *                         border, so a helper would only proxy two flex
 *                         utilities.
 *
 * This file stays in `element-renderers/recipes/` because both consumers
 * (`renderForm` and the endpoint form) are server-rendered in the
 * same layer — the boundary that forced the dropzone out does not apply.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { computeFormLayoutClasses } from '@/presentation/design/form-layout-classes'

// ──────────────────────────────────────────────────────────────────────────────
// SWITCH — an endpoint form's on/off control
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The row a `control: switch` field sits in: the switch, then its label, on
 * one line — the reading order of every settings screen, and the one that
 * keeps a column of switches aligned on their controls rather than on their
 * labels.
 */
export const computeFormSwitchFieldClasses = (): string =>
  'inline-flex cursor-pointer items-center gap-2.5'

/**
 * The switch itself: a native checkbox (`role="switch"`) drawn as shadcn/ui's
 * `Switch` (base-nova), with the pill's `::before` as the thumb. Native rather
 * than an island, because an endpoint form is a plain server-rendered `<form>`
 * with no React on the client — so the control has to be one that works, and
 * toggles with Space, before any script runs. Same geometry and colours as the
 * island switch: an 18.4×32 track on the input colour off and the primary on, a
 * 16px thumb on the background colour. Off, the track is outlined in the
 * muted foreground, the edge that holds 3:1 against the page (WCAG 1.4.11).
 */
export const computeFormSwitchClasses = (): string =>
  [
    'relative inline-flex h-[18.4px] w-[32px] shrink-0 cursor-pointer appearance-none items-center rounded-full border border-muted-foreground checked:border-transparent',
    'bg-input checked:bg-primary dark:bg-input/80 dark:checked:bg-primary',
    'transition-all outline-none',
    "before:pointer-events-none before:absolute before:top-1/2 before:left-0 before:size-4 before:-translate-y-1/2 before:rounded-full before:content-['']",
    'before:bg-background dark:checked:before:bg-primary-foreground dark:before:bg-foreground',
    'before:transition-transform checked:before:translate-x-[calc(100%-2px)]',
    'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' ')

// Re-export the shared form-layout design contract (single source of truth in
// `presentation/utils/design/form-layout-classes.ts`) so the element-renderers
// cluster keeps a local import surface. Both form pipelines consume these.
export {
  computeFormLayoutClasses,
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
} from '@/presentation/design/form-layout-classes'

// ──────────────────────────────────────────────────────────────────────────────
// FORM CARD — outer `<form>` card chrome
// ──────────────────────────────────────────────────────────────────────────────

const FORM_CARD_PADDING = 'p-4'

// A panel on the page carries NO shadow: the drawings reserve elevation for
// surfaces that genuinely float — a menu, a popover, a dialog — and bound
// everything else with a border. A form does not float; it is the page.
const FORM_SURFACE = [
  'bg-card',
  'border',
  'border-border',
  `rounded-[${v('radius-md', T.radiusMd)}]`,
].join(' ')

/**
 * Compute the default className for a `<form>` rendered by the bare
 * `{ type: 'form' }` schema. Paints a self-contained boxed surface on
 * `card`, bounded by its border rather than lifted by a shadow — a form is
 * in the page, not above it — with `radius-md` corners and a
 * `p-4 flex flex-col gap-3.5` inner
 * rhythm so the typical "heading + fields + actions" composition lands
 * cleanly without the schema author needing to spell out the chrome.
 *
 * Wave R-E converges it on `spec-form.mjs`: `p-4` (16px) of padding around a
 * `gap-3.5` (14px) stack, on the RAISED ground rather than the page ground.
 * The raised ground is the load-bearing change — a form is a place to type,
 * and the drawings make every such surface a shade lighter than the page it
 * sits on so the eye finds it without a shadow. The card previously drew
 * `p-5` with an argument about "breathing room for long-form inputs"; 16px is
 * the padding every other framed surface in the system uses, and a form that
 * pads differently from a card reads as a different kind of object. Author-supplied `props.className` is merged in via
 * `resolveClasses`
 * by `renderForm` so it overrides whatever the default paints (e.g. an
 * inline form that needs `flex-row` instead of `flex-col`).
 *
 * Applied via `renderForm` in `interactive-renderers.tsx`.
 */
export const computeFormClasses = (): string =>
  [FORM_CARD_PADDING, computeFormLayoutClasses(), FORM_SURFACE].join(' ')
