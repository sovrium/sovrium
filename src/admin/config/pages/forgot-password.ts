/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Password-recovery request.
//
// Public like `/login` — an operator who cannot sign in must be able to reach
// it — but SMTP-gated: without outgoing mail the platform drops this path from
// the carve-out entirely, so a hand-typed URL 404s rather than
// opening a form that can never send anything.
//
// PATHS ARE MOUNT-RELATIVE (`/login`). The mount primitive prefixes them.
//
// INSTALLED, like `/login`, from the library's `login-03` block: the same muted
// screen and card, with the field group bound to this step of the reset flow
// (the form, the way back to sign in, and the one note the step needs).
// Re-install with `sovrium library add block/login-03 --update`.

import dashboardForgotPassword from './dashboard-forgot-password.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardForgotPassword as PageConfig
