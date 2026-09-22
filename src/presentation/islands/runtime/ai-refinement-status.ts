/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The reader-facing vocabulary of AI-compute refinement ([internal ref] Phase 2).
 *
 * An AI-computed value resolves in two tiers: a deterministic baseline written
 * synchronously, then a provider refinement. When the refinement never lands
 * the baseline SURVIVES as the stored value — honest, plausible-looking prose
 * that reads exactly like a refined one. Everything in this module exists to
 * make those two tell apart on screen.
 *
 * Pure by design, and separate from the component that paints it, so the grid
 * and the drawer cannot drift into two different vocabularies for the same four
 * states. It is also what keeps the component file exporting components only
 * (`react-refresh/only-export-components`).
 */

/** One field's refinement status, as carried on the wire under `_aiCompute`. */
export interface AiFieldRefinementStatus {
  readonly status: string
  readonly error?: string
}

/**
 * Read one field's refinement status off a raw record.
 *
 * Returns `undefined` for a record with no `_aiCompute` block at all — which is
 * every record of every table that declares no AI-compute field, since the
 * server omits the block rather than sending an empty one.
 */
export const readAiRefinementStatus = (
  record: Readonly<Record<string, unknown>> | undefined,
  fieldName: string
): AiFieldRefinementStatus | undefined => {
  const block = record?.['_aiCompute']
  if (typeof block !== 'object' || block === null) return undefined
  const entry = (block as Record<string, unknown>)[fieldName]
  if (typeof entry !== 'object' || entry === null) return undefined
  const { status, error } = entry as { status?: unknown; error?: unknown }
  if (typeof status !== 'string') return undefined
  return { status, ...(typeof error === 'string' ? { error } : {}) }
}

/**
 * The accessible name for a status, or `undefined` where nothing is marked.
 *
 * `refined` and `skipped` deliberately carry NOTHING. That restraint is
 * load-bearing rather than an omission: a marker on every value teaches readers
 * to ignore the marker, and `skipped` means the worker found a user edit and
 * declined to clobber it — the value is the reader's own, and trustworthy.
 */
export const refinementMarkerLabel = (status: string): string | undefined => {
  if (status === 'failed') return 'Not refined'
  if (status === 'pending') return 'Refining'
  return undefined
}

/**
 * The compact glyph the marker paints.
 *
 * A text glyph rather than an icon font or an emoji: it inherits `currentColor`
 * (so the monochrome/error tone is carried by one class), and it is real
 * rendered text, so a reader comparing two cells sees a difference even before
 * reading the label.
 */
export const refinementMarkerGlyph = (status: string): string => (status === 'failed' ? '!' : '…')

/**
 * What a failed refinement says for itself ([internal ref] D4): what happened, what is
 * on screen instead, and what to do next.
 *
 * The next step uses capability that already ships — the field is editable, and
 * a user edit marks the record `skipped` — so no retry endpoint is implied. The
 * recorded provider reason is quoted verbatim: it is the input a reader needs to
 * decide whether to wait or to act.
 */
export const refinementExplanation = (error?: string): string => {
  const reason = error ? ` (${error})` : ''
  return `This value is the locally computed fallback — the AI refinement never completed${reason}. Edit the value to set it yourself.`
}
