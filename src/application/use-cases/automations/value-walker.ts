/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Apply `transform` to every string leaf inside an arbitrarily nested value.
 *
 * Traverses arrays and plain objects structurally; non-string scalars
 * (numbers, booleans, null, undefined) pass through unchanged. The
 * transform is a pure `string -> string` function so callers stay
 * trivially testable.
 *
 * This is the single source of truth for the "walk a JSON-shaped value
 * and rewrite each string" pattern that the automation pipeline relies
 * on. It currently powers four passes:
 *
 *   - `$env.VAR` resolution           (resolve-env-vars.ts)
 *   - `{{trigger.data.X}}` resolution (resolve-trigger-data.ts)
 *   - `$varName` ref-template subst.  (expand-action-refs.ts)
 *   - secret redaction                (redact-secrets.ts)
 *
 * As future migration specs add more passes (step outputs, loop items,
 * full template helpers), each becomes a one-liner over `mapStringsDeep`
 * rather than a fresh hand-rolled traversal.
 */
export const mapStringsDeep = (value: unknown, transform: (s: string) => string): unknown => {
  if (typeof value === 'string') return transform(value)
  if (Array.isArray(value)) return value.map((item) => mapStringsDeep(item, transform))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        mapStringsDeep(v, transform),
      ])
    )
  }
  return value
}
