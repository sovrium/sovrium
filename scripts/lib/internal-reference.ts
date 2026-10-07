/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shape of an identifier written for a reader INSIDE the repository — the
 * one list of id grammars every gate and generator that keeps them out of
 * public text reads from.
 *
 * The alternatives, in order:
 *
 *   - a decision record: `DEC-` or `GD-` and three digits;
 *   - a user story: `US-` and an upper-case area name;
 *   - a spec id: an upper-case prefix, at least one hyphenated segment, and a
 *     three-digit number.
 *
 * Each points at a tree the public mirror does not ship, so a reader outside
 * the repository can only follow it to a 404.
 *
 * It lives in `[internal ref]` rather than in the release canary that first
 * declared it because a BUILD script reads it too: the manual's generator
 * strips these ids from the Behaviour blocks it renders, and `scripts/build/`
 * ships to the public mirror while `[internal ref]` does not. The mirror's
 * import closure copies this module on demand; it could never copy the canary.
 * The canary composes its own pattern from this one plus the private host name,
 * so the id grammar is still written exactly once.
 */
export const INTERNAL_ID =
  /DEC-[0-9]{3}|GD-[0-9]{3}|US-[A-Z][A-Z0-9-]+|[A-Z]{2,}-[A-Z0-9-]+-[0-9]{3}/
