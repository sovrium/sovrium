/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Schema, Either } from 'effect'
import { TreeFormatter } from 'effect/ParseResult'
import { AppSchema } from '@/domain/models/app'

export type DecodeAppConfigResult =
  | { readonly valid: true; readonly name: string }
  | { readonly valid: false; readonly errors: readonly string[] }

export const decodeAppConfigObject = (parsed: unknown): DecodeAppConfigResult => {
  const decoded = Schema.decodeUnknownEither(AppSchema, { onExcessProperty: 'error' })(parsed)

  if (Either.isLeft(decoded)) {
    const formatted = TreeFormatter.formatErrorSync(decoded.left)
    const errors = formatted.split('\n').filter((line) => line.trim().length > 0)
    return { valid: false, errors }
  }

  const { name } = parsed as Record<string, unknown>
  return { valid: true, name: typeof name === 'string' ? name : 'unnamed' }
}
