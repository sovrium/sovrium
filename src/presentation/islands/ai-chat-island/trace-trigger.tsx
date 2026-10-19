/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTraceCollapsibleChevronClasses,
  computeTraceCollapsibleTriggerClasses,
  computeTraceIconClasses,
  computeTraceTitleClasses,
} from '@/presentation/design/trace-default-classes'
import type { ReactElement, ReactNode } from 'react'

/**
 * The parts every Trace line of the chat shares (`trace-parts.tsx`,
 * `trace-tool-line.tsx`): its glyph, and the trigger that opens a line onto
 * what it holds.
 */

/** A 24-unit outline glyph, drawn in the line's colour; `trace-icon` unless it is the chevron. */
export const Glyph = ({
  d,
  className,
  slot = 'trace-icon',
}: {
  readonly d: string
  readonly className: string
  readonly slot?: string
}) => (
  <span
    data-slot={slot}
    aria-hidden="true"
    className={className}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  </span>
)

/** The chevron of a line that opens. */
const CHEVRON_GLYPH = 'm9 18 6-6-6-6'

/**
 * The part of a line that opens it: the line's glyph, its title, whatever it
 * says after the title, and the chevron, turned while the line is open.
 *
 * The title sits inside the trigger, out of reach of the running line's own
 * shimmer rule, which styles the line's DIRECT children only; a running
 * line therefore asks its title to shimmer itself.
 */
export const TraceTrigger = ({
  open,
  onToggle,
  glyph,
  title,
  shimmer = false,
  children,
}: {
  readonly open: boolean
  readonly onToggle: () => void
  readonly glyph: string
  readonly title: string
  /** The line is running: its title shimmers (and stops under reduced motion). */
  readonly shimmer?: boolean
  readonly children?: ReactNode
}): ReactElement => (
  <button
    type="button"
    data-slot="trace-collapsible-trigger"
    aria-expanded={open}
    onClick={onToggle}
    className={computeTraceCollapsibleTriggerClasses()}
  >
    <Glyph
      d={glyph}
      className={computeTraceIconClasses()}
    />
    <span
      data-slot="trace-title"
      className={shimmer ? `${computeTraceTitleClasses()} shimmer` : computeTraceTitleClasses()}
    >
      {title}
    </span>
    {children}
    <Glyph
      d={CHEVRON_GLYPH}
      slot="trace-collapsible-chevron"
      className={computeTraceCollapsibleChevronClasses()}
    />
  </button>
)
