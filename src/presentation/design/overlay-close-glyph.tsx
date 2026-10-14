/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

/**
 * The cross a dialog's or a sheet's close button carries: lucide's `X`, which
 * is the icon shadcn/ui's Dialog and Sheet draw there, inlined as its two
 * strokes so neither the server-drawn dialog nor the islands pay for the icon
 * library. The button's own `[&_svg:not([class*='size-'])]:size-4` sizes it;
 * its colour is `currentColor`, the button's text.
 */
export function OverlayCloseGlyph(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}
