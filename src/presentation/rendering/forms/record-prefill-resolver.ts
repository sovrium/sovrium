/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export type PrefillValue = string | number | boolean | readonly string[] | readonly number[]

export interface InlinePrefillShape {
  readonly prefill: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill?: boolean
}

export function isInlinePrefill(value: unknown): value is InlinePrefillShape {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { readonly prefill?: unknown }
  return typeof candidate.prefill === 'object' && candidate.prefill !== null
}

const RECORD_TOKEN_PREFIXES = ['$parent.', '$record.'] as const

function resolveRecordPrefillValue(
  value: PrefillValue,
  parentRecord: Readonly<Record<string, unknown>> | undefined
): PrefillValue | undefined {
  if (typeof value !== 'string') return value
  const prefix = RECORD_TOKEN_PREFIXES.find((p) => value.startsWith(p))
  if (prefix === undefined) return value
  if (parentRecord === undefined) return undefined
  const segment = value.slice(prefix.length)
  const resolved = parentRecord[segment]
  if (resolved === undefined || resolved === null) return undefined
  if (Array.isArray(resolved)) {
    return resolved.filter((item): item is string => typeof item === 'string')
  }
  if (typeof resolved === 'number' || typeof resolved === 'boolean') return resolved
  return String(resolved)
}

export function resolveRecordPrefillMap(
  inlinePrefill: InlinePrefillShape | undefined,
  parentRecord: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, PrefillValue>> {
  if (inlinePrefill === undefined) return {}
  const entries = Object.entries(inlinePrefill.prefill)
    .map(([key, raw]): readonly [string, PrefillValue | undefined] => [
      key,
      resolveRecordPrefillValue(raw, parentRecord),
    ])
    .filter((entry): entry is readonly [string, PrefillValue] => entry[1] !== undefined)
  return Object.fromEntries(entries)
}
