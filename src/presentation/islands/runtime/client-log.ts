/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The islands' one console sink.
 *
 * Island code runs in the browser, where the server's Logger (stdout, OTLP,
 * Sentry) does not exist and the layer rules keep infrastructure out of the
 * bundle anyway: the console is the right place for a failure no widget
 * paints, so a trace's console capture records which leg failed. Every
 * island writes there through this function, so `no-console` holds for the
 * rest of the tree and a new raw `console.*` is a lint error, not a habit.
 *
 * @param scope - the island or runtime that warns, printed as `[scope]`
 * @param details - what the console prints after it, as `console.warn` would
 */
export const warnInBrowser = (scope: string, ...details: readonly unknown[]): void => {
  console.warn(`[${scope}]`, ...details)
}
