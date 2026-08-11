/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  evaluatePermission,
  OPEN_WHEN_UNDECLARED,
} from '@/domain/models/shared/permission-evaluation'
import type { PermissionValue } from '@/domain/models/shared/permissions'

/**
 * Form-intrinsic access control evaluation.
 *
 * Forms carry their own `access: { require, redirectTo }` block, independent
 * of any host page's access rules. The denial semantics differ from page
 * access (which 404s most denials for anti-enumeration):
 *
 *   - `require: 'all'` (or no access)        → always allowed
 *   - `require: 'authenticated'`, no session → 401 (auth challenge)
 *   - `require: [roles]`, role mismatch/anon → 404 (S1 anti-enumeration:
 *     hide the existence of a role-restricted form from users who lack the
 *     role, so it cannot be enumerated)
 *
 * The 401-vs-404 split is deliberate: `authenticated` advertises "log in to
 * use this", whereas a role gate hides the form entirely.
 */
export type FormAccessDecision =
  | { readonly kind: 'allow' }
  | { readonly kind: 'unauthorized'; readonly require: string }
  | { readonly kind: 'not-found' }

/** Minimal session shape consumed by the evaluator. */
export interface FormAccessSession {
  readonly userId: string
  readonly role: string
  readonly groups?: readonly string[]
}

/**
 * Evaluate a form's `access.require` against the (optional) session.
 *
 * A thin projection of the canonical {@link evaluatePermission} onto the form's
 * own denial vocabulary. Two policy choices are declared here rather than
 * assumed:
 *
 * - an UNDECLARED `require` leaves the form open — a form with no `access`
 *   block is a public form, which is the common case;
 * - there is NO admin override — `require: ['editor']` hides the form from an
 *   admin too. A form's audience is a product decision, not a privilege ladder.
 *
 * The evaluator's `denied` maps to 404 (never 403) so a role-gated form cannot
 * be enumerated, while `unauthorized` keeps its 401 auth challenge.
 */
export const evaluateFormAccess = (
  require: PermissionValue | undefined,
  session: FormAccessSession | undefined
): FormAccessDecision => {
  const decision = evaluatePermission(
    require,
    session === undefined ? undefined : { role: session.role, groups: session.groups },
    { whenUndeclared: OPEN_WHEN_UNDECLARED, adminOverride: 'no-admin-override' }
  )
  if (decision.kind === 'allow') return { kind: 'allow' }
  if (decision.kind === 'unauthorized') return { kind: 'unauthorized', require: 'authenticated' }
  return { kind: 'not-found' }
}
