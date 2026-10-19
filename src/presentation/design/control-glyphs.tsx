/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement, ReactNode } from 'react'

/**
 * The lucide glyphs shadcn/ui's controls draw — a clock, a minus and a plus, a
 * check, a grip, a globe, a calendar, a chevron and a magnifier — as inline
 * SVG: lucide's own geometry on its 24-unit grid at stroke 2.
 *
 * Inline rather than imported from `lucide-react` because both the server
 * renderers and the islands draw them: a static named import tree-shakes, but
 * every island that drew one would carry lucide's `Icon` runtime with it. The
 * paths are a few bytes each. They are sized by the class the caller passes —
 * shadcn's parts size an unsized glyph themselves (`[&_svg]:size-4`) — and
 * always hidden from assistive technology: the control around a glyph carries
 * the name.
 */
function LucideGlyph({
  className,
  children,
}: {
  readonly className?: string
  readonly children: ReactNode
}): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

interface GlyphProps {
  readonly className?: string
}

/** lucide `clock`: the time picker's end mark. */
export function ClockGlyph({ className }: GlyphProps): ReactElement {
  return (
    <LucideGlyph className={className}>
      <circle
        cx="12"
        cy="12"
        r="10"
      />
      <path d="M12 6v6l4 2" />
    </LucideGlyph>
  )
}

/** lucide `minus`: a decrement step. */
export function MinusGlyph({ className }: GlyphProps): ReactElement {
  return (
    <LucideGlyph className={className}>
      <path d="M5 12h14" />
    </LucideGlyph>
  )
}

/** lucide `plus`: an increment step. */
export function PlusGlyph({ className }: GlyphProps): ReactElement {
  return (
    <LucideGlyph className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </LucideGlyph>
  )
}

/** lucide `check`: a done or a picked mark. */
export function CheckGlyph({ className }: GlyphProps): ReactElement {
  return (
    <LucideGlyph className={className}>
      <path d="M20 6 9 17l-5-5" />
    </LucideGlyph>
  )
}

/** lucide `grip-vertical`: a handle that moves its row. */
export function GripVerticalGlyph({ className }: GlyphProps): ReactElement {
  return (
    <LucideGlyph className={className}>
      {[5, 12, 19].map((cy) => (
        <g key={cy}>
          <circle
            cx="9"
            cy={cy}
            r="1"
          />
          <circle
            cx="15"
            cy={cy}
            r="1"
          />
        </g>
      ))}
    </LucideGlyph>
  )
}

/** lucide `globe`: the language switcher's mark. */
export function GlobeGlyph({ className }: GlyphProps): ReactElement {
  return (
    <LucideGlyph className={className}>
      <circle
        cx="12"
        cy="12"
        r="10"
      />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </LucideGlyph>
  )
}

/** lucide `calendar`: a button that opens a day grid. */
export function CalendarGlyph({ className }: GlyphProps): ReactElement {
  return (
    <LucideGlyph className={className}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect
        width="18"
        height="18"
        x="3"
        y="4"
        rx="2"
      />
      <path d="M3 10h18" />
    </LucideGlyph>
  )
}

/** lucide `chevron-down`: a trigger that opens a menu below it. */
export function ChevronDownGlyph({ className }: GlyphProps): ReactElement {
  return (
    <LucideGlyph className={className}>
      <path d="m6 9 6 6 6-6" />
    </LucideGlyph>
  )
}

/** lucide `search`: the magnifier at the start of a search box. */
export function SearchLucideGlyph({ className }: GlyphProps): ReactElement {
  return (
    <LucideGlyph className={className}>
      <path d="m21 21-4.34-4.34" />
      <circle
        cx="11"
        cy="11"
        r="8"
      />
    </LucideGlyph>
  )
}
