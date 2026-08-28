/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { BUCKET_FILE_ACTIONS, type BucketPermissions } from './permissions'
import type { Bucket } from './bucket'

/**
 * Permissions the IMPLICIT `default` bucket must adopt from the app's DECLARED
 * buckets, so that a bucket nobody declared can never out-rank one that was.
 *
 * WHY THIS EXISTS
 * ---------------
 * The file routes synthesise `{ name: 'default', public: !app.auth }` for any
 * request naming `default`, whether or not the app declares one. That synthetic
 * bucket carries no `permissions`, so every gate on it collapses to the
 * undeclared default — "a session is required".
 *
 * On its own that is the intended compatibility fallback: an app that never
 * wrote a `buckets[]` block still needs somewhere to put a form attachment
 * (`[internal ref]`/`-014`). It becomes a privilege escalation only in
 * combination with the second fact: `StorageService` addresses objects by a
 * FLAT key with no bucket dimension, so the key of an object the operator
 * reserved to `admin` can simply be handed to the phantom bucket, where nothing
 * reserves it. One declared bucket is enough — no permissive sibling is needed.
 *
 * THE RULE, AND WHY IT IS THIS RULE
 * ---------------------------------
 * Strictest-declared-wins, restricted to ROLE ARRAYS. On the file endpoints the
 * ladder has exactly three reachable rungs, and only one of them is stricter
 * than the implicit bucket's own posture:
 *
 * - `'all'` is LOOSER than "a session is required", so it cannot tighten.
 * - `'authenticated'` is the SAME rung as undeclared on an auth-enabled app.
 *   On an app with no auth it would be stricter — and would also deny everyone,
 *   since no session can exist there, breaking the anonymous form upload the
 *   implicit bucket exists for. Deliberately excluded.
 * - A role array is the only rung that is strictly stricter, so it is the only
 *   one that propagates.
 *
 * Where several buckets declare a role array for the same action the result is
 * their INTERSECTION: the object behind a flat key may belong to any of them,
 * so the phantom bucket must satisfy all of them at once. An empty intersection
 * is a legitimate outcome — it denies every role while the `admin` override
 * still passes, which is the correct fail-closed answer.
 *
 * WHAT THIS DOES NOT DO
 * ---------------------
 * It gives the implicit bucket no bucket→object binding, so it cannot stop one
 * DECLARED bucket being used to reach another declared bucket's object. That
 * needs a bucket dimension on the storage port and is tracked separately
 * (`[internal ref]`/`-003`).
 *
 * Nor does it touch `public`. `public: true` short-circuits the read gate
 * before any permission is consulted, and the implicit bucket is
 * public only when the app configures no auth at all — where role arrays are
 * meaningless anyway.
 *
 * The escape hatch, for an operator who wants different behaviour, is the same
 * one every other bucket uses: declare `default` in `buckets[]` explicitly and
 * give it the permissions you mean. A declared bucket always wins outright.
 */
export const deriveImplicitBucketPermissions = (
  declared: readonly Bucket[] | undefined
): BucketPermissions | undefined => {
  if (declared === undefined || declared.length === 0) return undefined

  const tightened = BUCKET_FILE_ACTIONS.flatMap((action) => {
    const roleLists = declared
      .map((bucket) => bucket.permissions?.[action])
      .filter((permission): permission is readonly string[] => Array.isArray(permission))
    return roleLists.length === 0 ? [] : [[action, intersectRoles(roleLists)] as const]
  })

  return tightened.length === 0
    ? undefined
    : tightened.reduce<BucketPermissions>(
        (permissions, [action, roles]) => ({ ...permissions, [action]: roles }),
        {}
      )
}

/**
 * The roles admitted by EVERY list — the meet of the role-array rung.
 *
 * Called only with a non-empty list of lists, so the seedless `reduce` is safe;
 * seeding it would require a universe of all roles, which does not exist.
 */
const intersectRoles = (roleLists: readonly (readonly string[])[]): readonly string[] =>
  roleLists.reduce((admitted, roles) => admitted.filter((role) => roles.includes(role)))
