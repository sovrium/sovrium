/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for `file-upload` (wave R-E).
 *
 * ## Why it moved here
 * The dropzone recipe used to live in
 * `ui/sections/renderers/element-renderers/recipes/forms-default-classes.ts`,
 * which the island cannot import: `[internal ref]` forbids
 * `presentation-island → presentation-component`. So the SSR skeleton painted
 * the recipe and `islands/file-upload/file-upload-island.tsx` painted a
 * hand-written approximation of it — measured before R-E, the two disagreed on
 * every value that matters (the skeleton drew `p-6 border-2 gap-2` on
 * `bg-subtle`, the island drew `min-h-[120px] px-4 py-2 shadow-sm` on
 * `bg-background`), so a dropzone visibly jumped on hydration. Moving the
 * recipe to `presentation/utils/recipes` — the one directory both sides may
 * import — is the same fix R-D applied to `kpi` and F1 applied to `button`.
 *
 * ## Safelist
 * This directory is registered in `RECIPE_DIRS`
 * (`src/infrastructure/css/arbitrary-var-safelist.ts`), so the `v(…)` template
 * literals below reach the compiler's `@source inline(...)` safelist. Written
 * anywhere else they would emit no CSS rule at all.
 *
 * ## Target
 * Canvas oracle: `variants.mjs:130` (`SP['file-upload']` and its four states),
 * `kit.mjs:95` (the specimen), `spec-form.mjs:29-30` (`dropZone` / `fileList`
 * in a form). The drawing is deliberately quiet: a ONE-pixel dashed rule, not
 * two, on the disabled-foreground grey; the raised ground rather than the
 * subtle one, so the zone reads as a place to put something rather than as a
 * well already holding something; and 16px of padding around a 4px stack.
 *
 * | part      | property                  | value                        |
 * |-----------|---------------------------|------------------------------|
 * | dropzone  | border / radius / padding | 1px dashed fg-disabled · r6 · 16px |
 * | dropzone  | ground / gap / align      | bg-raised · 4px · centred    |
 * | · hover   | border / ground           | fg · bg-subtle               |
 * | · invalid | border                    | error-solid                  |
 * | · disabled| opacity                   | 0.5                          |
 * | icon      | size                      | 18px                         |
 * | text      | size / tone               | 12px · fg                    |
 * | hint      | size / tone               | 11px · fg-muted              |
 * | file row  | border / radius / padding | 1px border · r4 · 6px 10px   |
 * | file name | size / family             | 12px · mono                  |
 *
 * ## Colour / layout split
 * Colour, radius and shadow go through {@link withVarFallback} so an
 * `app.design.*` override still wins at the cascade layer; layout, spacing and
 * type steps stay raw Tailwind because they encode structure, not colour.
 * Type steps are rungs of the platform ladder — `text-2xs` 10 · `text-xs` 11 ·
 * `text-sm` 12 · `text-base` 13 — never an arbitrary `text-[Npx]`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// DROPZONE — the dashed drop target
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Which of the drop target's four drawn states to paint.
 *
 * `hover` is the drag-over state, not the pointer-over one: the drawing labels
 * it "Release to upload", so it fires while a file is held over the zone.
 */
export type FileUploadDropzoneState = 'default' | 'hover' | 'invalid' | 'disabled'

const DROPZONE_LAYOUT = 'flex flex-col items-center gap-1 p-4 text-center'

