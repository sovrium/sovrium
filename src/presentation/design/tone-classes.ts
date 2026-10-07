/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Tone } from '@/domain/models/app/pages/components/shared-schemas'

/**
 * The ink of each semantic tone: the theme's three status roles and the
 * secondary text colour. Spelled out whole so the scan-free CSS compiler sees
 * every literal.
 */
const TONE_TEXT: Readonly<Record<Tone, string>> = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  muted: 'text-foreground-muted',
}

/**
 * The text-colour class of a tone, or `undefined` when none is declared.
 *
 * @param tone - A declared `tone`, if any.
 */
export const toneTextClass = (tone: Tone | undefined): string | undefined =>
  tone === undefined ? undefined : TONE_TEXT[tone]
