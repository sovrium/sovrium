/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared fail-fast parsing for the `ECO_*` operator environment variables
 *.
 *
 * Every `ECO_*` parser used to resolve an unrecognised value to its default.
 * That made a typo indistinguishable from an unset variable — and the two mean
 * opposite things. `ECO_MODE=strcit` looked exactly like "operator never
 * configured eco posture", so the platform ran `balanced` while the operator
 * believed it was running `strict`. `ECO_AI_MAX_CARBON_CLASS=X` fell back to
 * `G`, the MOST permissive cap, so a typo in a tightening control silently
 * loosened it. Worst of all, `ECO_RETENTION_PURGE_DAYS=3O` (letter O) parsed as
 * `3` and enabled a three-day purge of soft-deleted rows.
 *
 * The contract these helpers enforce, stated as the mirror of the app-config
 * contract from [internal ref]:
 *
 * > The app config refuses an unknown KEY. The environment must refuse an
 * > unknown VALUE.
 *
 * **Unset stays default.** Only a SET-but-unrecognised value throws. Operators
 * who never touch an `ECO_*` var keep every existing default, so this is not a
 * new configuration burden — it is a guarantee that what you typed is what runs.
 *
 * The thrown `Error` names the variable, the accepted values, and the raw input,
 * matching `parseStorageDefaultAccess` in `../storage/storage-public-access.ts`.
 * `validateEcoEnv` (infrastructure) calls every parser once at boot so a typo
 * refuses startup rather than surfacing later on a dashboard read or a request.
 */

/** Render an accepted-value list for an error message: `"a", "b" or "c"`. */
const renderAllowed = (allowed: readonly string[]): string => {
  const quoted = allowed.map((value) => `"${value}"`)
  if (quoted.length <= 1) return quoted[0] ?? ''
  return `${quoted.slice(0, -1).join(', ')} or ${quoted[quoted.length - 1]}`
}

/** The closed vocabulary of one `ECO_*` variable, and what absence resolves to. */
export interface EcoEnumSpec<T extends string> {
  /** Every value the variable accepts. Anything else is refused. */
  readonly allowed: readonly T[]
  /** What an unset or empty variable resolves to. */
  readonly fallback: T
  /** Case normalisation before comparison. `upper` serves the A–G carbon classes. */
  readonly caseFold?: 'lower' | 'upper'
}

/**
 * Resolve a closed-vocabulary `ECO_*` variable.
 *
 * - unset / empty / whitespace-only → `spec.fallback`
 * - a recognised value             → that value
 * - anything else                  → throws, naming the variable and the vocabulary
 *
 * @throws Error when the variable is set to a value outside `spec.allowed`.
 */
export const parseEcoEnum = <T extends string>(
  varName: string,
  raw: string | undefined,
  spec: EcoEnumSpec<T>
): T => {
  const trimmed = raw?.trim()
  if (trimmed === undefined || trimmed === '') return spec.fallback
  const value = spec.caseFold === 'upper' ? trimmed.toUpperCase() : trimmed.toLowerCase()
  if ((spec.allowed as readonly string[]).includes(value)) return value as T
  // eslint-disable-next-line functional/no-throw-statements -- mirrors parseStorageDefaultAccess: throw so the env-var name surfaces at startup
  throw new Error(`Invalid ${varName}: expected ${renderAllowed(spec.allowed)}, got "${raw}"`)
}

/**
 * Resolve an integer-valued `ECO_*` variable.
 *
 * Returns `undefined` for unset / empty so each caller decides what absence
 * means (a byte budget falls back to a default; a purge horizon means "never").
 *
 * Deliberately STRICTER than `Number.parseInt`, which is the whole point:
 * `parseInt` reads a prefix and discards the rest, so `"3O"` (digit three,
 * letter O) yields `3` and `"64MB"` yields `64`. For a purge horizon that
 * silently destroys data on a schedule nobody chose. A full-string digit match
 * is the only reading that cannot be accidentally right.
 *
 * @throws Error when set to a non-integer or to an integer below `min`.
 */
export const parseEcoInteger = (
  varName: string,
  raw: string | undefined,
  min: number
): number | undefined => {
  const trimmed = raw?.trim()
  if (trimmed === undefined || trimmed === '') return undefined
  if (!/^-?\d+$/.test(trimmed)) {
    // eslint-disable-next-line functional/no-throw-statements -- mirrors parseStorageDefaultAccess: throw so the env-var name surfaces at startup
    throw new Error(
      `Invalid ${varName}: expected a whole number, got "${raw}". ` +
        `Note a partial number is rejected on purpose — "3O" (letter O) would otherwise read as 3.`
    )
  }
  const parsed = Number.parseInt(trimmed, 10)
  if (parsed < min) {
    // eslint-disable-next-line functional/no-throw-statements -- mirrors parseStorageDefaultAccess: throw so the env-var name surfaces at startup
    throw new Error(`Invalid ${varName}: expected an integer >= ${min}, got "${raw}"`)
  }
  return parsed
}
