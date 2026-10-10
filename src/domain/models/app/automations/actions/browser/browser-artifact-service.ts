/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a `browser/run` keeps its screenshots, and how the retention sweep
 * reads a key back.
 *
 * Every screenshot of a run sits under one prefix that names the run:
 * `browser-runs/<run id>/<nn>-<name>.png`. The sweep needs nothing but the key
 * to know which run made it — and so how old it is, an artifact's age being
 * its run's start — whatever bucket the run wrote it to. Pure.
 */

/** The prefix every browser screenshot is stored under. */
export const BROWSER_ARTIFACT_PREFIX = 'browser-runs/'

/** A file-name-safe version of a screenshot name. */
const safeName = (name: string): string =>
  name
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'screenshot'

/** The key of the `sequence`-th screenshot of the run `runId`. */
export const browserArtifactKey = (runId: string, sequence: number, name: string): string =>
  `${BROWSER_ARTIFACT_PREFIX}${runId}/${String(sequence).padStart(2, '0')}-${safeName(name)}.png`

/** The run a screenshot key belongs to, or `undefined` for a key outside the prefix. */
export const runIdOfArtifactKey = (key: string): string | undefined => {
  if (!key.startsWith(BROWSER_ARTIFACT_PREFIX)) return undefined
  const runId = key.slice(BROWSER_ARTIFACT_PREFIX.length).split('/')[0]
  return runId === undefined || runId === '' ? undefined : runId
}
