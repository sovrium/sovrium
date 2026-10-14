/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement, ReactNode } from 'react'

/**
 * The lucide glyphs shadcn/ui's select and combobox draw, as inline SVG: the
 * geometry of lucide's `chevron-down`, `chevron-up` and `check`, sized by the
 * class the caller passes (shadcn's parts size an unsized glyph to 16px).
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

/** lucide `chevron-down`: the select and combobox trigger's glyph. */
export function ChevronDown({ className }: { readonly className?: string }): ReactElement {
  return (
    <LucideGlyph className={className}>
      <path d="m6 9 6 6 6-6" />
    </LucideGlyph>
  )
}

/** lucide `chevron-up`: the select popup's scroll-up arrow. */
export function ChevronUp({ className }: { readonly className?: string }): ReactElement {
  return (
    <LucideGlyph className={className}>
      <path d="m18 15-6-6-6 6" />
    </LucideGlyph>
  )
}

/** lucide `check`: the selected option's mark. */
export function CheckMark({ className }: { readonly className?: string }): ReactElement {
  return (
    <LucideGlyph className={className}>
      <path d="M20 6 9 17l-5-5" />
    </LucideGlyph>
  )
}

/** lucide `x`: a clearable select's clear control. */
export function XMark({ className }: { readonly className?: string }): ReactElement {
  return (
    <LucideGlyph className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </LucideGlyph>
  )
}
