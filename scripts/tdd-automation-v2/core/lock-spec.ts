/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { StateManager, StateManagerLive } from './state-manager'

const program = Effect.gen(function* () {
  // Parse spec-id argument from command line (supports both --spec-id=value and --spec-id value)
  let specId: string | undefined

  const specIdArgWithEquals = process.argv.find((arg) => arg.startsWith('--spec-id='))
  if (specIdArgWithEquals) {
    specId = specIdArgWithEquals.split('=')[1]
  } else {
    const specIdIndex = process.argv.indexOf('--spec-id')
    if (specIdIndex !== -1 && process.argv[specIdIndex + 1]) {
      specId = process.argv[specIdIndex + 1]
    }
  }

  if (!specId) {
    console.error('Error: --spec-id argument is required')
    process.exit(1)
  }

  const stateManager = yield* StateManager

  yield* Console.log(`🔒 Locking spec: ${specId}`)
  yield* stateManager.addActiveSpec(specId)
  yield* Console.log(`✅ Spec locked successfully`)
}).pipe(Effect.provide(StateManagerLive))

Effect.runPromise(program).catch((error) => {
  console.error('Failed to lock spec:', error)
  process.exit(1)
})
