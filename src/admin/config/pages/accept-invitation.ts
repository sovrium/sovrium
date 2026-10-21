/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Where an invited operator lands from the email: who invited them, to which
// app, under which address — and one password to set.
//
// Public at exactly this path, like `/login`: the invitee has no account yet.
// It draws the sign-in card's frame (shadcn's login-03: the app's mark and
// name above one card on a muted ground) so the first console page someone
// sees and the one they will sign in on are the same place.
//
// `invitation: {}` reads the invitation the `?token=` names. A token that is
// expired, used or unknown draws one card saying the link no longer works and
// pointing to sign-in, without saying whether it ever was valid.
//
// The page renders inside the document's own `main`: the card is a `section`,
// never a second landmark.

import dashboardAcceptInvitation from './dashboard-accept-invitation.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardAcceptInvitation as PageConfig
