/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { DevNotice } from './dev-notice'
import { SovriumBadge } from './sovrium-badge'
import type { BadgePlacement } from './badge-placement'

/**
 * Persistent platform chrome: the "Built with Sovrium" badge (bottom-right, or a
 * footer line) and the dev-mode notice (bottom-left). Extracted from
 * `DynamicPageBody` so the two visibility gates live together — they are one
 * visual system and the pair has to stay clear of each other — and so the body
 * renderer stays under the complexity cap.
 *
 * The two gates have OPPOSITE defaults, deliberately:
 * - `badgePlacement` is resolved from per-app config by the caller, so an absent
 *   value means "no app context" and renders nothing.
 * - `devNoticeEnabled` is an override, not a source: whether the notice appears
 *   is decided by `SOVRIUM_DEV_*` inside `DevNotice`, so absent means "let the
 *   env decide" and only an explicit `false` suppresses it.
 */
export function PlatformChrome({
  lang,
  badgePlacement,
  devNoticeEnabled,
}: {
  readonly lang: string
  readonly badgePlacement?: BadgePlacement
  readonly devNoticeEnabled?: boolean
}): Readonly<ReactElement> {
  return (
    <>
      {badgePlacement !== undefined && (
        <SovriumBadge
          lang={lang}
          placement={badgePlacement}
        />
      )}
      {devNoticeEnabled !== false && <DevNotice lang={lang} />}
    </>
  )
}
