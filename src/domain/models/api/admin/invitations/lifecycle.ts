/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for the admin invitation-lifecycle surface
 *:
 *
 *   - `GET    /api/admin/invitations`             — list what is outstanding
 *   - `POST   /api/admin/invitations/:id/resend`  — send it again
 *   - `DELETE /api/admin/invitations/:id`         — take it back
 *
 * WHY THIS SURFACE EXISTS (the hole it closes)
 * --------------------------------------------
 * Sovrium can ISSUE an invitation (`POST /api/auth/admin/invite-user`) and
 * ACCEPT one (`POST /api/auth/admin/accept-invitation`). It cannot show you the
 * ones outstanding. Invitations live as rows in Better Auth's `verification`
 * table under the `invitation:` identifier prefix, and every helper that reads
 * them (`invitation-queries.ts`) is keyed by token or by user id and called only
 * internally. Nothing enumerates them. An operator who invites someone and hears
 * nothing back cannot tell whether the invitation is pending, expired, or was
 * already accepted — three different problems with three different next actions.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * THE IDENTITY DECISION: an invitation is addressed by its ID, never its TOKEN
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * This is the load-bearing decision of the whole surface, and it is forced.
 *
 * Two requirements collide. The list is the operator's ONLY enumeration surface,
 * so whatever identifies a row here is the only handle they can hand to resend
 * and revoke. And the token must NOT appear in this list: this is an operator
 * console read, so a token in the payload becomes a credential in a server log,
 * a screenshot, a browser history entry, and a support-ticket paste (S4). Both
 * cannot hold if the mutation routes are token-keyed — a token-keyed route is
 * literally uncallable from the surface it is meant to serve.
 *
 * The security requirement wins, so the identifier must be something else:
 *
 *   **`id` = the `verification.id` UUID** that already exists — generated at
 *   `admin-invitation.ts` (`crypto.randomUUID()`), already the primary key, and
 *   already the key `deleteInvitationToken(id)` takes.
 *
 * The split this creates is the point, and it is a capability split, not an
 * obfuscation one:
 *
 *   - the **id** is an IDENTIFIER. Holding it lets an ALREADY-ADMIN-TIER caller
 *     list, resend, or revoke. On its own it confers nothing — every route that
 *     accepts it is behind the admin gate, so an id that leaked into a log is
 *     inert to whoever reads that log.
 *   - the **token** is a CREDENTIAL. It is bearer: presenting it to the
 *     unauthenticated `accept-invitation` endpoint claims the account. It
 *     therefore only ever travels to the invitee's inbox, and never returns
 *     through an operator-facing response — not in the list, and not in the
 *     resend reply either (see {@link adminInvitationResendResponseSchema}).
 *
 * Holding an id can never be escalated into accepting an invitation, because
 * accept requires the token and no admin-plane response ever carries one.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * WHERE `invitedBy` COMES FROM (a storage change is required)
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * The invitation row is a Better Auth `verification` row: `id`, `identifier`
 * (`invitation:<token>`), `value` (the invitee's user id), `expiresAt`,
 * `createdAt`. There is no inviter column and no role column.
 *
 *   - `role`      — recoverable TODAY. Join `auth.user` on `value = user.id`
 *                   and read `user.role`. Deliberately NOT copied into the
 *                   invitation row: the account's role is one fact with one
 *                   home, and a copy taken at invite time would drift the
 *                   moment an operator changed the role before acceptance.
 *   - `invitedBy` — recoverable from NOTHING. It is not persisted anywhere
 *                   today (the inviter's name is read off the session at
 *                   `admin-invitation-routes.ts` purely to interpolate the
 *                   e-mail template, and is then discarded).
 *
 * DECIDED: widen `verification.value` into a JSON envelope
 * `{"userId":"…","invitedBy":"<inviter user id>"}`, keeping the invitation as
 * ONE row. Rationale, and the objections it answers:
 *
 *   - **One entity, one row.** Sovrium already squats on Better Auth's
 *     `verification` table for invitations; a side table keyed to that row would
 *     buy the appearance of architectural cleanliness while actually splitting a
 *     single entity across two stores whose true home is neither. The genuinely
 *     honest fix is a Sovrium-owned `invitations` table that stops squatting —
 *     named as a follow-up below, deliberately out of scope here because it
 *     requires migrating live pending invitations.
 *   - **No migration.** `value` is `text NOT NULL` in both dialects.
 *   - **The predicate objection dissolves.** The obvious cost of an envelope is
 *     that `deletePendingInvitationsForUser` currently does an exact
 *     `eq(value, userId)`, which an envelope would degrade into an unindexable
 *     `LIKE '%…%'` substring match. It does not have to: this list endpoint
 *     already forces a `identifier LIKE 'invitation:%'` prefix scan plus a
 *     per-row parse, and the pending-invitation population of one self-hosted
 *     app is tiny. Express the delete on top of that same scan — select the
 *     matching rows, parse, delete by `id` — and it stays an EXACT match on the
 *     primary key rather than becoming a substring guess.
 *   - **Better Auth never reads these rows.** They are segregated by the
 *     `invitation:` identifier prefix, so no upstream code inspects `value`.
 *
 * Store the inviter's **user id**, not their e-mail: ids are stable, e-mails are
 * mutable and are PII. This response RESOLVES that id to the current e-mail by
 * joining `auth.user`, which is what an operator can actually recognise.
 *
 * `invitedBy` is therefore NULLABLE, and the null case is real rather than
 * defensive: a row written before this change carries a bare user-id string in
 * `value`, not an envelope. The parser must tolerate that (a non-JSON `value`
 * means `{ userId: value, invitedBy: null }`), which degrades an upgraded app's
 * pre-existing pending invitations gracefully instead of failing to list them.
 * `null` here means "not recorded", never "invited by nobody".
 *
 * NAMED FOLLOW-UP (not this campaign): move invitations off Better Auth's
 * `verification` table onto a Sovrium-owned table that models the entity
 * directly — inviter, role, token hash, expiry, acceptance. Both the envelope
 * above and any side-table alternative are workarounds for not owning the
 * entity; only that move removes the workaround.
 *
 * Source story: [internal ref]
 *
 * @see src/domain/models/api/admin/connections/connections.ts — the flat
 *   admin-list-response precedent (no cursor envelope) and the derived-`status`
 *   pattern this mirrors.
 * @see src/domain/models/api/admin/users/directory.ts — the sibling admin
 *   surface gated by `requireAdminTier` rather than Better Auth's literal-`admin`
 *   check; this surface must use the same gate for the same reason (an app whose
 *   top operator role is custom, e.g. partner's `engineer`, is admin-tier in
 *   Sovrium's model and must not be locked out).
 * @see src/infrastructure/auth/better-auth/invitation-queries.ts — the three
 *   `value` readers the JSON envelope touches.
 */

import { z } from '@hono/zod-openapi'

// ─── Derived Status ──────────────────────────────────────────────────────────

/**
 * Lifecycle state of a pending invitation, DERIVED per row at read time by
 * comparing `expiresAt` against now — not a stored column.
 *
 *   - `pending` — still acceptable; the emailed link works.
 *   - `expired` — the TTL lapsed; the link is dead and the operator must
 *     resend (or revoke and re-invite).
 *
 * An expired invitation is LISTED, not silently omitted. "It expired" and "it
 * was never sent" are different operator problems with different next actions,
 * and a list that drops expired rows collapses them into one — leaving the
 * operator staring at an empty list with no way to tell which happened.
 *
 * There is deliberately no `accepted` member. Acceptance CONSUMES the row
 * (`deleteInvitationToken` on the accept path), so an accepted invitation is
 * absent rather than differently-flagged — its account now shows up in the user
 * directory, which is where an accepted invitee belongs.
 */
export const pendingInvitationStatusSchema = z
  .enum(['pending', 'expired'])
  .describe(
    'Derived lifecycle state: `pending` (still acceptable) or `expired` (TTL lapsed, link dead). Computed from `expiresAt` at read time, not stored. Accepted invitations are absent entirely — acceptance consumes the row.'
  )

/** @public */
export type PendingInvitationStatus = z.infer<typeof pendingInvitationStatusSchema>

// ─── Pending Invitation Row ──────────────────────────────────────────────────

/**
 * A single outstanding invitation, as the operator console renders it.
 *
 * `.strict()` is the SECURITY INVARIANT and it is doing specific work here, not
 * boilerplate: this is the one admin surface adjacent to a live bearer
 * credential. Any extra key — `token`, `value`, `identifier`, or anything else
 * carrying the `invitation:<token>` material — fails validation rather than
 * leaking. The exposed set is exactly what the row needs to be acted on:
 *
 *   - `id`        — the handle resend and revoke take (see the file docstring's
 *     identity decision);
 *   - `email`     — who was invited, the row's primary column;
 *   - `role`      — the role the account will hold on acceptance, read live from
 *     `auth.user.role`;
 *   - `invitedBy` — which operator issued it, resolved to their current e-mail;
 *   - `status`    — the derived pending/expired badge;
 *   - `expiresAt` — when the link dies, so the operator can judge whether a
 *     resend is warranted before the invitee ever asks;
 *   - `createdAt` — how long this has been outstanding.
 */
export const pendingInvitationSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .describe(
        'Opaque invitation identifier (`verification.id`, a uuid). The path segment the resend and revoke routes resolve by. NOT the invitation token: holding this id confers nothing outside the admin gate, and it can never be exchanged for an accepted account.'
      ),
    email: z
      .string()
      .min(1)
      .describe(
        'E-mail address the invitation was issued to (`auth.user.email`, joined on the invitee user id). The list’s primary column.'
      ),
    role: z
      .string()
      .min(1)
      .describe(
        'Role the invited account currently holds (`auth.user.role`), and therefore the role it will carry on acceptance. Read live from the user row rather than copied onto the invitation, so an operator who changes the role before acceptance sees the change reflected here. Always a member of this app’s assignable role vocabulary — `invite-user` refuses anything else before minting a token.'
      ),
    invitedBy: z
      .string()
      .min(1)
      .nullable()
      .describe(
        'Current e-mail of the operator who issued the invitation, resolved from the stored inviter user id by joining `auth.user`. `null` when the inviter was not recorded — the case for invitations issued before inviter capture existed, whose `verification.value` holds a bare user id rather than the JSON envelope. `null` means "not recorded", never "invited by nobody".'
      ),
    status: pendingInvitationStatusSchema,
    expiresAt: z
      .string()
      .datetime()
      .describe(
        'ISO 8601 UTC timestamp at which the invitation link stops working (`verification.expires_at`). Governed by `auth.invitationTokenExpiry` (default 72h). A timestamp in the past is exactly the condition that makes `status` `expired`.'
      ),
    createdAt: z
      .string()
      .datetime()
      .describe(
        'ISO 8601 UTC timestamp the invitation was issued (`verification.created_at`). Lets the operator see how long an invitation has been outstanding.'
      ),
  })
  .strict()
  .openapi('PendingInvitation')

