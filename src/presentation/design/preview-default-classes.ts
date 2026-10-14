/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `preview` component's parts: the `option: value` readout, the stage the
 * specimen is drawn on, and the caption under it — in shadcn/ui's semantic
 * utilities (`text-muted-foreground`, `bg-card`, `border-border`, `rounded-md`),
 * so an app's own `design` cascade reaches all three.
 */

/** The whole preview block: readout, drawing, caption, in that reading order. */
export const computePreviewRootClasses = (): string => 'flex flex-col items-start gap-2'

/**
 * The `option: value` line above the drawing.
 *
 * Monospace, because both halves are config an author types verbatim, and a
 * proportional face makes `columns[].format` read as prose. Muted: the drawing
 * below is the answer, this line only says what the question was.
 */
export const computePreviewValueClasses = (): string =>
  'font-mono text-xs leading-none text-muted-foreground'

/**
 * The stage the specimen is drawn on.
 *
 * A bounded, neutral surface rather than the bare page: a preview sits in a
 * table of forty of them, and without a frame a reader cannot tell where one
 * drawing ends and the next begins.
 */
export const computePreviewStageClasses = (): string =>
  'flex w-full items-center gap-2 rounded-md border border-border bg-card p-3'

/** The authored sentence under the drawing — what this VALUE does. */
export const computePreviewCaptionClasses = (): string => 'm-0 text-sm text-muted-foreground'
