/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'
import type { ReactElement } from 'react'

/** Stable identity for the presence-indicator container to satisfy react-perf. */
const PRESENCE_CONTAINER_STYLE = { minHeight: '1px' } as const

/** The presence indicator's English name, which the island draws when sent no other. */
const PRESENCE_LABEL = 'Users viewing this page'

/**
 * Renders the page-level presence-indicator island placeholder.
 *
 * Emitted on every page configured with `presence: true`. The placeholder
 * carries the page's ADDRESS as an island prop — the pattern filled with this
 * request's route parameters, so `/orders/:id` shown for order 42 is
 * `/orders/42` — and the hydrated `presence-indicator` island opens that
 * address's presence channel: two people on two records of
 * one page are on two channels. The visible `[data-testid="presence-indicator"]`
 * div is rendered server-side so the indicator is present even before hydration.
 *
 * It is named in the page language (`presence.label`); the name rides as an
 * island prop only where it differs from the English the island is written in.
 */
export function PresenceIndicatorMount({
  pagePath,
  lang,
  languages,
}: {
  readonly pagePath: string
  readonly lang: string | undefined
  readonly languages: Languages | undefined
}): Readonly<ReactElement> {
  const label = resolveInterpreterString('presence.label', lang, languages)
  const islandProps = JSON.stringify({ pagePath, ...(label !== PRESENCE_LABEL && { label }) })
  return (
    <div
      data-island="presence-indicator"
      data-island-props={islandProps}
      style={PRESENCE_CONTAINER_STYLE}
    >
      <div
        data-testid="presence-indicator"
        aria-label={label}
      />
    </div>
  )
}
