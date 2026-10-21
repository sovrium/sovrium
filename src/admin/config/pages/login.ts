/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The public operator sign-in surface, INSTALLED from the library's `login-03`
// block (shadcn's login on a muted ground: the app's mark above a card).
// `Console Block Parity` holds this copy to the block with its bindings dropped;
// re-install with `sovrium library add block/login-03 --update`, never hand-edit
// the structure.
//
// The ONLY unguarded page under the console's base: the auth seam exempts
// `/_admin/login` so an anonymous operator can sign in, while the base itself
// stays 404-anonymous (standing rule S1). That carve-out is an EXACT-MATCH set,
// never a prefix.
//
// ─── THE BINDINGS ───────────────────────────────────────────────────────────
//
// The mark, the card's title and description, the testid of the block's
// `statusLine` (set to the console's session-ended copy), and the ways in. The
// block's field group lists every way an app may offer (social buttons,
// passkey, magic link, single sign-on, sign-up), each gated on what the app
// declares; the console's field group is its own: Sovrium Cloud, the "or"
// separator and the email form (`#admin-login-form`). The form draws its own
// "Forgot your password?" in the Password label row, because the console serves
// a password-reset request page (`/forgot-password`); without outgoing mail that
// page is dropped and the link with it. The console has no magic-link, SSO or
// sign-up page of its own, so those rows would link to nothing under its base.
//
// PATHS ARE MOUNT-RELATIVE (`/`, `/forgot-password`): the mount primitive
// prefixes them with the console's base at render time. The root carries
// `data-admin-base-path` for the same reason the shell does.

import dashboardLogin from './dashboard-login.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardLogin as PageConfig
