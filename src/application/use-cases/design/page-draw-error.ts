/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The failure of a page the design-system export could not draw, in a module
 * of its own so the CLI can recognise it without loading the page renderer
 * (`design-system-page-draw.ts` raises it; `sovrium design-system` reads it).
 */

import { Data } from 'effect'

/** A page the renderer could not draw offline; nothing is handed over. */
export class DesignSystemPageDrawError extends Data.TaggedError('DesignSystemPageDrawError')<{
  readonly page: string
  readonly cause: unknown
}> {}

/**
 * Whether a failure is a page draw error. Recognised by its class, so an
 * unrelated value that merely carries the same `_tag` is not one.
 */
export const isDesignSystemPageDrawError = (u: unknown): u is DesignSystemPageDrawError =>
  u instanceof DesignSystemPageDrawError

/** The sentence a page draw error's cause gives as its reason, when it gives one. */
export const pageDrawReasonOf = ({
  cause,
}: Pick<DesignSystemPageDrawError, 'cause'>): string | undefined => {
  const reason =
    typeof cause === 'object' && cause !== null && 'reason' in cause ? cause.reason : undefined
  return typeof reason === 'string' ? reason : undefined
}
