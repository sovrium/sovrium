/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `SOVRIUM_TEST_RESOLVE_HOST` — answers the outbound address check gives for
 * named hosts, instead of the machine's resolver. For tests.
 *
 * The value is `name=address`, comma-separated: `billing-sidecar.test=127.0.0.1`.
 * A name may be listed more than once to give it several addresses. Names are
 * compared case-insensitively and a trailing dot is ignored, as a resolver
 * reads them. An address must be an IP literal (IPv4 dotted quad, or IPv6 with
 * or without brackets); an entry that is not `name=address` with a literal
 * address is ignored, so a typo never turns into a name resolving to nothing.
 *
 * The parser decides nothing about WHEN the hint applies: the reader
 * (`host-resolution.ts`) honours it only while the deployment's address is
 * loopback. Pure: the value is a parameter.
 */

/** The variable that carries the hint. */
export const SOVRIUM_TEST_RESOLVE_HOST_VAR = 'SOVRIUM_TEST_RESOLVE_HOST'

/** Each listed name (lower-case, no trailing dot) with its addresses, in the order written. */
export type TestResolveHints = ReadonlyMap<string, readonly string[]>

const IPV4 = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

/** Whether `value` is an IPv6 literal, read by the URL parser. */
const isIpv6Literal = (value: string): boolean =>
  value.includes(':') && /^[0-9a-f:.]+$/i.test(value) && URL.canParse(`http://[${value}]/`)

/** The address as the resolver would answer it, or `undefined` when it is not an IP literal. */
const toAddress = (raw: string): string | undefined => {
  const value = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw
  if (IPV4.test(value)) return value
  return isIpv6Literal(value) ? value.toLowerCase() : undefined
}

/** A host name as the hint keys it: trimmed, lower-case, no trailing dot. */
export const normalizeHintName = (name: string): string => {
  const lower = name.trim().toLowerCase()
  return lower.endsWith('.') ? lower.slice(0, -1) : lower
}

/** One `name=address` entry, or `undefined` when it is malformed. */
const parseEntry = (
  entry: string
): { readonly name: string; readonly address: string } | undefined => {
  const separator = entry.indexOf('=')
  if (separator <= 0) return undefined
  const name = normalizeHintName(entry.slice(0, separator))
  const address = toAddress(entry.slice(separator + 1).trim())
  if (name === '' || /[\s/:@]/.test(name) || address === undefined) return undefined
  return { name, address }
}

/** The hints a value of `SOVRIUM_TEST_RESOLVE_HOST` lists; empty when unset or blank. */
export const parseTestResolveHints = (value: string | undefined): TestResolveHints =>
  (value ?? '')
    .split(',')
    .map((entry) => parseEntry(entry.trim()))
    .filter((entry) => entry !== undefined)
    .reduce<ReadonlyMap<string, readonly string[]>>(
      (hints, { name, address }) =>
        new Map([...hints, [name, [...(hints.get(name) ?? []), address]]]),
      new Map()
    )

/** The addresses the hints give `hostname`, or `undefined` when it is not listed. */
export const hintedAddresses = (
  hints: TestResolveHints,
  hostname: string
): readonly string[] | undefined => hints.get(normalizeHintName(hostname))
