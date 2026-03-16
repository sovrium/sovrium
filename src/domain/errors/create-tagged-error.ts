/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Factory function to create tagged error classes for Effect discriminated unions.
 *
 * This factory reduces boilerplate for error classes that follow the pattern:
 * - `readonly _tag` property for discriminated union matching
 * - `readonly cause` property to wrap underlying errors
 *
 * @example
 * ```typescript
 * // Instead of manually defining:
 * export class MyError {
 *   readonly _tag = 'MyError'
 *   constructor(readonly cause: unknown) {}
 * }
 *
 * // Use the factory:
 * export const MyError = createTaggedError('MyError')
 * export type MyError = InstanceType<typeof MyError>
 * ```
 *
 * @param tag - The unique tag string for the error type (used in Effect matching)
 * @returns A class constructor that creates tagged error instances
 */
export function createTaggedError<T extends string>(tag: T) {
  return class {
    readonly _tag = tag
    constructor(readonly cause: unknown) {}
  } as new (cause: unknown) => { readonly _tag: T; readonly cause: unknown }
}
