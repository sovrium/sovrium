/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A readable name for the device a session was opened on — "Firefox on
 * macOS" — from its User-Agent header, for the sessions list of an account
 * page. A label, not a fingerprint: only the browser family and the system
 * are read, and an agent neither matches is "Unknown device".
 */

const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\/|Chromium\/|HeadlessChrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Windows/, 'Windows'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
]

const first = (agent: string, table: readonly (readonly [RegExp, string])[]) =>
  table.find(([pattern]) => pattern.test(agent))?.[1]

/** "Firefox on macOS", "Chrome", "macOS", or "Unknown device". */
export const describeUserAgent = (agent: string): string => {
  const browser = first(agent, BROWSERS)
  const system = first(agent, SYSTEMS)
  if (browser !== undefined && system !== undefined) return `${browser} on ${system}`
  return browser ?? system ?? 'Unknown device'
}
