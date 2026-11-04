/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The sign-in code step: the page `/login`'s email form opens (`onTwoFactor`)
// when the password was right and the account has two-step verification on.
//
// Public like `/login` — the person reaching it is not signed in yet — and,
// like it, an EXACT-MATCH entry of the console's carve-out. Served only on an
// app that turns `auth.twoFactor` on (`requires`): elsewhere no account can owe
// a code, and the address 404s like any page nobody wrote.
//
// The same muted screen and card as the password-recovery pair (the shared
// `console-password-card`): the authenticator code, a recovery code folded
// under a toggle, and the way back to sign in. Opened with no sign-in waiting,
// the platform draws its expired notice in place of the fields, linking back to
// the console's own sign-in card.
//
// PATHS ARE MOUNT-RELATIVE (`/login`). The mount primitive prefixes them.

import dashboardTwoFactor from './dashboard-two-factor.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardTwoFactor as PageConfig
