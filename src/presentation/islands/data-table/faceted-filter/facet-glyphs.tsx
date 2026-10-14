/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

const SVG_PROPS = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

/** lucide's `circle-plus`, the faceted-filter trigger's glyph. */
export function FacetTriggerGlyph(): ReactElement {
  return (
    <svg {...SVG_PROPS}>
      <circle
        cx="12"
        cy="12"
        r="10"
      />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  )
}

/**
 * The box before an option: filled with a check when the option is checked,
 * an empty outline otherwise (shadcn draws the same box, check invisible).
 */
export function FacetCheck({ checked }: { readonly checked: boolean }): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={`flex size-4 items-center justify-center rounded-[4px] border ${
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input [&_svg]:invisible'
      }`}
    >
      <svg
        {...SVG_PROPS}
        className="size-3.5"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  )
}
