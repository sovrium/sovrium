/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The runtime value of a `with { type: 'file' }` import, typed as what it is.
 *
 * Bun embeds a file imported `with { type: 'file' }` and hands back its PATH:
 * a real one in dev, a directory-less `/$bunfs/root/<name>-<hash>.<ext>` inside
 * the compiled binary. TypeScript does not model the attribute, so it types the
 * import as the file's CONTENT (the JSON's shape, for a `.json`). Every reader
 * used to recover the path with `as unknown as string`, a double assertion that
 * would have hidden a payload of any other shape; these check instead, once, at
 * module load, and fail loudly if the value is not what Bun documents.
 *
 * An ambient module declaration cannot do this: a `.json` import resolves to
 * the real file before any `declare module` pattern is consulted.
 */

/** The path an embedded file import resolves to. */
export const embeddedFilePath = (raw: unknown): string => {
  if (typeof raw !== 'string') {
    throw new TypeError(`an embedded file import resolved to a ${typeof raw}, not a path`)
  }
  return raw
}

/** A generated map of embedded file imports: each value is the path of one file. */
export const embeddedFilePaths = (raw: unknown): Readonly<Record<string, string>> => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new TypeError('an embedded file map is not an object')
  }
  const entries = Object.entries(raw)
  const notAPath = entries.find(([, value]) => typeof value !== 'string')
  if (notAPath !== undefined) {
    throw new TypeError(`the embedded file "${notAPath[0]}" did not resolve to a path`)
  }
  return Object.fromEntries(entries.map(([key, value]) => [key, embeddedFilePath(value)]))
}
