/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const MAX_CHAIN_LENGTH = 5

const HARD_WALK_CAP = 50

export const toError = (value: unknown): Readonly<Error> => {
  if (value instanceof Error) return value
  try {
    return new Error(String(value))
  } catch {
    return new Error('[uncoercible cause]')
  }
}

const walk = (
  err: Readonly<Error>,
  seen: ReadonlySet<unknown>,
  remaining: number
): ReadonlyArray<Readonly<Error>> => {
  const { cause } = err as { readonly cause?: unknown }
  const isCycle = typeof cause === 'object' && cause !== null && seen.has(cause)
  if (remaining <= 1 || cause === undefined || cause === null || isCycle) return [err]
  return [err, ...walk(toError(cause), new Set([...seen, cause]), remaining - 1)]
}

export interface CauseChain {
  readonly links: ReadonlyArray<Readonly<Error>>
  readonly elided: number
}

export const resolveCauseChain = (error: unknown): CauseChain => {
  const err = toError(error)
  const walked = walk(err, new Set([err]), HARD_WALK_CAP)
  const root = walked.at(-1)
  if (walked.length <= MAX_CHAIN_LENGTH || root === undefined) {
    return { links: walked, elided: 0 }
  }
  return {
    links: [...walked.slice(0, MAX_CHAIN_LENGTH - 1), root],
    elided: walked.length - MAX_CHAIN_LENGTH,
  }
}

export const elidedLabel = (elided: number): string =>
  `${elided} intermediate link${elided === 1 ? '' : 's'} elided`

const describeLink = (err: Readonly<Error>): string =>
  err.stack ?? `${err.name || 'Error'}: ${err.message}`

export const formatErrorChain = (error: unknown): string => {
  const { links, elided } = resolveCauseChain(error)
  const rendered = links.map((link, index) =>
    index === 0 ? describeLink(link) : `Caused by: ${describeLink(link)}`
  )
  const rootLine = rendered.at(-1)
  if (elided === 0 || rootLine === undefined) return rendered.join('\n')
  return [...rendered.slice(0, -1), `… ${elidedLabel(elided)} …`, rootLine].join('\n')
}