// ─── List Response ───────────────────────────────────────────────────────────

/**
 * Response schema for `GET /api/admin/invitations`.
 *
 * A flat `{ items }` list — no cursor envelope. Outstanding invitations are
 * bounded by the TTL (72h by default) and by how many people one operator is
 * actively onboarding, so this is small by construction, in the same way the
 * connections and user-directory lists are.
 *
 * `items` rather than `invitations`: the sibling admin lists name their array
 * after the entity (`connections`, `users`), but those are whole-population
 * reads. This one is a FILTERED view — outstanding invitations, not every
 * invitation that ever existed — and `invitations` would over-promise exactly
 * the enumeration the surface does not offer. `items` says "these rows", which
 * is what it is.
 *
 * `.strict()` at the envelope level too, so a stray top-level key (a debug
 * `tokens` array, a `raw` passthrough) cannot smuggle credential material past
 * the boundary alongside a well-formed `items`.
 *
 * An app with nothing outstanding returns `items: []` — the console's calm empty
 * state, and a meaningfully different answer from a 404.
 */
export const adminInvitationsListResponseSchema = z
  .object({
    items: z
      .array(pendingInvitationSchema)
      .describe(
        'Every OUTSTANDING invitation — both `pending` and `expired`. Accepted and revoked invitations are absent, their rows having been consumed or deleted.'
      ),
  })
  .strict()
  .openapi('AdminInvitationsListResponse')

