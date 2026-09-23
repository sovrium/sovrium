/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's STANDALONE PREVIEW — `app.ts` plus the one thing a preview needs
// and the embedded preset must never carry.
//
// ─── WHY THIS FILE EXISTS AT ALL ───────────────────────────────────────────
//
// `app.ts` declares no `auth:` key, so booting it directly gives a console
// nobody can sign into: with no auth configured the platform mounts no
// `/api/auth/*` handler at all, and every admin-gated read answers 404. The
// pages still render — `/tables` returns 200 with its empty state — which is
// what made this confusing to diagnose: the preview looked like a console with
// no data rather than a console with no session.
//
// ─── WHY THE AUTH BLOCK IS NOT IN `app.ts` ─────────────────────────────────
//
// Because `app.ts` is not only an app. `scripts/build/generate-admin-preset.ts`
// freezes it into `src/infrastructure/assets/embedded-admin-preset.generated.ts`,
// the preset the binary mounts into every operator's app — and the mount's
// design REASONS ON the preset having no auth of its own.
//
// Concretely, `resolveRouteBoundTables` filters a grid's derived columns by
// field-level read permission against the RENDERING app, which under a mount is
// the console preset. `route-bound-table-resolver.ts:197` short-circuits that
// filter to full access when the rendering app declares no `auth` — which is
// what makes the mount's table PROJECTION the single place a restricted field is
// dropped. Give the preset an `auth` key and that branch stops short-circuiting:
// the console would start planning the operator's column permissions against
// the CONSOLE's auth configuration, on a path nothing covers.
//
// `embedded-app-mount.ts:355-375` states the same thing from the other side, and
// names merging auth into the console app as the alternative it REJECTED, "to
// fix a derivation that is already reachable from here". Every
// `system-config-mount` spec supplies auth on the OPERATOR app and mounts an
// auth-less console into it. That is the contract, and this file preserves it:
// `app.ts` stays byte-identical, so the embedded preset does too.
//
// ─── SO THE PREVIEW IS AN OPERATOR APP, AND A MINIMAL ONE ──────────────────
//
// Standalone, the console has no operator around it — so the preview plays that
// part, supplying exactly what an operator supplies and nothing else. The
// credentials come from `.env.example` (`AUTH_ADMIN_EMAIL` /
// `AUTH_ADMIN_PASSWORD`), which seeds a loginable admin on first boot while the
// user table is empty.
//
// Type-only import of the config type, like every other file in this tree: the
// binary loads a config with module specifiers left unresolved, so a value
// import would typecheck and then die at boot. `./app` is relative and stays
// inside `src/admin/`, which is the other half of the rule — held since the
// move by the `admin-config` element type in `[internal ref]`,
// where `check-admin-config-only.ts` used to hold it.

import app from './app'
import type { AppEncoded as AppConfig } from '@/domain/models/app'

/**
 * The preview app: the embedded console plus the one `auth:` block that makes
 * it signable-into on its own.
 *
 * @public — loaded BY NAME, never imported. `bun run app:admin` boots this
 * path and the CI config-validation step decodes it, so no module in the repo
 * names this export and Knip cannot see either caller.
 */
export default {
  ...app,

  // The smallest block that makes the console bootable on its own: one
  // strategy, and self-registration off.
  //
  // `allowSignUp: false` is not caution for its own sake — the console ships a
  // `/login` page and no sign-up page, so leaving registration on would expose a
  // registration endpoint no surface links to, on the one app whose whole
  // audience is a single operator. The admin arrives by env seeding instead.
  //
  // Nothing else is declared. No roles (the built-in `admin` is the console's
  // only audience), no 2FA, no email templates: each would be this file
  // inventing an operator policy, and the preview exists to show the console as
  // an operator sees it, not to model a particular operator.
  auth: {
    allowSignUp: false,
    strategies: [{ type: 'emailAndPassword' }],
  },

  // Booted standalone, this app IS the console — so it must not ALSO nest the
  // embedded console under `/_admin`; its sign-in is its own `/login`.
  admin: false,
} satisfies AppConfig
