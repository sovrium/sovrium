/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * The one sentence that previews this app's voice: its first `prefer` line,
 * else its first `personality` trait, verbatim — or the undeclared state. The
 * Overview quoted a fixed sentence of the console's own whatever the app's
 * voice said.
 */
export const voicePreviewOf = (
  app: App
): { readonly state: 'declared' | 'undeclared'; readonly line?: string } => {
  const voice = app.design?.voice
  const line = voice?.prefer?.[0] ?? voice?.personality?.[0]
  return line === undefined ? { state: 'undeclared' } : { state: 'declared', line }
}