// ─── Resend Response ─────────────────────────────────────────────────────────

/**
 * Response schema for `POST /api/admin/invitations/:id/resend`.
 *
 * Returns the invitation in its refreshed state so the console can patch the row
 * in place — a new `expiresAt`, and `status` back to `pending` if the resend
 * revived an expired one.
 *
 * TWO contract commitments the shape encodes:
 *
 * 1. **No token, deliberately.** The obvious convenience — hand the caller the
 *    fresh token so tooling can build the link — would put a live bearer
 *    credential into an operator's browser and the server's response log,
 *    defeating the entire reason the list omits it. The invitee's inbox stays
 *    the only place the token ever lands. This is also why the resend reply is
 *    the invitation row and not a bare `{ ok: true }`: the operator needs the
 *    new expiry, and nothing else.
 * 2. **`id` is STABLE across a resend.** The returned `invitation.id` equals the
 *    `:id` that was called, because the console holds that id and must be able
 *    to patch the row it already renders. A resend therefore REFRESHES the
 *    existing invitation rather than deleting and re-inserting it — an
 *    implementation that replaces the row would hand back an id the caller
 *    never asked about and orphan the rendered one.
 *
 * Whether the resend REUSES or ROTATES the underlying token is left open by
 * [internal ref] and is invisible here by construction — which is the right place for
 * that seam. Either way the invariant the operator depends on holds: exactly one
 * live invitation per address, and the link most recently e-mailed works.
 */
