/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** The `name` parameter of this page's address, or `''` when it carries none. */
export const pageQueryParam = (name: string): string =>
  new URLSearchParams(globalThis.location?.search ?? '').get(name) ?? ''
