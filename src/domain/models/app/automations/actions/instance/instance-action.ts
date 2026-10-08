/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { InstanceApplyActionSchema } from './apply'
import { InstanceBackupActionSchema } from './backup'
import { InstanceHealthActionSchema } from './health'
import { InstanceLogsActionSchema } from './logs'
import { InstanceRemoveActionSchema } from './remove'
import { InstanceRestartActionSchema } from './restart'
import { InstanceRestoreActionSchema } from './restore'
import { InstanceRollbackActionSchema } from './rollback'
import { InstanceStartActionSchema } from './start'
import { InstanceStatusActionSchema } from './status'
import { InstanceStopActionSchema } from './stop'

/**
 * Instance Action — operators that supervise OTHER Sovrium apps running on the
 * same host, each as its own systemd unit `sovrium-app@<slug>.service`.
 *
 * Unlike every other family, these reach beyond the app's own process, so they
 * sit behind an operator gate: every handler refuses unless
 * `SOVRIUM_HOST_ACTIONS` is `1` or `true`, an app declaring one boots only with
 * it set, an app that can run `code/runTypescript` never boots with it set, and
 * none of them is ever an agent tool. The slug is the only caller-supplied
 * value that reaches a command line.
 */
export const InstanceActionSchema = Schema.Union([
  InstanceStatusActionSchema,
  InstanceStartActionSchema,
  InstanceStopActionSchema,
  InstanceRestartActionSchema,
  InstanceApplyActionSchema,
  InstanceRollbackActionSchema,
  InstanceRemoveActionSchema,
  InstanceHealthActionSchema,
  InstanceLogsActionSchema,
  InstanceBackupActionSchema,
  InstanceRestoreActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'InstanceAction',
    title: 'Instance Action',
    description:
      'Supervise other Sovrium apps on this host: read their state, start, stop, restart, apply a signed release, roll back, remove, probe, read logs, back up and restore. Requires SOVRIUM_HOST_ACTIONS=1',
  })
)

/** @public */
export type InstanceAction = Schema.Schema.Type<typeof InstanceActionSchema>