const DROPZONE_BASE = [
  'border border-dashed',
  `rounded-[${v('radius-md', T.radiusMd)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

/**
 * The drop target itself.
 *
 * A ONE-pixel dashed rule, where this shipped as `border-2`. Two pixels of
 * dash reads as a placeholder — the "scuffed" look the old doc-comment named
 * out loud — and the canvas spends weight on consequence rather than on
 * affordance. The dashes already say "drop here"; their thickness says nothing
 * further.
 */
export const computeFileUploadDropzoneClasses = ({
  state,
}: { readonly state?: FileUploadDropzoneState } = {}): string =>
  [
    DROPZONE_LAYOUT,
    DROPZONE_BASE,
    state === 'invalid'
      ? `border-[${v('sv-error-solid', T.errorSolid)}] bg-[${v('sv-bg-raised', T.bgRaised)}]`
      : state === 'hover'
        ? `border-[${v('sv-fg', T.fg)}] bg-[${v('sv-bg-subtle', T.bgSubtle)}]`
        : `border-[${v('sv-fg-disabled', T.fgDisabled)}] bg-[${v('sv-bg-raised', T.bgRaised)}]`,
    state === 'disabled' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
  ].join(' ')

/**
 * The centred glyph at the top of the stack.
 *
 * The drawing puts an 18px upload arrow here, drawn on the 16-unit grid at
 * stroke 1.5 like every other glyph since R-F. `size-[18px]` rather than a type
 * step because an SVG is sized, not typeset — the old recipe used `text-xl`,
 * which only worked because the glyph was the literal character `+`.
 */
export const computeFileUploadDropzoneIconClasses = (): string =>
  ['size-[18px] shrink-0', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

/** The actionable line — "Drop a CSV or browse", with `browse` underlined. */
export const computeFileUploadDropzoneTextClasses = (): string =>
  ['text-sm', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * The constraint hint under it — "Up to 25 MB", or the rejection reason.
 *
 * 11px, where this shipped at `text-2xs` (10px). The two oracles disagree here
 * — `kit.mjs:95` draws 10px, `spec-form.mjs:29` draws 11px — and the ladder
 * breaks the tie: 10px is the rung reserved for chrome that is not meant to be
 * read (a keyboard hint, a count), and a size limit is meant to be read.
 */
export const computeFileUploadDropzoneHintClasses = ({
  state,
}: { readonly state?: FileUploadDropzoneState } = {}): string =>
  [
    'text-xs',
    state === 'invalid'
      ? `text-[${v('sv-error-fg', T.errorFg)}]`
      : `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// PICKED FILES — the list under the control
// ──────────────────────────────────────────────────────────────────────────────

/** The list wrapper: one row per picked file, 6px apart. */
export const computeFileUploadListClasses = (): string => 'flex flex-col gap-1.5'

/**
 * One picked file.
 *
 * A bordered row rather than a bare `<li>`: the drawing gives every picked file
 * its own box so a list of three reads as three things you can still remove,
 * not as a paragraph of filenames. This shipped as an unstyled `<ul>` of plain
 * text, which is why a picked file was indistinguishable from help copy.
 */
export const computeFileUploadFileRowClasses = (): string =>
  [
    'flex items-center gap-2 px-2.5 py-1.5 text-sm',
    'border',
    `border-[${v('sv-border', T.border)}]`,
    `rounded-[${v('radius-base', T.radiusBase)}]`,
    `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  ].join(' ')

/**
 * The file mark at the head of a row.
 *
 * The two oracles draw different marks here — `variants.mjs:130` a 20px grey
 * thumbnail box, `spec-form.mjs:30` a 14px file glyph — and the glyph wins
 * because it is the one drawn INSIDE a form, which is where this row lives. A
 * grey box is a placeholder for an image preview, and the island has no
 * preview to show: it holds filenames.
 */
export const computeFileUploadFileMarkClasses = (): string =>
  ['shrink-0', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

/** The filename — monospace, because a filename is an identifier. */
export const computeFileUploadFileNameClasses = (): string =>
  ['min-w-0 flex-1 truncate font-mono', `text-[${v('sv-fg', T.fg)}]`].join(' ')

// A picked file's SIZE and its REMOVE control are in the drawings and are
// deliberately absent here. The island's state carries filenames and nothing
// else, so a size recipe would have no value to format and a remove recipe no
// control to paint — and inventing either means adding behaviour, which needs
// its own spec rather than a paint wave. Written speculatively they would be
// dead exports the lint gate is right to reject; the gap is recorded here so
// the next reader knows it was seen rather than missed.

/** The validation message under the control — the field contract's error rung. */
export const computeFileUploadErrorClasses = (): string =>
  ['text-xs', `text-[${v('sv-error-fg', T.errorFg)}]`].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// DRAWN COPY — shared so the skeleton and the island say the same thing
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The prompt inside the drop target. `spec-form.mjs:29`, verbatim.
 *
 * Shared for the same reason the classes are: before R-E the skeleton said
 * "Drop files or browse — Attachments" over "Drag or click to browse" while
 * the island said "Drag and drop files here or browse — Attachments", so the
 * words changed on hydration as well as the box. Neither repeated the field's
 * own label the way both used to: the label sits above the zone, in the field
 * wrapper, and saying it twice is the redundancy [internal ref] D4 cuts.
 */
export const FILE_UPLOAD_DROPZONE_PROMPT = 'Drag and drop, or browse'

/**
 * The constraint line under the prompt, or `undefined` when there is nothing
 * true to say.
 *
 * An empty hint renders no element at all rather than an empty one: a blank
 * 11px line under the prompt reads as a loading state. `accept` arrives as the
 * raw HTML attribute (`image/*,.pdf`), so it is shown as written — inventing a
 * prose translation of a MIME list would be guessing at what the author meant.
 */
export const fileUploadDropzoneHint = ({
  accept,
  maxFiles,
}: {
  readonly accept?: string
  readonly maxFiles?: number
}): string | undefined => {
  const parts = [
    accept === undefined || accept.trim() === '' ? undefined : accept,
    maxFiles === undefined ? undefined : `up to ${maxFiles} file${maxFiles === 1 ? '' : 's'}`,
  ].filter((part): part is string => part !== undefined)
  return parts.length === 0 ? undefined : parts.join(' · ')
}