export const adminInvitationResendResponseSchema = z
  .object({
    invitation: pendingInvitationSchema.describe(
      'The invitation in its post-resend state — same `id`, refreshed `expiresAt`, `status` back to `pending`. Carries no token, by the same rule that keeps it out of the list.'
    ),
  })
  .strict()
  .openapi('AdminInvitationResendResponse')

// ─── Revoke Response ─────────────────────────────────────────────────────────

/**
 * Response schema for `DELETE /api/admin/invitations/:id`.
 *
 * Echoes the `id` that was revoked so a console handling several in-flight row
 * actions can match the reply to the row it must drop, rather than assuming
 * ordering.
 *
 * The revoked row is NOT returned. It no longer exists — the verification row is
 * deleted outright, which is what makes the emailed link genuinely inert rather
 * than merely hidden from the operator's list. A revoke that only cleared the
 * console would be cosmetic: an outstanding standing grant the operator believes
 * they cancelled. Returning the deleted row's fields would invite exactly that
 * misreading.
 *
 * `revoked` is always `true` — a literal, not a status flag. A failed revoke is
 * an HTTP failure (404 for an id that does not exist or that this caller may not
 * see), never a 200 carrying `revoked: false`.
 */
export const adminInvitationRevokeResponseSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .describe('The invitation id that was revoked — echoes the `:id` path segment.'),
    revoked: z
      .literal(true)
      .describe(
        'Always `true`. Revocation failure is signalled by HTTP status (404 — never 403, per S1 anti-enumeration), never by a `false` here.'
      ),
  })
  .strict()
  .openapi('AdminInvitationRevokeResponse')

// ─── Inferred types ──────────────────────────────────────────────────────────

/** @public */
export type PendingInvitation = z.infer<typeof pendingInvitationSchema>
/** @public */
export type AdminInvitationsListResponse = z.infer<typeof adminInvitationsListResponseSchema>
/** @public */
export type AdminInvitationResendResponse = z.infer<typeof adminInvitationResendResponseSchema>
/** @public */
export type AdminInvitationRevokeResponse = z.infer<typeof adminInvitationRevokeResponseSchema>
