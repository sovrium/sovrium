/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Runtime metrics of the Sovrium process itself, read straight from the
 * runtime — no sampling, no accumulator, no third-party agent.
 *
 * These are the three figures a self-hoster can act on: how much CPU this
 * binary has burned, how much memory it is holding, and over what interval.
 * They are reported as INPUTS a carbon model would need, never converted into
 * gCO2eq here — CPU-seconds to watts needs a TDP and a utilisation model the
 * binary cannot know on a shared vCPU, and the moment a `gramsCO2eq` field
 * exists it becomes the headline figure regardless of how it was derived (see
 * [internal ref] D6).
 *
 * `uptimeSeconds` is what makes the other two interpretable: 40 CPU-seconds
 * over 10 minutes and 40 CPU-seconds over 10 days describe entirely different
 * instances, and a counter published without its interval invites the reader
 * to supply the wrong one.
 */

/** A point-in-time read of the process's own resource usage. */
export interface ProcessMetrics {
  /** Total CPU seconds (user + system) consumed since process start. */
  readonly cpuSeconds: number
  /** Resident set size in bytes at the moment of the read. */
  readonly rssBytes: number
  /** Wall-clock seconds since process start. */
  readonly uptimeSeconds: number
}

/** Microseconds per second — `process.cpuUsage()` reports microseconds. */
const MICROSECONDS_PER_SECOND = 1_000_000

/** Decimal places kept on the two fractional figures. */
const PRECISION = 3

/** Round to {@link PRECISION} decimals so the JSON stays readable. */
const round = (value: number): number => Number(value.toFixed(PRECISION))

/**
 * Read the process's current CPU, memory, and uptime figures.
 *
 * Pure with respect to the process — it observes and returns, mutating
 * nothing — but not referentially transparent, since every call reports the
 * moment it was made. The caller is the admin route, which reads once per
 * request.
 */
export const readProcessMetrics = (): ProcessMetrics => {
  const cpu = process.cpuUsage()
  return {
    cpuSeconds: round((cpu.user + cpu.system) / MICROSECONDS_PER_SECOND),
    rssBytes: process.memoryUsage.rss(),
    uptimeSeconds: round(process.uptime()),
  }
}
