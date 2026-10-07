/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeRegExp } from '@/domain/kernel/sanitize/escape-regexp'
import {
  DEPRECATED_KEYS,
  collectDeprecationWarnings,
  type DeprecatedKey,
} from '@/domain/models/app/app-deprecated-keys'
import { printStderr } from '@/infrastructure/logging/cli-output'

/**
 * The environment variable that ADDS entries to the deprecation table.
 *
 * The production table is empty until the first deprecation under [internal ref], so
 * without this no config could ever exercise the warning path end to end. The
 * value is a JSON array of `{ node, discriminant?, key, replacement,
 * deprecatedIn, removedIn }`. `node` is the dotted path with its indices left
 * empty — `tables[].fields[]` — never a regular expression, so a value from the
 * environment cannot carry a backtracking pattern. It can only ever add
 * warnings: it never changes what decodes or the exit code.
 */
const EXTRA_DEPRECATIONS_ENV = 'SOVRIUM_DEPRECATED_KEYS_FIXTURE'

const isString = (value: unknown): value is string => typeof value === 'string'

/** `tables[].fields[]` → `/^tables\[\d+\]\.fields\[\d+\]$/`: escaped, then `[]` widened to any index. */
const nodePattern = (path: string): RegExp =>
  new RegExp(`^${escapeRegExp(path).replaceAll('\\[\\]', '\\[\\d+\\]')}$`)

/** One raw entry, or `undefined` when it is malformed (a bad entry is skipped, never fatal). */
const toDeprecatedKey = (raw: unknown): DeprecatedKey | undefined => {
  if (typeof raw !== 'object' || raw === null) return undefined
  const entry = raw as Readonly<Record<string, unknown>>
  const { node, key, replacement, deprecatedIn, removedIn, discriminant } = entry
  if (![node, key, replacement, deprecatedIn, removedIn].every(isString)) return undefined
  return {
    node: nodePattern(node as string),
    key: key as string,
    replacement: replacement as string,
    deprecatedIn: deprecatedIn as string,
    removedIn: removedIn as string,
    ...(isString(discriminant) && { discriminant }),
  }
}

/** The entries the environment adds; `[]` when unset or unparseable. */
const extraDeprecations = (): readonly DeprecatedKey[] => {
  const value = process.env[EXTRA_DEPRECATIONS_ENV]
  if (value === undefined || value.trim() === '') return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.map(toDeprecatedKey).filter((entry) => entry !== undefined)
      : []
  } catch {
    return []
  }
}

/**
 * Print one `Warning:` line per deprecated key the RAW config uses, on stderr.
 *
 * Called by `validate`, `start` and `build` on the parsed config BEFORE it is
 * decoded: a deprecated key still decodes, so nothing downstream would ever
 * mention it. Stderr, so a caller piping stdout still reads only the verdict;
 * the exit code is untouched, because a deprecated key is still accepted.
 */
export const printConfigDeprecationWarnings = (config: unknown): void => {
  const warnings = collectDeprecationWarnings(config, [...DEPRECATED_KEYS, ...extraDeprecations()])
  if (warnings.length === 0) return
  printStderr(warnings.map((warning) => `Warning: ${warning.message}`).join('\n'))
}

/**
 * {@link printConfigDeprecationWarnings} on a loaded schema, handing it back:
 * `start` and `build` warn on the raw `app` before it reaches the decoder.
 */
export const warnDeprecatedKeys = <T extends { readonly app: unknown }>(resolved: T): T => {
  printConfigDeprecationWarnings(resolved.app)
  return resolved
}
