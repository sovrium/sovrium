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
 * Probe `hostname:port` by binding it and letting go at once.
 *
 * `true` when the bind succeeds, `false` when the address is in use. Any other
 * failure (a hostname that does not resolve, a privileged port) is NOT a port
 * conflict, so it answers `true` and leaves the real bind to report it in its
 * own words.
 */
export const isPortFree = (hostname: string, port: number): boolean => {
  try {
    const probe = Bun.listen({ hostname, port, socket: { data: () => undefined } })
    probe.stop(true)
    return true
  } catch (error) {
    return !isAddressInUse(error)
  }
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
