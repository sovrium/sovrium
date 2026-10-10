/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import {
  BUNDLE_CONFIG_ENTRY,
  BUNDLE_MANIFEST_ENTRY,
} from '@/application/use-cases/server/bundle-manifest'

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
 * build`: `./public` next to the config file (NOT next to the process CWD),
 * or at the root of an unpacked bundle (see {@link resolveProjectRoot}).
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
  return join(resolveProjectRoot(configFilePath), 'public')
}

/**
 * The directory a config's default `public/` and `seed/` sit in.
 *
 * For a plain project that is the config file's own directory. An unpacked
 * bundle is laid out differently: the config is `<root>/project/app.json`
 * while `public/`, `seed/` and `manifest.json` sit at `<root>`. So when the
 * config is the bundle's config entry AND `<root>/manifest.json` exists, the
 * anchor is `<root>` — `sovrium start` and `sovrium seed` run an unpacked
 * bundle as it is, with no flag. Both conditions are required, so a project
 * that merely keeps its config under a `project/` folder is unaffected.
 */
export const resolveProjectRoot = (configFilePath: string): string => {
  const configPath = resolve(configFilePath)
  const entryParts = BUNDLE_CONFIG_ENTRY.split('/')
  const bundleRoot = resolve(dirname(configPath), ...entryParts.slice(1).map(() => '..'))
  const isConfigEntry = relative(bundleRoot, configPath) === join(...entryParts)
  return isConfigEntry && existsSync(join(bundleRoot, BUNDLE_MANIFEST_ENTRY))
    ? bundleRoot
    : dirname(configPath)
}

/**
 * The public directory the OPERATOR named (`--publicDir` or
 * `SOVRIUM_PUBLIC_DIR`) when it is not a directory on disk, else `undefined`.
 *
 * A missing DEFAULT `./public` is normal — most apps have none — and stays
 * quiet. A path somebody typed and got wrong is a mistake worth one line at
 * boot, because the server otherwise starts and answers 404 for every file.
 */
export const missingNamedPublicDir = (named: string | undefined): string | undefined => {
  if (named === undefined || named === '' || isPublicDirOptOut(named)) return undefined
  const path = resolve(named)
  const isDirectory = existsSync(path) && statSync(path).isDirectory()
  return isDirectory ? undefined : path
}
