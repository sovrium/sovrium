/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// My profile — the IDENTITY half of the operator's own account.
//
// The DATA half (export, erasure) is `gdpr.ts`, and each page cross-links the
// other: the split is only an improvement while both halves stay findable.
//
// ─── ONE SETTINGS LIST, NOT SIX CARDS ──────────────────────────────────────
//
// Every property is a ROW on one hairline-separated grid: `label | control |
// action`. The previous shape gave each property its own bordered card, and the
// engine's form recipe drew a SECOND bordered card inside it — two frames
// painting the identical `oklch(0.995 0 0)`, so the inner one carried no
// information and, at 375px, cost 38px of gutter on each side. A settings list
// is a list; the rule between rows is the only separator it spends.
//
// The frame is declined in CONFIG, not by a new schema key: the form renderer
// merges `props.className` over its recipe through `resolveClasses`, so
// `border-0 bg-transparent p-0 rounded-none` on the form drops the card and
// `grid sm:grid-cols-[minmax(0,26rem)_auto]` re-lays the submit into its own
// right-hand column at its natural width — where the recipe's `w-full` column
// had stretched it to 692px.
//
// ─── BETTER-AUTH FORMS ONLY, NO ISLAND ──────────────────────────────────────
//
// | Row       | Endpoint                         | Note                        |
// |-----------|----------------------------------|-----------------------------|
// | Name      | `POST /api/auth/update-user`     | Better Auth catch-all       |
// | Email     | `POST /api/auth/change-email`    | `changeEmail.enabled: true` |
// | Password  | `POST /api/auth/change-password` | in the OpenAPI catalogue    |
// | Language  | `POST /api/auth/update-user`     | clamped to `languages`      |
// | Notify ×2 | `POST /api/auth/update-user`     | one `switch` per form       |
//
// `responseEnvelope: 'better-auth'` on every one: these are Better-Auth routes,
// which answer with their own envelope rather than Sovrium's `{ success }`.
//
// Each control arrives carrying what it is about to change — `defaultValue:
// '$session.name'` / `'$session.email'` / `'$session.language'`, resolved
// CLIENT-side from `GET /api/auth/get-session`. The served bytes name nobody, so
// a cached copy of this page cannot carry one reader's identity to the next.
//
// ─── TWO HONEST LIMITS, STATED RATHER THAN DESIGNED AROUND ─────────────────
//
// 1. An email change does NOT take effect on submit. Better Auth is configured
//    with `changeEmail: { enabled: true, sendChangeEmailVerification: … }`, so
//    the address does not move until the link is followed — measured live,
//    `POST /api/auth/change-email` answers `200 {"status":true}` while
//    `auth_user.email` is unchanged. A form reporting success over a value that
//    did not change reads as broken, so both the hint and the success status
//    name the pending step. Caveat: the verification mailer swallows send
//    failures by design, so on a host with no SMTP this still says "Verification
//    link sent" and none is. That is pre-existing and shared with password reset.
// 2. Saving a language takes effect on the spot, and it costs a reload to do
//    it. The server composes the console in the signed-in operator's language,
//    so the choice is real from the next request onward and invisible until
//    one happens. `onSuccess.reload: true` makes that request immediately; the
//    same document comes back in the new language, sidebar and breadcrumb
//    included, which `refetch` could never do because it skips any region
//    holding a mounted island. The trade is priced by the schema, which refuses
//    `reload` beside `status`: the confirmation cannot outlive the document, so
//    the switch itself is the confirmation.
//
// ─── ONE VOCABULARY FOR THE SUBMITS ────────────────────────────────────────
//
// ─── IDENTITY SAVES, PREFERENCES APPLY ─────────────────────────────────────
//
// Language and the two notification switches declare `submitOn: 'change'`:
// a preference is applied the moment it changes, so those rows draw no Save.
// Name, email and password keep an explicit one — a credential or an address
// change is a deliberate act, and the email row only sends a link.
//
// Each remaining row's `endpoint` names `submitVariant: 'outline'`. A settings list has
// one action per row and no primary among them, and this is the button schema's
// own member list saying so — not a scoped `[&>button[type=submit]]:` repaint
// painted from outside the component, which is what stood here until the key
// existed. It is `outline`, the variant the picture row's Change and the Your
// data link already draw, so every peer action on the page reads as one kind:
// one variant per role, and the only quieter one is Remove, a ghost. `/gdpr` needed no such change: its actions are plain `button`s that
// have always named their own `variant`, `destructive` on erasure included.

import dashboardProfile from './dashboard-profile.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardProfile as PageConfig
