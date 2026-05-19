/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause } from 'effect'
import { TreeFormatter } from 'effect/ParseResult'

export const formatRuntimeError = (error: unknown): string => {
  const fromFiber = formatFromFiberFailure(error)
  if (fromFiber !== undefined) return fromFiber

  const fromTagged = formatFromTaggedError(error)
  if (fromTagged !== undefined) return fromTagged

  if (error instanceof Error) {
    return error.stack ?? error.message
  }

  return String(error)
}

const formatFromFiberFailure = (error: unknown): string | undefined => {
  if (error === null || typeof error !== 'object' || !('cause' in error)) {
    return undefined
  }
  const { cause } = error as { readonly cause: unknown }
  if (cause === null || cause === undefined || typeof cause !== 'object') {
    return undefined
  }
  try {
    return Cause.pretty(cause as Cause.Cause<unknown>)
  } catch {
    return undefined
  }
}

const formatFromTaggedError = (error: unknown): string | undefined => {
  if (error === null || typeof error !== 'object' || !('_tag' in error)) {
    return undefined
  }
  const tagged = error as { readonly _tag: string; readonly [key: string]: unknown }

  if (tagged._tag === 'ParseError' && 'issue' in tagged) {
    try {
      return TreeFormatter.formatErrorSync(error as never)
    } catch {
    }
  }

  return formatGenericTaggedError(tagged)
}

const formatGenericTaggedError = (
  tagged: Readonly<{ readonly _tag: string; readonly [key: string]: unknown }>
): string => {
  const props = Object.fromEntries(
    Object.entries(tagged).filter(([key]) => key !== '_tag' && typeof tagged[key] !== 'function')
  )
  const propsStr = Object.keys(props).length > 0 ? ` ${JSON.stringify(props)}` : ''
  return `[${tagged._tag}]${propsStr}`
}
