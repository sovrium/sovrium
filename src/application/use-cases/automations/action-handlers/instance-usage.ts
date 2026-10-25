/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Option, Schema } from 'effect'
import {
  InstanceSupervisor,
  InstanceSupervisorError,
} from '@/application/ports/services/instance-supervisor'
import { UsageReportSchema } from '@/domain/models/app/automations/actions/instance/usage'
import { instanceHandler, slugOf, unitJobTimeout } from './instance'

/**
 * `instance/usage` — how many bytes a supervised app's database and stored
 * files hold, measured AS the app by its one-shot unit
 * `sovrium-usage@<slug>.service` running `sovrium usage`. The step reads only
 * the numbers the unit reported; the report is checked against the report
 * shape before it becomes the output, so nothing else the file might hold
 * reaches the run history.
 */
export const handleInstanceUsage = instanceHandler('usage', (props, action) =>
  Effect.gen(function* () {
    const slug = yield* slugOf(props)
    const supervisor = yield* InstanceSupervisor
    const report = yield* supervisor.usage(slug, unitJobTimeout(action))
    const decoded = Schema.decodeUnknownOption(UsageReportSchema)(report)
    if (Option.isNone(decoded)) {
      return yield* new InstanceSupervisorError({
        message: `instance: sovrium-usage@${slug}.service left a report that is not a usage report`,
      })
    }
    return { slug, ...decoded.value }
  })
)
