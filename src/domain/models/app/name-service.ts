/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The address a hosted app gets from its config `name`, as `sovrium deploy`
 * derives it when no `--app` is given and `sovrium bundle` names its archive.
 *
 * Lowercase, a scope's `@` dropped, every other run of characters outside
 * `[a-z0-9]` written `-`, and the `-` at either end trimmed: `@atelier/crm`
 * becomes `atelier-crm`. The result may be empty (a name made only of
 * punctuation) or longer than any address a cloud accepts; it is never
 * shortened, so the caller decides what an unusable result means.
 */
export const deriveAppSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/@/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
