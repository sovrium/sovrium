/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * Whether a reader of `role` is shown app-wide presence: the app declares
 * `auth.presence` and names her role in `visibleTo`. A reader without an
 * account is never shown it, whatever `visibleTo` says.
 */
export const seesPresence = (
  app: Pick<App, 'auth'>,
  reader: { readonly role: string | undefined; readonly signedIn: boolean }
): boolean =>
  reader.signedIn &&
  reader.role !== undefined &&
  (app.auth?.presence?.visibleTo ?? []).includes(reader.role)
