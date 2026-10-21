/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The failure the non-production `SOVRIUM_FAULT_INJECTION` seam raises.
 *
 * It exists so the paths that report a failure Sovrium did not foresee — a
 * start that dies in its startup, a command that crashes, an action handler
 * that throws — can be exercised on purpose, on a machine that is not running
 * in production. Nothing else ever throws it.
 *
 * The message names the seam's value, the command and the working directory,
 * then the optional detail: the directory and the detail are what a report has
 * to strip or redact, so the error carries both on purpose.
 */
export class InjectedFaultError extends Error {
  constructor(input: {
    readonly value: string
    readonly command: string
    readonly cwd: string
    readonly detail?: string | undefined
  }) {
    const detail = input.detail !== undefined && input.detail !== '' ? `: ${input.detail}` : ''
    super(
      `Injected fault (${input.value}) while running "${input.command}" in ${input.cwd}${detail}`
    )
    // eslint-disable-next-line functional/no-expression-statements -- Required for Error subclass
    this.name = 'InjectedFaultError'
  }
}
