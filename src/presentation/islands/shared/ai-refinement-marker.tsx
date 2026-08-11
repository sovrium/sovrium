/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE affordance that distinguishes an AI-refined value from the
 * deterministic baseline that survived a refinement which never landed.
 *
 * Used by every surface that shows an AI-computed value — the grid cell and the
 * record drawer today. Written once on purpose: the two surfaces differ only in
 * where the explanation goes (a hover tooltip where there is no room, inline
 * where there is), never in the vocabulary, the tone, or what counts as marked.
 *
 * CHROME, NOT DATA ([internal ref] A7 ruling 1). `pending` / `refined` / `failed` /
 * `skipped` is a vocabulary Sovrium invented rather than one an app author
 * declared, so the indicator stays monochrome — A1 retired `warning` and `info`
 * and they do not return through a chip-shaped door. `error` keeps its
 * privilege (ruling 2) as the one colour chrome may use, and a refinement that
 * did not happen is exactly the consequence that reserve exists for.
 */

import { useId } from 'react'
import {
  refinementExplanation,
  refinementMarkerGlyph,
  refinementMarkerLabel,
} from './ai-refinement-status'
import type { AiFieldRefinementStatus } from './ai-refinement-status'
import type { CSSProperties, ReactElement } from 'react'

/**
 * Where the explanation goes.
 *
 * `tooltip` — a grid cell, which has no room for a sentence: the marker carries
 *   it through `aria-describedby`, revealed on hover for a sighted reader and
 *   announced with the marker for everyone else.
 * `inline` — a drawer, which has room to say it in full, so it does.
 */
export type AiRefinementExplanationPlacement = 'tooltip' | 'inline'

/**
 * A grid `<td>` is `whitespace-nowrap`, which a tooltip must opt out of or its
 * sentence renders as one long line spilling out of the panel. Hoisted so the
 * JSX allocates no object per render.
 */
const WRAPPED_TEXT: CSSProperties = { whiteSpace: 'normal' }

const BADGE_BASE =
  'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] leading-none font-semibold select-none'

/** Monochrome for in-flight work; `error` tone for a refinement that failed. */
const badgeToneClass = (status: string): string =>
  status === 'failed' ? 'text-error-fg' : 'text-muted-foreground'

/**
 * The badge itself — the ONE piece both placements share, so a grid marker and
 * a drawer marker can never drift into two different glyphs or two tones.
 *
 * `role="img"` with an accessible name rather than a decorative glyph: a marker
 * a screen-reader user cannot perceive has not solved this defect for them.
 */
function StatusBadge({
  status,
  label,
  describedBy,
}: {
  readonly status: string
  readonly label: string
  readonly describedBy?: string
}): ReactElement {
  return (
    <span
      role="img"
      aria-label={label}
      data-ai-refinement={status}
      {...(describedBy === undefined ? {} : { 'aria-describedby': describedBy })}
      className={`${BADGE_BASE} ${badgeToneClass(status)}`}
    >
      {refinementMarkerGlyph(status)}
    </span>
  )
}

/**
 * Grid placement: the badge, plus an explanation panel it points at through
 * `aria-describedby`, revealed on hover.
 *
 * `invisible` rather than `opacity-0`, so the panel is genuinely absent for a
 * sighted reader instead of merely transparent.
 */
function TooltipMarker({
  status,
  label,
  explanation,
}: {
  readonly status: string
  readonly label: string
  readonly explanation?: string
}): ReactElement {
  const describedId = useId()
  return (
    <span className="group relative ml-2 inline-flex items-center align-middle">
      <StatusBadge
        status={status}
        label={label}
        {...(explanation === undefined ? {} : { describedBy: describedId })}
      />
      {explanation !== undefined && (
        <span
          id={describedId}
          style={WRAPPED_TEXT}
          className="border-border bg-card text-foreground invisible absolute top-full left-0 z-20 mt-1 w-64 rounded border p-2 text-left text-xs leading-snug font-normal shadow-md group-hover:visible"
        >
          {explanation}
        </span>
      )}
    </span>
  )
}

/** Drawer placement: room enough to state the explanation outright. */
function InlineMarker({
  status,
  label,
  explanation,
}: {
  readonly status: string
  readonly label: string
  readonly explanation?: string
}): ReactElement {
  return (
    <span className="flex items-start gap-2">
      <StatusBadge
        status={status}
        label={label}
      />
      {explanation !== undefined && (
        <span className="text-muted-foreground text-xs leading-snug font-normal">
          {explanation}
        </span>
      )}
    </span>
  )
}

interface AiRefinementMarkerProps {
  /** The field's status as read from the record's `_aiCompute` block. */
  readonly status: AiFieldRefinementStatus | undefined
  readonly placement: AiRefinementExplanationPlacement
}

/**
 * Render the refinement affordance for ONE field, or nothing at all.
 *
 * Nothing is the common case and the important one: a refined value stands
 * alone, and so does a user-overridden (`skipped`) one.
 */
export function AiRefinementMarker({
  status,
  placement,
}: AiRefinementMarkerProps): ReactElement | undefined {
  const label = refinementMarkerLabel(status?.status ?? '')
  if (status === undefined || label === undefined) return undefined

  const explanation = status.status === 'failed' ? refinementExplanation(status.error) : undefined
  const shared = {
    status: status.status,
    label,
    ...(explanation === undefined ? {} : { explanation }),
  }

  return placement === 'tooltip' ? <TooltipMarker {...shared} /> : <InlineMarker {...shared} />
}
