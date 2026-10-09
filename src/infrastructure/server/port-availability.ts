/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether a TCP port is free to bind, and who holds it when it is not.
 *
 * A strict boot (`isStrictPortBoot`) refuses a busy port instead of moving to
 * an OS-assigned one. The refusal is checked TWICE: once by the CLI before the
 * boot touches anything — so "changed nothing" is true, no migration has run
 * and no lock file exists — and once at the real bind in `bun-listener.ts`,
 * which closes the window between the two.
 */

/** Whether an error is the operating system's "address already in use". */
export const isAddressInUse = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { readonly code: unknown }).code === 'EADDRINUSE'

/**
 * Whether a probe failed because this machine cannot bind that address at all
 * — no IPv6 on the host (`EADDRNOTAVAIL`), or no such address family
 * (`EAFNOSUPPORT`). Such an address is skipped, never reported busy.
 */
const isUnbindableAddress = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  ['EADDRNOTAVAIL', 'EAFNOSUPPORT'].includes(String((error as { readonly code: unknown }).code))

/** The two wildcard addresses, one per family. */
const WILDCARDS: ReadonlySet<string> = new Set(['0.0.0.0', '::'])

/** The two loopback addresses, one per family. */
const LOOPBACKS: readonly string[] = ['127.0.0.1', '::1']

/** Whether a host name is itself a wildcard bind. */
const isWildcardHost = (hostname: string): boolean => hostname === '' || WILDCARDS.has(hostname)

/**
 * The addresses a host name reaches, without asking a resolver: an address
 * literal is itself, `localhost` is both loopbacks, and any other name is
 * left to the listen to resolve. `resolveHostAddresses` is the full answer;
 * this is the synchronous fallback.
 */
const literalAddressesFor = (hostname: string): readonly string[] => {
  const name = hostname.toLowerCase()
  return name === 'localhost' || name.endsWith('.localhost') ? LOOPBACKS : [hostname]
}

/**
 * Every address a host name resolves to, in both families.
 *
 * An empty list means the name does not resolve; `isPortFree` then answers
 * free and leaves the real bind to report the name in its own words.
 */
export const resolveHostAddresses = async (hostname: string): Promise<readonly string[]> => {
  if (isWildcardHost(hostname)) return [hostname === '' ? '0.0.0.0' : hostname]
  try {
    const records = await Bun.dns.lookup(hostname, {})
    return [...new Set(records.map((record) => record.address))]
  } catch {
    // effect-swallow: a name that does not resolve is not a port conflict; the
    // real bind reports it with the resolver's own message.
    return []
  }
}

/**
 * The full set of addresses a strict boot on `hostname` must find free: what
 * the name reaches; for a wildcard boot, both loopbacks and both wildcards; and
 * for a specific-address boot, both wildcards only where a wildcard holder can
 * share the boot's traffic without stopping its bind (macOS, the BSDs,
 * Windows). Linux refuses a specific bind while a wildcard holds the port, so
 * the resolved addresses already catch that holder there, and a wildcard probe
 * would wrongly report a holder on an unrelated address as a conflict.
 */
export const probeAddressesFor = (
  hostname: string,
  resolved: readonly string[],
  platform: NodeJS.Platform = process.platform
): readonly string[] => {
  if (isWildcardHost(hostname)) return [...new Set([...resolved, ...WILDCARDS, ...LOOPBACKS])]
  return [...new Set([...resolved, ...(platform === 'linux' ? [] : WILDCARDS)])]
}

/** Bind `address:port` and let go at once; the error, if the bind failed. */
const bindError = (address: string, port: number): unknown => {
  try {
    Bun.listen({ hostname: address, port, socket: { data: () => undefined } }).stop(true)
    return undefined
  } catch (error) {
    return error
  }
}

/**
 * Probe `hostname:port` by binding every address it reaches, plus both
 * wildcards, and letting go of each at once.
 *
 * A socket bound to one address does not collide with a probe on another, so
 * probing only the address a name resolves to FIRST read a port held on the
 * other loopback (`localhost` reaches `127.0.0.1` and `::1` on macOS), or on a
 * wildcard, as free — and the strict refusal never fired.
 *
 * `false` when any bind reports the address in use. An address this machine
 * cannot bind is skipped. Any other failure (a host name that does not
 * resolve, a privileged port) is NOT a port conflict, so it answers `true` and
 * leaves the real bind to report it in its own words. Each probe is released
 * before the next, so nothing is held afterwards.
 *
 * @param resolved - what `resolveHostAddresses` returned for `hostname`; when
 *   omitted, address literals and `localhost` are expanded without a resolver.
 */
export const isPortFree = (
  hostname: string,
  port: number,
  resolved: readonly string[] = literalAddressesFor(hostname)
): boolean => {
  if (resolved.length === 0) return true
  const errors = probeAddressesFor(hostname, resolved).map((address) => bindError(address, port))
  // A resolved address that fails for a reason other than a conflict or an
  // unbindable family (a name that does not resolve, a privileged port) keeps
  // the old answer: free, and the real bind says why in its own words.
  const unexplained = errors
    .slice(0, resolved.length)
    .some((error) => error !== undefined && !isAddressInUse(error) && !isUnbindableAddress(error))
  return unexplained || !errors.some(isAddressInUse)
}

/**
 * The pid of the process listening on `port`, when the system will say.
 *
 * Asks `lsof`, with a one-second budget, and answers `undefined` when it is
 * missing, slow, or names nothing — the refusal is complete without a pid, the
 * pid only saves the operator a lookup. Windows has no `lsof`.
 */
export const findPortHolderPid = (port: number): number | undefined => {
  if (process.platform === 'win32') return undefined
  try {
    const result = Bun.spawnSync(['lsof', '-nP', '-t', `-iTCP:${String(port)}`, '-sTCP:LISTEN'], {
      stdout: 'pipe',
      stderr: 'ignore',
      timeout: 1000,
    })
    const first = result.stdout.toString().trim().split('\n')[0] ?? ''
    const pid = Number.parseInt(first, 10)
    return Number.isInteger(pid) && pid > 0 && pid !== process.pid ? pid : undefined
  } catch {
    // effect-swallow: `lsof` is an optional nicety — absent on many hosts — and
    // the refusal it decorates is printed either way.
    return undefined
  }
}

/**
 * The one sentence a strict boot refuses with, naming the port, the interface
 * and — when known — the process holding it.
 *
 * `changedNothing` is true only on the CLI's early probe, which runs before the
 * boot touches the database or writes a sidecar file.
 */
export const portInUseMessage = (args: {
  readonly hostname: string
  readonly port: number
  readonly holderPid: number | undefined
  readonly changedNothing: boolean
}): string => {
  const holder = args.holderPid === undefined ? '' : ` by process ${String(args.holderPid)}`
  const outcome = args.changedNothing
    ? 'refusing to start; Sovrium changed nothing'
    : 'refusing to start'
  return (
    `Error: Port ${String(args.port)} on ${args.hostname} is in use${holder}; ${outcome}. ` +
    'Free the port or set PORT to another one. A port that is set, SOVRIUM_STRICT_PORT and ' +
    'systemd all make a busy port refuse rather than move.'
  )
}

/**
 * The late refusal, raised at the real bind when the port was taken after the
 * CLI's probe: the boot has run by then, so it does not claim to have changed
 * nothing.
 */
export const portInUseRefusal = (hostname: string, port: number, cause: unknown): Error =>
  new Error(
    portInUseMessage({ hostname, port, holderPid: findPortHolderPid(port), changedNothing: false }),
    { cause }
  )
