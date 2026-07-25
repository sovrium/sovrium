/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { getBadgeLabel } from './badge-labels'

export function SovriumBadge({
  lang,
}: {
  readonly lang?: string
}): Readonly<ReactElement> {
  return (
    <a
      href="https://sovrium.com?ref=badge"
      target="_blank"
      rel="noopener"
      data-testid="sovrium-badge"
      className="border-border bg-background-raised text-foreground-muted hover:text-foreground fixed right-3 bottom-3 z-40 rounded-full border px-3 py-1.5 text-xs font-medium no-underline shadow-sm transition-colors print:hidden"
    >
      {getBadgeLabel(lang)}
    </a>
  )
}
