/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export function createTaggedError<T extends string>(tag: T) {
  return class {
    readonly _tag = tag
    constructor(readonly cause: unknown) {}
  } as new (cause: unknown) => { readonly _tag: T; readonly cause: unknown }
}
