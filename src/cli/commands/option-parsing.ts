/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, join, resolve } from 'node:path'

/**
 * Shared CLI option-parsing helpers.
 *
 * The `start` and `build` commands both read options from environment
 * variables before applying flag-over-env precedence. The common pieces live
 * here so the two commands agree on parsing semantics.
 */

/**
 * Parse a tri-state boolean environment variable.
 *
 * Returns `true`/`false` only for the exact strings `'true'`/`'false'`; any
 * other value (including `undefined` or an unrecognized string) yields
 * `undefined` so callers can distinguish "explicitly set" from "unset" and skip
 * the option entirely.
 */
export const parseBooleanEnv = (value: string | undefined): boolean | undefined =>
  value === 'true' ? true : value === 'false' ? false : undefined

/**
 * Read the static-asset public directory from `SOVRIUM_PUBLIC_DIR`.
 *
 * Shared by `sovrium start` (serves the directory) and `sovrium build` (copies
 * it into the output) so both resolve the env var identically. Returns
 * `undefined` when unset, letting each command fall back to its flag or default.
 */
export const readPublicDirEnv = (): string | undefined => Bun.env.SOVRIUM_PUBLIC_DIR

/**
 * Sentinel value for `SOVRIUM_PUBLIC_DIR` that disables static-asset serving.
 *
 * Mirrors the `--no-publicDir` CLI flag: `SOVRIUM_PUBLIC_DIR=none` is the
 * env-var equivalent. The plain string `'none'` was chosen (over `'off'` /
 * `'false'` / the empty string) because it visually matches the flag name and
 * cannot be confused with a relative path — an operator who happens to have a
 * directory literally named `none` would just pass `./none`.
 */
const PUBLIC_DIR_OPTOUT_SENTINEL = 'none'

/**
 * Return `true` when an env-var value explicitly opts OUT of static-asset
 * serving (`SOVRIUM_PUBLIC_DIR=none`). `undefined`, the empty string, and any
 * other path all return `false` — only the exact sentinel disables.
 */
export const isPublicDirOptOut = (value: string | undefined): boolean =>
  value === PUBLIC_DIR_OPTOUT_SENTINEL

/**
 * Resolve the default static-assets directory for `sovrium start` / `sovrium
 * build`: `./public` next to the config file (NOT next to the process CWD).
 *
 * Anchoring to the config-file directory is intentional — it makes the default
 * stable across `cd` operations, and prevents the same binary in two different
 * shells from accidentally serving two different file sets just because the
 * caller's CWD differs. Returns `undefined` when no config file path is known
 * (inline schema via `APP_SCHEMA=...`, or otherwise no positional arg) so the
 * caller silently skips the default rather than guessing an anchor.
 */
export const resolveDefaultPublicDir = (configFilePath: string | undefined): string | undefined => {
  if (!configFilePath) return undefined
  return join(dirname(resolve(configFilePath)), 'public')
}
