/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's retired addresses, and where each one now lives.
//
// Each section's address is the word its sidebar row says — Records, not
// tables; Runs, not automations — so the address and the label say the same
// word. Every old address is a bookmark, a link in a ticket or a line in a
// runbook somewhere, and a permanent move keeps each of them working.
//
// MOUNT-RELATIVE, like every page path: the mount serves these under `/_admin`
// and writes the base onto `to` itself. A rule is answered only to a caller
// the console would serve, so an anonymous request to an old address gets the
// same 404 as any console page — a 301 would tell it where the console is.
//
// Literal rules win over parametrised ones whatever the order, but they are
// written first anyway, so the table reads the way it resolves:
// `/users/invitations` is the Invitations tab, never an account by that name.
//
// No `/users/:id` rule: one account is still a page of its own at that
// address (`pages/data/users-account.ts`), and a rule would shadow it.

import type { AppEncoded as AppConfig } from '@/domain/models/app'

type Redirects = NonNullable<AppConfig['redirects']>

export const consoleRedirects: Redirects = [
  // Literal addresses first.
  { from: '/tables', to: '/records' },
  { from: '/forms', to: '/submissions' },
  { from: '/buckets', to: '/files' },
  { from: '/agents', to: '/conversations' },
  { from: '/automations', to: '/runs' },
  { from: '/pages', to: '/analytics' },
  { from: '/footprint', to: '/analytics?tab=footprint' },
  { from: '/users/invitations', to: '/users?tab=invitations' },
  // Then each object, which moves with its segment.
  { from: '/tables/:table', to: '/records/:table' },
  { from: '/tables/:table/access/:record', to: '/records/:table?record=:record&tab=access' },
  { from: '/forms/:form', to: '/submissions/:form' },
  { from: '/buckets/:bucket', to: '/files/:bucket' },
  { from: '/agents/:agent', to: '/conversations/:agent' },
  { from: '/automations/runs/:id', to: '/runs/:id' },
]
