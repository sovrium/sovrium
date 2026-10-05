/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The path a visitor asked for, decoded and without its query string — the
 * value `$app.path` prints on the page that answers a missing address.
 *
 * A path that does not decode (a stray `%`) is named as it arrived rather than
 * refused: the page exists to tell the visitor which address it was, and the
 * raw form still says that.
 *
 * The value is the VISITOR's, so a caller that places it into markup escapes
 * it; `$app.*` substitution does so for an author HTML template and pins a text
 * template to text.
 */
export const requestedPath = (url: string): string => {
  const raw = new URL(url).pathname
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}
