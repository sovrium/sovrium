/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  InstanceSupervisor,
  InstanceSupervisorError,
} from '@/application/ports/services/instance-supervisor'
import { engineVersionOf, instanceHandler } from './instance'

/**
 * `instance/engineInstall` and `instance/enginePrune` — the engine store of
 * this host, `SOVRIUM_ENGINES_DIR`, one `<version>/sovrium` per Sovrium
 * release a supervised app runs on. Both sit behind the same operator switch
 * as every `instance/*` step, checked before a prop is read; every version is
 * re-checked here, as a templated prop or a code call arrives as whatever it
 * resolved to, and a version names a directory of the store.
 */

const refuse = (message: string) => Effect.fail(new InstanceSupervisorError({ message }))

export const handleInstanceEngineInstall = instanceHandler('engineInstall', (props) =>
  Effect.gen(function* () {
    const version = yield* engineVersionOf(props['version'], 'version')
    const supervisor = yield* InstanceSupervisor
    const { installed, path } = yield* supervisor.installEngine(version)
    return { version, installed, path }
  })
)

/** `keep`: a list of release numbers; a template resolving to nothing keeps none. */
const keepOf = (value: unknown) => {
  if (value === undefined || value === null || value === '') return Effect.succeed([])
  if (!Array.isArray(value)) {
    return refuse(`instance: keep must be a list of release numbers (got ${String(value)})`)
  }
  return Effect.forEach(value, (version: unknown) => engineVersionOf(version, 'keep version'))
}

export const handleInstanceEnginePrune = instanceHandler('enginePrune', (props) =>
  Effect.gen(function* () {
    const keep = yield* keepOf(props['keep'])
    const supervisor = yield* InstanceSupervisor
    const { removed, kept } = yield* supervisor.pruneEngines(keep)
    return { removed: [...removed], kept: [...kept] }
  })
)
