/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { join } from 'node:path'
import { Effect } from 'effect'
import { readJsonFromUnit } from './instance-handover'
import { checkedSlug, discard, fail, instanceDir } from './instance-releases'
import type { InstanceSupervisorError } from '@/application/ports/services/instance-supervisor'

/**
 * `usage` of `SystemdSupervisorLive`: run the app's one-shot usage unit and
 * read the report it left.
 *
 * The unit, `sovrium-usage@<slug>.service`, runs `sovrium usage --report
 * <instances>/<slug>/usage/report.json` as the app's own user: the agent never
 * reads the app's database or files, only the numbers the app wrote. A report
 * an earlier run left is deleted BEFORE the unit starts, and the one read is
 * deleted after, so a figure is never answered twice; a unit that leaves none
 * fails the step.
 */

/** The host's one-shot usage unit of an app. */
export const usageUnit = (slug: string): string => `sovrium-usage@${slug}.service`

/** The most a usage report may weigh: six figures and a few reasons. */
const USAGE_REPORT_MAX_BYTES = 64 * 1024

export const usage = Effect.fn('instance.usage')(function* (
  startUnit: (unit: string, timeoutMs: number) => Effect.Effect<unknown, InstanceSupervisorError>,
  slug: string,
  timeoutMs: number
) {
  const dir = yield* instanceDir(slug)
  const s = yield* checkedSlug(slug)
  const reportPath = join(dir, 'usage', 'report.json')
  return yield* Effect.gen(function* () {
    yield* discard(reportPath)
    yield* startUnit(usageUnit(s), timeoutMs)
    const report = yield* readJsonFromUnit(reportPath, USAGE_REPORT_MAX_BYTES)
    if (report === undefined) {
      return yield* fail(`${usageUnit(s)} left no report at ${reportPath}`)
    }
    return report as unknown
  }).pipe(Effect.ensuring(discard(reportPath)))
})
