/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'

/**
 * The placeholder line a dialog, an alert dialog or a drawer serves before its
 * island mounts, in the page language. Renamed under `sovrium.overlay.loading`.
 */
export const overlayLoadingLabel = (context: {
  readonly currentLang?: string
  readonly languages?: Languages
}): string => resolveInterpreterString('overlay.loading', context.currentLang, context.languages)
