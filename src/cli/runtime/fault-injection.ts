/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Throw the injected crash when `SOVRIUM_FAULT_INJECTION=crash` asks for one:
 * the non-production seam the crash-report specs drive, naming the command
 * that was running. Does nothing otherwise.
 */
export const failIfCrashInjected = async (command: string): Promise<void> => {
  const { parseFaultInjection } = await import('@/domain/models/process-env/fault-injection')
  const fault = parseFaultInjection(process.env)
  if (fault?.kind !== 'crash') return
  const { InjectedFaultError } = await import('@/domain/errors/injected-fault-error')
  throw new InjectedFaultError({
    value: fault.value,
    command,
    cwd: process.cwd(),
    detail: fault.detail,
  })
}
