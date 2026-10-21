/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Password-recovery completion.
//
// Reached from the emailed link, which carries `?token=…`. Public like
// `/login` — but unlike `/login` and `/forgot-password` it must NOT redirect a
// signed-in admin away: that would swallow the token and strand the reset
// half-finished. The signed-in-redirect set is therefore narrower than the
// public carve-out.
//
// PATHS ARE MOUNT-RELATIVE (`/login`). The mount primitive prefixes them.
//
// INSTALLED, like `/login`, from the library's `login-03` block: the same muted
// screen and card, with the field group bound to this step of the reset flow
// (the form, the way back to sign in, and the one note the step needs).
// Re-install with `sovrium library add block/login-03 --update`.

import dashboardResetPassword from './dashboard-reset-password.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardResetPassword as PageConfig
