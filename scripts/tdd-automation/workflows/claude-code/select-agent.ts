/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Select Agent CLI Entry Point
 *
 * CLI script called by claude-code.yml workflow to select the appropriate
 * Claude Code agent based on the spec type and context.
 *
 * Usage:
 *   SPEC_ID=APP-001 bun run scripts/tdd-automation/workflows/claude-code/select-agent.ts
 *
 * Output (JSON):
 *   { "agent": "e2e-test-fixer", "prompt": "..." }
 */

import { Effect, Console } from 'effect'

/**
 * Agent configuration for different spec types
 */
interface AgentConfig {
  readonly agent: string
  readonly prompt: string
  readonly maxTurns?: number
}

/**
 * Select agent based on spec ID pattern
 */
function selectAgentForSpec(specId: string): AgentConfig {
  const upperSpecId = specId.toUpperCase()

  // APP specs - Core application features
  if (upperSpecId.startsWith('APP-')) {
    return {
      agent: 'e2e-test-fixer',
      prompt: `Implement the feature to make the test.fixme() test pass for spec ${specId}.
Focus on making the E2E test GREEN with minimal code changes.
Run bun test:e2e:spec after implementation to verify.`,
    }
  }

  // MIG specs - Database migrations
  if (upperSpecId.startsWith('MIG-')) {
    return {
      agent: 'e2e-test-fixer',
      prompt: `Implement the database migration for spec ${specId}.
Focus on schema changes required to make the test.fixme() test pass.
Run bun test:e2e:spec after implementation to verify.`,
    }
  }

  // STATIC specs - Static site generation
  if (upperSpecId.startsWith('STATIC-')) {
    return {
      agent: 'e2e-test-fixer',
      prompt: `Implement the static site generation feature for spec ${specId}.
Focus on making the test.fixme() test pass with minimal changes.
Run bun test:e2e:spec after implementation to verify.`,
    }
  }

  // API specs - API endpoints
  if (upperSpecId.startsWith('API-')) {
    return {
      agent: 'e2e-test-fixer',
      prompt: `Implement the API endpoint for spec ${specId}.
Focus on making the test.fixme() test pass.
Follow the existing API patterns in src/presentation/api/.
Run bun test:e2e:spec after implementation to verify.`,
    }
  }

  // ADMIN specs - Admin features
  if (upperSpecId.startsWith('ADMIN-')) {
    return {
      agent: 'e2e-test-fixer',
      prompt: `Implement the admin feature for spec ${specId}.
Focus on making the test.fixme() test pass with minimal changes.
Run bun test:e2e:spec after implementation to verify.`,
    }
  }

  // Default agent
  return {
    agent: 'e2e-test-fixer',
    prompt: `Implement the feature to make the test.fixme() test pass for spec ${specId}.
Run bun test:e2e:spec after implementation to verify.`,
  }
}

const main = Effect.gen(function* () {
  const specId = process.env['SPEC_ID']

  if (!specId) {
    yield* Console.error('::error::SPEC_ID environment variable not set')
    yield* Console.log(
      JSON.stringify({
        error: 'SPEC_ID not set',
      })
    )
    return
  }

  const config = selectAgentForSpec(specId)

  yield* Console.log(JSON.stringify(config))
})

Effect.runPromise(main)
